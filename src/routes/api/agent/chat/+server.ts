import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { isValidAgentSessionId, resolveAgentConfig } from '$lib/agent/config';
import type { ConductorEvent } from '$lib/agent/events';
import { getAgentRuntime } from '$lib/agent/runtime';
import { readJsonBody } from '$lib/dj/http';
import { recordLastIntent } from '$lib/dj/session';

const MAX_CHAT_TEXT = 2000;

function sseFrame(event: ConductorEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * agent_chat — body: { text, session_id }. Streams ConductorEvents as
 * server-sent events until the agent is idle. One conversation per session_id;
 * a second message on the same id waits for the first turn.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const config = resolveAgentConfig(env);
	const runtime = getAgentRuntime(config);
	if (!runtime.status().configured) {
		return json(
			{
				ok: false,
				error:
					'agent is offline: set OPENROUTER_API_KEY in .env and restart the dev server (see docs/executing/virtual-dj-agent.md)'
			},
			{ status: 503 }
		);
	}

	const body = await readJsonBody(request);
	const text = typeof body.text === 'string' ? body.text.trim() : '';
	const sessionId = body.session_id;
	if (!text) return json({ ok: false, error: 'text is required' }, { status: 400 });
	if (text.length > MAX_CHAT_TEXT) {
		return json(
			{ ok: false, error: `text must be at most ${MAX_CHAT_TEXT} characters` },
			{ status: 400 }
		);
	}
	if (!isValidAgentSessionId(sessionId)) {
		return json(
			{ ok: false, error: 'session_id must be a short [A-Za-z0-9_-] id' },
			{ status: 400 }
		);
	}

	// The plaque shows what the human asked for, even before any verb lands.
	recordLastIntent(text);

	const encoder = new TextEncoder();
	let closed = false;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const push = (event: ConductorEvent) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(sseFrame(event)));
				} catch {
					closed = true;
				}
			};
			runtime
				.chat(sessionId, text, push, { appBaseUrl: url.origin })
				.catch((error: unknown) => {
					push({
						type: 'error',
						message: error instanceof Error ? error.message : String(error)
					});
				})
				.finally(() => {
					if (!closed) {
						closed = true;
						try {
							controller.close();
						} catch {
							/* already closed by the client */
						}
					}
				});
		},
		cancel() {
			closed = true;
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
