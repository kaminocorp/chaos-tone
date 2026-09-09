import { describe, it, expect, vi } from 'vitest';
import {
	fetchAgentStatus,
	newAgentSessionId,
	parseSseBuffer,
	streamAgentChat
} from './agent-client';
import type { ConductorEvent } from '$lib/agent/events';

describe('parseSseBuffer', () => {
	it('parses complete frames and keeps the partial tail', () => {
		const buffer =
			'data: {"type":"status","status":"running"}\n\n' +
			'data: {"type":"text","delta":"Pul"}\n\n' +
			'data: {"type":"text","del';
		const { events, rest } = parseSseBuffer(buffer);
		expect(events).toEqual([
			{ type: 'status', status: 'running' },
			{ type: 'text', delta: 'Pul' }
		]);
		expect(rest).toBe('data: {"type":"text","del');
	});

	it('accepts CRLF, multi-line data and skips junk', () => {
		const buffer =
			'event: x\r\ndata: {"type":"done",\r\ndata: "text":"ok"}\r\n\r\ndata: nope\n\n: comment\n\n';
		const { events, rest } = parseSseBuffer(buffer);
		expect(events).toEqual([{ type: 'done', text: 'ok' }]);
		expect(rest).toBe('');
	});
});

describe('streamAgentChat', () => {
	function streamResponse(chunks: string[], status = 200): Response {
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
				controller.close();
			}
		});
		return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
	}

	it('POSTs the message and delivers events across chunk boundaries', async () => {
		const fetchImpl = vi.fn(async () =>
			streamResponse([
				'data: {"type":"tool-call","callId":"c1","tool":"set_ener',
				'gy","args":{"energy":0.2}}\n\ndata: {"type":"done","text":"Darker."}\n\n'
			])
		) as unknown as typeof fetch;
		const seen: ConductorEvent[] = [];
		await streamAgentChat({ text: 'darker', sessionId: 'web-1' }, (e) => seen.push(e), {
			fetchImpl
		});
		expect(seen.map((e) => e.type)).toEqual(['tool-call', 'done']);
		const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
		expect(call[0]).toBe('/api/agent/chat');
		expect(JSON.parse((call[1] as { body: string }).body)).toEqual({
			text: 'darker',
			session_id: 'web-1'
		});
	});

	it('flushes a final frame without a trailing blank line', async () => {
		const fetchImpl = (async () =>
			streamResponse(['data: {"type":"done","text":"x"}'])) as unknown as typeof fetch;
		const seen: ConductorEvent[] = [];
		await streamAgentChat({ text: 'x', sessionId: 'web-2' }, (e) => seen.push(e), { fetchImpl });
		expect(seen).toEqual([{ type: 'done', text: 'x' }]);
	});

	it('rejects with the server error when the agent is offline', async () => {
		const fetchImpl = (async () =>
			new Response(
				JSON.stringify({ ok: false, error: 'agent is offline: set OPENROUTER_API_KEY' }),
				{
					status: 503,
					headers: { 'content-type': 'application/json' }
				}
			)) as unknown as typeof fetch;
		await expect(
			streamAgentChat({ text: 'x', sessionId: 'web-3' }, () => {}, { fetchImpl })
		).rejects.toThrow(/OPENROUTER_API_KEY/);
	});
});

describe('fetchAgentStatus / ids', () => {
	it('returns the status body', async () => {
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ ok: true, configured: true, state: 'ready', tools: ['a'] }), {
				status: 200
			})) as unknown as typeof fetch;
		const status = await fetchAgentStatus(fetchImpl);
		expect(status.state).toBe('ready');
		expect(status.tools).toEqual(['a']);
	});

	it('mints boring session ids', () => {
		const id = newAgentSessionId();
		expect(id).toMatch(/^web-[a-z0-9]{8,24}$/);
		expect(newAgentSessionId()).not.toBe(id);
	});
});
