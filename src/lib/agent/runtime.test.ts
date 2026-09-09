import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAgentConfig } from './config';
import {
	AgentRuntime,
	getAgentRuntime,
	resetAgentRuntimeForTests,
	type ConductorEventSink,
	type HarnessFactory,
	type HarnessLaunchOptions,
	type HarnessNotificationLike
} from './runtime';
import type { ConductorEvent } from './events';

const config = resolveAgentConfig(
	{ OPENROUTER_API_KEY: 'sk-or-test', VDJ_AGENT_MODEL: 'deepseek/deepseek-v4-flash' },
	{ cwd: '/repo' }
);

function scripted(
	events: (sessionId: string) => HarnessNotificationLike[],
	finalResponse = 'Done.'
) {
	const launches: HarnessLaunchOptions[] = [];
	const closed = vi.fn(async () => {});
	const runs: string[] = [];
	const factory: HarnessFactory = (options) => {
		launches.push(options);
		return {
			start: async () => {},
			close: closed,
			session: (id: string) => ({
				run: async (input: string, opts) => {
					runs.push(`${id}:${input}`);
					for (const n of events(id)) opts?.onNotification?.(n);
					return { finalResponse };
				}
			})
		};
	};
	return { factory, launches, closed, runs };
}

function sessionEvent(sessionId: string, type: string, data: unknown): HarnessNotificationLike {
	return { method: 'session.event', params: { sessionId, event: { type, data } } };
}

beforeEach(() => resetAgentRuntimeForTests());

describe('AgentRuntime', () => {
	it('reports offline without a key and refuses to start', async () => {
		const runtime = new AgentRuntime(resolveAgentConfig({}, { cwd: '/repo' }), {
			createHarness: async () => () => {
				throw new Error('should not launch');
			},
			log: () => {}
		});
		expect(runtime.status().state).toBe('offline');
		await expect(runtime.ensureStarted()).rejects.toThrow(/OPENROUTER_API_KEY/);
	});

	it('launches once with the DJ overlay, child env and reasoning, and streams mapped events', async () => {
		const { factory, launches, runs } = scripted((id) => [
			{ method: 'session.status', params: { sessionId: id, status: 'running' } },
			sessionEvent(id, 'request/header', {
				header: { tools: [{ name: 'mcp__vdj__set_energy' }, { name: 'mcp__vdj__drop' }] }
			}),
			sessionEvent(id, 'tool/call', {
				callId: 'c1',
				name: 'mcp__vdj__set_energy',
				arguments: '{"energy":0.2}'
			}),
			sessionEvent(id, 'assistant/chunk', { chunk: { type: 'text-delta', text: 'Darker.' } }),
			sessionEvent(id, 'assistant/message', {
				message: { content: [{ type: 'text', text: 'Darker.' }] }
			}),
			sessionEvent('other-session', 'assistant/message', {
				message: { content: [{ type: 'text', text: 'ignored' }] }
			}),
			{ method: 'session.status', params: { sessionId: id, status: 'idle' } }
		]);
		const runtime = new AgentRuntime(config, {
			createHarness: async () => factory,
			env: { PATH: '/bin', VDJ_OPENROUTER_BASE_URL: 'stale' },
			log: () => {}
		});
		const seen: ConductorEvent[] = [];
		const result = await runtime.chat('web-1', 'take it darker', (e) => seen.push(e), {
			appBaseUrl: 'http://localhost:5199'
		});

		expect(result.text).toBe('Done.');
		expect(launches).toHaveLength(1);
		const launch = launches[0]!;
		expect(launch.profile).toBe('sdk');
		expect(launch.patches).toEqual(['/repo/agent/vdj.cordis.patch.yml']);
		expect(launch.dshHome).toBe('/repo/.dsh');
		expect(launch.processCwd).toBe('/repo');
		expect(launch.reasoningEffort).toBe('off');
		expect(launch.env.OPENROUTER_API_KEY).toBe('sk-or-test');
		expect(launch.env.VDJ_BASE_URL).toBe('http://localhost:5199');
		expect(launch.env.VDJ_REPO_ROOT).toBe('/repo');
		expect(launch.env.DSH_TELEMETRY_DISABLED).toBe('1');
		expect(launch.env.VDJ_OPENROUTER_BASE_URL).toBeUndefined();
		expect(launch.env.PATH).toBe('/bin');
		expect(runs).toEqual(['web-1-g1:take it darker']);

		expect(seen.map((e) => e.type)).toEqual([
			'status',
			'tool-call',
			'text',
			'assistant',
			'status',
			'done'
		]);
		expect(runtime.status()).toMatchObject({
			state: 'ready',
			tools: ['mcp__vdj__drop', 'mcp__vdj__set_energy'],
			sessions: 1
		});
	});

	it('serializes turns per conversation and starts a new harness session after reset', async () => {
		const { factory, runs } = scripted(() => []);
		const runtime = new AgentRuntime(config, { createHarness: async () => factory, log: () => {} });
		const sink: ConductorEventSink = () => {};
		await Promise.all([runtime.chat('web-2', 'one', sink), runtime.chat('web-2', 'two', sink)]);
		runtime.reset('web-2');
		await runtime.chat('web-2', 'three', sink);
		expect(runs).toEqual(['web-2-g1:one', 'web-2-g1:two', 'web-2-g2:three']);
	});

	it('records a start failure and lets the next chat retry', async () => {
		let attempts = 0;
		const factory: HarnessFactory = () => ({
			start: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error('plugin tree failed to load');
			},
			close: async () => {},
			session: () => ({ run: async () => ({ finalResponse: 'ok' }) })
		});
		const runtime = new AgentRuntime(config, { createHarness: async () => factory, log: () => {} });
		await expect(runtime.chat('web-3', 'hi', () => {})).rejects.toThrow(/plugin tree/);
		expect(runtime.status()).toMatchObject({ state: 'error', error: 'plugin tree failed to load' });
		const result = await runtime.chat('web-3', 'hi again', () => {});
		expect(result.text).toBe('ok');
		expect(runtime.status().state).toBe('ready');
	});

	it('reaps the subprocess when the transport dies and restarts lazily', async () => {
		let launches = 0;
		const closed = vi.fn(async () => {});
		const factory: HarnessFactory = () => {
			launches += 1;
			const dieOnce = launches === 1;
			return {
				start: async () => {},
				close: closed,
				session: () => ({
					run: async () => {
						if (dieOnce) {
							const error = new Error('runtime exited 1');
							error.name = 'TransportClosedError';
							throw error;
						}
						return { finalResponse: 'back' };
					}
				})
			};
		};
		const runtime = new AgentRuntime(config, { createHarness: async () => factory, log: () => {} });
		const seen: ConductorEvent[] = [];
		await expect(runtime.chat('web-4', 'hi', (e) => seen.push(e))).rejects.toThrow(/exited/);
		expect(seen.at(-1)).toEqual({ type: 'error', message: 'runtime exited 1' });
		expect(closed).toHaveBeenCalledTimes(1);
		expect(runtime.status().state).toBe('error');
		const result = await runtime.chat('web-4', 'again', () => {});
		expect(result.text).toBe('back');
		expect(launches).toBe(2);
	});

	it('getAgentRuntime reuses the runtime for the same config and retires it on change', async () => {
		const closed = vi.fn(async () => {});
		const factory: HarnessFactory = () => ({
			start: async () => {},
			close: closed,
			session: () => ({ run: async () => ({ finalResponse: '' }) })
		});
		const deps = { createHarness: async () => factory, log: () => {} };
		const a = getAgentRuntime(config, deps);
		await a.chat('s', 'x', () => {});
		expect(getAgentRuntime(config, deps)).toBe(a);
		const b = getAgentRuntime(
			resolveAgentConfig({ OPENROUTER_API_KEY: 'other' }, { cwd: '/repo' }),
			deps
		);
		expect(b).not.toBe(a);
		await Promise.resolve();
		expect(closed).toHaveBeenCalledTimes(1);
	});
});
