// src/lib/dj/agent-client.ts
//
// Browser helpers for /api/agent/* — the chat panel's only door to the agent.
// The chat endpoint streams server-sent events; EventSource cannot POST, so we
// read the fetch body and split frames ourselves (parseSseBuffer is pure).

import type { AgentStatus, ConductorEvent } from '$lib/agent/events';

export function newAgentSessionId(): string {
	const raw =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().replaceAll('-', '')
			: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
	return `web-${raw.slice(0, 24)}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
	try {
		const body: unknown = await res.json();
		return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

export async function fetchAgentStatus(fetchImpl: typeof fetch = fetch): Promise<AgentStatus> {
	const res = await fetchImpl('/api/agent/status');
	const body = await readJson(res);
	if (!res.ok)
		throw new Error(typeof body.error === 'string' ? body.error : `status ${res.status}`);
	return body as unknown as AgentStatus;
}

export async function restartAgent(fetchImpl: typeof fetch = fetch): Promise<AgentStatus> {
	const res = await fetchImpl('/api/agent/restart', { method: 'POST' });
	const body = await readJson(res);
	if (!res.ok)
		throw new Error(typeof body.error === 'string' ? body.error : `restart ${res.status}`);
	return body as unknown as AgentStatus;
}

/**
 * Split a growing SSE text buffer into complete `data:` frames. Returns the
 * parsed events and whatever partial frame is left for the next chunk.
 */
export function parseSseBuffer(buffer: string): { events: ConductorEvent[]; rest: string } {
	const events: ConductorEvent[] = [];
	let rest = buffer.replaceAll('\r\n', '\n');
	let boundary = rest.indexOf('\n\n');
	while (boundary >= 0) {
		const frame = rest.slice(0, boundary);
		rest = rest.slice(boundary + 2);
		const data = frame
			.split('\n')
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trimStart())
			.join('\n');
		if (data) {
			try {
				const parsed: unknown = JSON.parse(data);
				if (
					parsed &&
					typeof parsed === 'object' &&
					typeof (parsed as { type?: unknown }).type === 'string'
				) {
					events.push(parsed as ConductorEvent);
				}
			} catch {
				/* skip malformed frame */
			}
		}
		boundary = rest.indexOf('\n\n');
	}
	return { events, rest };
}

export interface StreamAgentChatOptions {
	signal?: AbortSignal;
	fetchImpl?: typeof fetch;
}

/**
 * POST one message and deliver every ConductorEvent until the stream ends.
 * Rejects on a non-2xx response (offline agent, bad input) with its message.
 */
export async function streamAgentChat(
	input: { text: string; sessionId: string },
	onEvent: (event: ConductorEvent) => void,
	opts: StreamAgentChatOptions = {}
): Promise<void> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const res = await fetchImpl('/api/agent/chat', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ text: input.text, session_id: input.sessionId }),
		signal: opts.signal
	});
	if (!res.ok || !res.body) {
		const body = await readJson(res);
		throw new Error(typeof body.error === 'string' ? body.error : `agent chat ${res.status}`);
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const parsed = parseSseBuffer(buffer);
		buffer = parsed.rest;
		for (const event of parsed.events) onEvent(event);
	}
	buffer += decoder.decode();
	if (buffer.trim()) {
		for (const event of parseSseBuffer(`${buffer}\n\n`).events) onEvent(event);
	}
}
