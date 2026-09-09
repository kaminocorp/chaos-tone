// src/lib/agent/events.ts
//
// Shared vocabulary between the server runtime and the browser: the harness's
// durable session events are folded into a small ConductorEvent stream that
// the chat panel renders. Pure functions only (unit-tested). No node imports,
// so the browser can import the types and helpers directly.

export const VDJ_TOOL_PREFIX = 'mcp__vdj__';

export type ConductorEvent =
	| { type: 'status'; status: 'running' | 'idle' }
	| { type: 'text'; delta: string }
	| { type: 'assistant'; text: string }
	| { type: 'tool-call'; callId: string; tool: string; args: Record<string, unknown> | string }
	| {
			type: 'tool-result';
			callId: string;
			tool: string;
			ok: boolean;
			summary: string;
			/** DJ session snapshot when the verb returned one (lets the UI adopt it). */
			session?: Record<string, unknown>;
	  }
	| { type: 'error'; message: string; code?: string }
	| { type: 'done'; text: string };

export type ConductorEventType = ConductorEvent['type'];

export type AgentRuntimeState = 'offline' | 'stopped' | 'starting' | 'ready' | 'error';

/** What /api/agent/status reports; also the runtime's self-description. */
export interface AgentStatus {
	configured: boolean;
	provider: string;
	model: string;
	reasoning: string | null;
	state: AgentRuntimeState;
	error: string | null;
	/** Tool names the model can call, learned from the first request header. */
	tools: string[];
	sessions: number;
}

/** Minimal view of a harness `session.event` payload (structural, not imported). */
export interface RawSessionEvent {
	type: string;
	data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function displayToolName(name: string): string {
	return name.startsWith(VDJ_TOOL_PREFIX) ? name.slice(VDJ_TOOL_PREFIX.length) : name;
}

export function parseToolArguments(raw: unknown): Record<string, unknown> | string {
	if (isRecord(raw)) return raw;
	if (typeof raw !== 'string') return '';
	try {
		const parsed: unknown = JSON.parse(raw);
		return isRecord(parsed) ? parsed : raw;
	} catch {
		return raw;
	}
}

function textOfBlocks(content: unknown): string {
	if (!Array.isArray(content)) return '';
	return content
		.map((block) =>
			isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''
		)
		.join('');
}

export const TOOL_SUMMARY_MAX = 240;
const SEP = ' · ';

/** Compact one-line description of a tool result for the transcript. */
export function summarizeToolResult(text: string, isError: boolean): string {
	const trimmed = text.trim();
	if (!trimmed) return isError ? 'failed' : 'ok';
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (isRecord(parsed)) {
			const parts: string[] = [];
			if (parsed.ok === false || isError) {
				parts.push(typeof parsed.error === 'string' ? parsed.error : 'failed');
			} else {
				parts.push(parsed.replayed === true ? 'replayed' : 'ok');
			}
			const session = isRecord(parsed.session) ? parsed.session : null;
			if (session) {
				if (typeof session.energy === 'number') parts.push(`energy ${session.energy.toFixed(2)}`);
				if (typeof session.bpm === 'number') parts.push(`bpm ${session.bpm}`);
				if (typeof session.phase === 'string') parts.push(session.phase);
				if (typeof session.revision === 'number') parts.push(`rev ${session.revision}`);
			}
			if (Array.isArray(parsed.stems)) parts.push(`${parsed.stems.length} stems`);
			return parts.join(SEP);
		}
	} catch {
		/* not JSON: fall through to plain text */
	}
	const oneLine = trimmed.replace(/\s+/g, ' ');
	return oneLine.length > TOOL_SUMMARY_MAX ? `${oneLine.slice(0, TOOL_SUMMARY_MAX - 1)}…` : oneLine;
}

/** Pull the DJ session object out of a verb's JSON text result, if any. */
export function sessionFromToolText(text: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(text);
		if (
			isRecord(parsed) &&
			isRecord(parsed.session) &&
			typeof parsed.session.revision === 'number'
		) {
			return parsed.session;
		}
	} catch {
		/* not JSON */
	}
	return undefined;
}

/**
 * Fold one durable harness session event into zero or more ConductorEvents.
 * Unknown event types produce nothing (the harness vocabulary is merge-extensible).
 */
export function mapSessionEvent(event: RawSessionEvent): ConductorEvent[] {
	const data = isRecord(event.data) ? event.data : {};
	switch (event.type) {
		case 'assistant/chunk': {
			const chunk = isRecord(data.chunk) ? data.chunk : null;
			if (chunk?.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text) {
				return [{ type: 'text', delta: chunk.text }];
			}
			return [];
		}
		case 'assistant/message': {
			const message = isRecord(data.message) ? data.message : null;
			const text = textOfBlocks(message?.content).trim();
			return text ? [{ type: 'assistant', text }] : [];
		}
		case 'tool/call': {
			const name = typeof data.name === 'string' ? data.name : 'tool';
			return [
				{
					type: 'tool-call',
					callId: typeof data.callId === 'string' ? data.callId : '',
					tool: displayToolName(name),
					args: parseToolArguments(data.arguments)
				}
			];
		}
		case 'tool/result': {
			const message = isRecord(data.message) ? data.message : null;
			const first = Array.isArray(message?.content) ? message.content[0] : null;
			const resultBlock = isRecord(first) ? first : null;
			const isError = resultBlock?.isError === true;
			const text = textOfBlocks(resultBlock?.content);
			const source = isRecord(message?.source) ? message.source : null;
			const callId = typeof source?.callId === 'string' ? source.callId : '';
			const errorCode =
				isRecord(data.error) && typeof data.error.code === 'string' ? data.error.code : '';
			const summary = summarizeToolResult(text || errorCode, isError);
			const session = isError ? undefined : sessionFromToolText(text);
			return [
				{
					type: 'tool-result',
					callId,
					tool: '',
					ok: !isError,
					summary,
					...(session ? { session } : {})
				}
			];
		}
		case 'turn/end': {
			const reason = isRecord(data.reason) ? data.reason : null;
			if (reason?.kind === 'error') {
				const error = isRecord(reason.error) ? reason.error : null;
				const message = typeof error?.message === 'string' ? error.message : 'agent turn failed';
				const code = typeof error?.code === 'string' ? error.code : undefined;
				return [{ type: 'error', message, ...(code ? { code } : {}) }];
			}
			if (reason?.kind === 'aborted') {
				return [{ type: 'error', message: 'agent turn was aborted' }];
			}
			return [];
		}
		default:
			return [];
	}
}

/** Human-readable hint for the most common failure codes. */
export function friendlyAgentError(message: string, code?: string): string {
	const m = message.toLowerCase();
	if (code === 'AUTH' || m.includes('401') || m.includes('missing authentication')) {
		return 'OpenRouter rejected the key. Check OPENROUTER_API_KEY in .env and restart the dev server.';
	}
	if (m.includes('missing_credential')) {
		return 'No OpenRouter key reached the agent. Set OPENROUTER_API_KEY in .env and restart.';
	}
	if (m.includes('unknown_model')) {
		return 'The model id is not configured. Check VDJ_AGENT_MODEL.';
	}
	if (code === 'RATE_LIMIT' || m.includes('429')) {
		return 'OpenRouter is rate limiting this key. Try again in a moment.';
	}
	return message;
}
