#!/usr/bin/env tsx
/**
 * Virtual DJ agent smoke — boots the DeepSeek Harness runtime exactly like the
 * app does and sends one message.
 *
 *   pnpm agent:smoke                      # real OpenRouter (needs OPENROUTER_API_KEY in .env)
 *   pnpm agent:smoke --fake               # offline: a fake OpenAI-compatible server answers
 *   pnpm agent:smoke --base http://localhost:5199 --text "drop"
 *   pnpm agent:smoke --fake-server        # only run the fake server, for testing the UI by hand
 *
 * Prerequisite: the app is running at --base (default http://localhost:5173),
 * because the agent's hands are the MCP bridge calling /api/dj/*.
 *
 * In --fake mode the fake model first calls mcp__vdj__set_energy with --energy
 * (default 0.15) and then replies with text; the script verifies the DJ
 * session really changed. That proves the whole chain without a key:
 * runtime → dsh → MCP stdio → HTTP → session store.
 *
 * --fake-server keeps the same fake up and prints the env you export before
 * `pnpm dev`, so the chat panel can be exercised in a browser without a key.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AgentRuntime } from '../src/lib/agent/runtime';
import { resolveAgentConfig } from '../src/lib/agent/config';
import type { ConductorEvent } from '../src/lib/agent/events';

interface Args {
	fake: boolean;
	fakeServer: boolean;
	base: string;
	text: string;
	energy: number;
	port: number;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		fake: false,
		fakeServer: false,
		base: 'http://localhost:5173',
		text: 'take it darker',
		energy: 0.15,
		port: 0
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = () => {
			i += 1;
			const value = argv[i];
			if (value === undefined) throw new Error(`${arg} needs a value`);
			return value;
		};
		if (arg === '--fake') args.fake = true;
		else if (arg === '--fake-server') args.fakeServer = true;
		else if (arg === '--base') args.base = next().replace(/\/$/, '');
		else if (arg === '--text') args.text = next();
		else if (arg === '--energy') args.energy = Number(next());
		else if (arg === '--port') args.port = Number(next());
		else if (arg === '--help' || arg === '-h') {
			console.log(
				'usage: pnpm agent:smoke [--fake | --fake-server] [--base URL] [--text "..."] [--energy 0.15] [--port N]'
			);
			process.exit(0);
		} else throw new Error(`unknown argument ${arg}`);
	}
	return args;
}

/** Minimal KEY=VALUE .env reader (no dependency, no interpolation). */
function loadDotEnv(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const out: Record<string, string> = {};
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		out[key] = value;
	}
	return out;
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolveBody, reject) => {
		let data = '';
		req.on('data', (chunk: Buffer) => {
			data += chunk.toString('utf8');
		});
		req.on('end', () => resolveBody(data));
		req.on('error', reject);
	});
}

function sse(res: ServerResponse, frames: unknown[]): void {
	res.writeHead(200, {
		'content-type': 'text/event-stream',
		'cache-control': 'no-cache',
		connection: 'keep-alive'
	});
	for (const frame of frames) res.write(`data: ${JSON.stringify(frame)}\n\n`);
	res.write('data: [DONE]\n\n');
	res.end();
}

/** Rough intent → verb table so the fake feels alive when driven by hand. */
function fakeVerbFor(
	userText: string,
	energy: number
): { name: string; args: Record<string, unknown> } {
	const t = userText.toLowerCase();
	if (/\b(stop everything|panic|kill)\b/.test(t))
		return { name: 'mcp__vdj__emergency_stop', args: {} };
	if (/\bdrop\b/.test(t)) return { name: 'mcp__vdj__drop', args: {} };
	if (/\bbreak\b/.test(t)) return { name: 'mcp__vdj__break', args: {} };
	if (/\b(bright|lift|build|up)\b/.test(t))
		return { name: 'mcp__vdj__set_energy', args: { energy: 0.85 } };
	const bpm = /(\d{2,3})\s*bpm/.exec(t);
	if (bpm) return { name: 'mcp__vdj__set_bpm', args: { bpm: Number(bpm[1]) } };
	const mute = /\bmute\s+(kick|bass|hats|perc|chords|vox|fx)\b/.exec(t);
	if (mute) return { name: 'mcp__vdj__mute_role', args: { role: mute[1], mute: true } };
	return { name: 'mcp__vdj__set_energy', args: { energy } };
}

/** OpenAI-compatible fake: one tool call, then one text reply. */
function startFakeOpenRouter(
	energy: number,
	port = 0
): Promise<{ url: string; close: () => void; calls: string[] }> {
	const calls: string[] = [];
	const server = createServer(async (req, res) => {
		const url = req.url ?? '/';
		if (req.method === 'GET' && url.startsWith('/v1/models')) {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ data: [{ id: 'deepseek/deepseek-v4-flash' }] }));
			return;
		}
		if (req.method !== 'POST' || !url.startsWith('/v1/chat/completions')) {
			res.writeHead(404);
			res.end();
			return;
		}
		if (!req.headers.authorization?.startsWith('Bearer ')) {
			res.writeHead(401, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ error: { message: 'Missing Authentication header', code: 401 } }));
			return;
		}
		const body = JSON.parse((await readBody(req)) || '{}') as {
			messages?: Array<{ role: string; content?: unknown }>;
			model?: string;
		};
		const messages = body.messages ?? [];
		const hasToolResult = messages.some((m) => m.role === 'tool');
		const lastUser = [...messages].reverse().find((m) => m.role === 'user');
		const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
		calls.push(hasToolResult ? 'text' : 'tool');
		const base = {
			id: `chatcmpl-${calls.length}`,
			object: 'chat.completion.chunk',
			created: 0,
			model: body.model ?? 'fake'
		};
		if (!hasToolResult) {
			const verb = fakeVerbFor(userText, energy);
			sse(res, [
				{
					...base,
					choices: [
						{
							index: 0,
							delta: {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										index: 0,
										id: `call_fake_${calls.length}`,
										type: 'function',
										function: { name: verb.name, arguments: '' }
									}
								]
							},
							finish_reason: null
						}
					]
				},
				{
					...base,
					choices: [
						{
							index: 0,
							delta: {
								tool_calls: [{ index: 0, function: { arguments: JSON.stringify(verb.args) } }]
							},
							finish_reason: null
						}
					]
				},
				{ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
				{
					...base,
					choices: [],
					usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }
				}
			]);
			return;
		}
		const text = `Done: ${userText.trim() || 'adjusted the deck'}.`;
		sse(res, [
			{
				...base,
				choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
			},
			{ ...base, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] },
			{ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
			{
				...base,
				choices: [],
				usage: { prompt_tokens: 30, completion_tokens: 6, total_tokens: 36 }
			}
		]);
	});
	return new Promise((resolveServer) => {
		server.listen(port, '127.0.0.1', () => {
			const address = server.address();
			const boundPort = typeof address === 'object' && address ? address.port : 0;
			resolveServer({
				url: `http://127.0.0.1:${boundPort}/v1`,
				close: () => server.close(),
				calls
			});
		});
	});
}

async function getSession(
	base: string
): Promise<{ energy: number; revision: number; phase: string }> {
	const res = await fetch(`${base}/api/dj/session`);
	if (!res.ok) {
		throw new Error(`app not reachable at ${base} (GET /api/dj/session → ${res.status})`);
	}
	const body = (await res.json()) as {
		session: { energy: number; revision: number; phase: string };
	};
	return body.session;
}

function describe(event: ConductorEvent): string {
	switch (event.type) {
		case 'status':
			return `status ${event.status}`;
		case 'text':
			return `text +${JSON.stringify(event.delta)}`;
		case 'assistant':
			return `assistant ${JSON.stringify(event.text)}`;
		case 'tool-call':
			return `tool-call ${event.tool} ${typeof event.args === 'string' ? event.args : JSON.stringify(event.args)}`;
		case 'tool-result':
			return `tool-result ${event.ok ? 'ok' : 'FAIL'} ${event.summary}`;
		case 'error':
			return `error ${event.code ?? ''} ${event.message}`;
		case 'done':
			return `done ${JSON.stringify(event.text)}`;
	}
}

async function main(): Promise<number> {
	const args = parseArgs(process.argv.slice(2));
	const repoRoot = resolve(import.meta.dirname, '..');

	if (args.fakeServer) {
		const fake = await startFakeOpenRouter(args.energy, args.port);
		console.log(`fake OpenRouter up at ${fake.url} (Ctrl-C to stop)`);
		console.log('start the app with:');
		console.log(`  OPENROUTER_API_KEY=sk-or-fake VDJ_OPENROUTER_BASE_URL=${fake.url} pnpm dev`);
		await new Promise(() => {});
		return 0;
	}

	const env: Record<string, string | undefined> = {
		...loadDotEnv(resolve(repoRoot, '.env')),
		...process.env
	};
	env.VDJ_BASE_URL = args.base;

	let fake: Awaited<ReturnType<typeof startFakeOpenRouter>> | null = null;
	if (args.fake) {
		fake = await startFakeOpenRouter(args.energy);
		env.VDJ_OPENROUTER_BASE_URL = fake.url;
		env.OPENROUTER_API_KEY = 'sk-or-fake-smoke';
		console.log(`fake OpenRouter at ${fake.url}`);
	}

	const config = resolveAgentConfig(env, { cwd: repoRoot });
	if (!config.apiKey) {
		console.error('OPENROUTER_API_KEY is not set: add it to .env or run with --fake');
		return 2;
	}

	const before = await getSession(args.base);
	console.log(
		`app ${args.base} · session rev ${before.revision} energy ${before.energy} phase ${before.phase}`
	);
	console.log(
		`runtime ${config.provider}/${config.model} reasoning=${config.reasoning ?? 'default'} home=${config.dshHome}`
	);

	const runtime = new AgentRuntime(config, { log: (line) => console.error(`[runtime] ${line}`) });
	const started = Date.now();
	let exitCode = 0;
	try {
		await runtime.ensureStarted(args.base);
		console.log(`runtime ready in ${Date.now() - started} ms`);
		const t0 = Date.now();
		const seen: ConductorEvent[] = [];
		const result = await runtime.chat(
			'smoke',
			args.text,
			(event) => {
				seen.push(event);
				console.log(`  ${String(Date.now() - t0).padStart(5)}ms  ${describe(event)}`);
			},
			{ appBaseUrl: args.base }
		);
		console.log(`reply: ${JSON.stringify(result.text)}`);
		console.log(`tools: ${runtime.status().tools.join(', ')}`);

		const after = await getSession(args.base);
		console.log(`session rev ${after.revision} energy ${after.energy} phase ${after.phase}`);
		const toolOk = seen.some((e) => e.type === 'tool-result' && e.ok);
		if (args.fake) {
			const expected = Math.abs(after.energy - args.energy) < 1e-9;
			if (!expected || !toolOk || !result.text) {
				console.error(
					`FAIL: expected energy ${args.energy} via a successful tool call and a text reply`
				);
				exitCode = 1;
			} else {
				console.log(
					`PASS: fake model call → set_energy → /api/dj/energy → energy ${after.energy} (${fake?.calls.join(' → ')})`
				);
			}
		} else if (seen.some((e) => e.type === 'error')) {
			exitCode = 1;
		}
	} catch (error) {
		console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
		exitCode = 1;
	} finally {
		await runtime.shutdown();
		fake?.close();
	}
	return exitCode;
}

main().then(
	(code) => process.exit(code),
	(error) => {
		console.error(error);
		process.exit(1);
	}
);
