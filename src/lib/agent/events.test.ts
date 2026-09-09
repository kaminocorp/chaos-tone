import { describe, it, expect } from 'vitest';
import {
	displayToolName,
	friendlyAgentError,
	mapSessionEvent,
	parseToolArguments,
	sessionFromToolText,
	summarizeToolResult
} from './events';

const okResult = JSON.stringify({
	ok: true,
	replayed: false,
	session: { revision: 4, energy: 0.15, bpm: 122, phase: 'playing' }
});

describe('mapSessionEvent', () => {
	it('turns text deltas into text events and ignores other chunks', () => {
		expect(
			mapSessionEvent({
				type: 'assistant/chunk',
				data: { chunk: { type: 'text-delta', text: 'Pul' } }
			})
		).toEqual([{ type: 'text', delta: 'Pul' }]);
		expect(
			mapSessionEvent({ type: 'assistant/chunk', data: { chunk: { type: 'usage' } } })
		).toEqual([]);
		expect(
			mapSessionEvent({
				type: 'assistant/chunk',
				data: { chunk: { type: 'text-delta', text: '' } }
			})
		).toEqual([]);
	});

	it('emits the assembled assistant text', () => {
		const events = mapSessionEvent({
			type: 'assistant/message',
			data: { message: { content: [{ type: 'text', text: 'Darker now.' }, { type: 'tool-call' }] } }
		});
		expect(events).toEqual([{ type: 'assistant', text: 'Darker now.' }]);
		expect(
			mapSessionEvent({ type: 'assistant/message', data: { message: { content: [] } } })
		).toEqual([]);
	});

	it('strips the MCP prefix and parses arguments on tool calls', () => {
		const events = mapSessionEvent({
			type: 'tool/call',
			data: { callId: 'c1', name: 'mcp__vdj__set_energy', arguments: '{"energy":0.15}' }
		});
		expect(events).toEqual([
			{ type: 'tool-call', callId: 'c1', tool: 'set_energy', args: { energy: 0.15 } }
		]);
	});

	it('summarizes tool results and surfaces the DJ session snapshot', () => {
		const events = mapSessionEvent({
			type: 'tool/result',
			data: {
				message: {
					source: { kind: 'tool', callId: 'c1' },
					content: [
						{ type: 'tool-result', toolCallId: 'c1', content: [{ type: 'text', text: okResult }] }
					]
				}
			}
		});
		expect(events).toHaveLength(1);
		const event = events[0]!;
		expect(event.type).toBe('tool-result');
		if (event.type !== 'tool-result') return;
		expect(event.ok).toBe(true);
		expect(event.callId).toBe('c1');
		expect(event.summary).toBe('ok · energy 0.15 · bpm 122 · playing · rev 4');
		expect(event.session?.revision).toBe(4);
	});

	it('marks failed tool results and drops the session', () => {
		const events = mapSessionEvent({
			type: 'tool/result',
			data: {
				error: { name: 'McpError', code: 'MCP_TOOL_ERROR' },
				message: {
					source: { kind: 'tool', callId: 'c2' },
					content: [
						{
							type: 'tool-result',
							toolCallId: 'c2',
							isError: true,
							content: [
								{
									type: 'text',
									text: JSON.stringify({
										ok: false,
										error: 'revision conflict',
										session: { revision: 9 }
									})
								}
							]
						}
					]
				}
			}
		});
		const event = events[0]!;
		if (event.type !== 'tool-result') throw new Error('expected tool-result');
		expect(event.ok).toBe(false);
		expect(event.summary).toBe('revision conflict · rev 9');
		expect(event.session).toBeUndefined();
	});

	it('maps turn errors and aborts, ignores clean turn ends', () => {
		expect(
			mapSessionEvent({
				type: 'turn/end',
				data: { reason: { kind: 'error', error: { message: '401 nope', code: 'AUTH' } } }
			})
		).toEqual([{ type: 'error', message: '401 nope', code: 'AUTH' }]);
		expect(mapSessionEvent({ type: 'turn/end', data: { reason: { kind: 'aborted' } } })).toEqual([
			{ type: 'error', message: 'agent turn was aborted' }
		]);
		expect(mapSessionEvent({ type: 'turn/end', data: { reason: { kind: 'completed' } } })).toEqual(
			[]
		);
	});

	it('ignores unknown events', () => {
		expect(mapSessionEvent({ type: 'session/title', data: { title: 'x' } })).toEqual([]);
		expect(mapSessionEvent({ type: 'user/message' })).toEqual([]);
	});
});

describe('helpers', () => {
	it('displayToolName strips only the vdj prefix', () => {
		expect(displayToolName('mcp__vdj__drop')).toBe('drop');
		expect(displayToolName('exit_plan_mode')).toBe('exit_plan_mode');
	});

	it('parseToolArguments handles JSON, objects and junk', () => {
		expect(parseToolArguments('{"a":1}')).toEqual({ a: 1 });
		expect(parseToolArguments({ b: 2 })).toEqual({ b: 2 });
		expect(parseToolArguments('not json')).toBe('not json');
		expect(parseToolArguments('[1]')).toBe('[1]');
		expect(parseToolArguments(undefined)).toBe('');
	});

	it('summarizeToolResult falls back to trimmed plain text', () => {
		expect(summarizeToolResult('', false)).toBe('ok');
		expect(summarizeToolResult('', true)).toBe('failed');
		expect(summarizeToolResult('  plain   text\nhere ', false)).toBe('plain text here');
		expect(summarizeToolResult('x'.repeat(300), false)).toHaveLength(240);
		expect(summarizeToolResult(JSON.stringify({ ok: true, stems: [1, 2, 3] }), false)).toBe(
			'ok · 3 stems'
		);
	});

	it('sessionFromToolText requires a revision', () => {
		expect(sessionFromToolText(okResult)?.energy).toBe(0.15);
		expect(sessionFromToolText('{"session":{}}')).toBeUndefined();
		expect(sessionFromToolText('nope')).toBeUndefined();
	});

	it('friendlyAgentError explains auth and model failures', () => {
		expect(friendlyAgentError('401: Missing Authentication header', 'AUTH')).toMatch(
			/OPENROUTER_API_KEY/
		);
		expect(friendlyAgentError('MISSING_CREDENTIAL for OPENROUTER_API_KEY')).toMatch(
			/No OpenRouter key/
		);
		expect(friendlyAgentError('UNKNOWN_MODEL x')).toMatch(/VDJ_AGENT_MODEL/);
		expect(friendlyAgentError('429 slow down')).toMatch(/rate limiting/);
		expect(friendlyAgentError('something else')).toBe('something else');
	});
});
