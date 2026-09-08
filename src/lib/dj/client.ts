// src/lib/dj/client.ts
//
// Browser helpers for /api/dj/* — same verbs MCP uses. No parallel brain.

import { formatConflictError } from './instrument-view';
import type { DjSession, RoleId } from './session';

export type DjClientResult = {
	ok: boolean;
	status: number;
	conflict: boolean;
	session?: DjSession;
	error?: string;
	replayed?: boolean;
	verb?: string;
};

export function newClientOpId(prefix: string): string {
	const id =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	return `${prefix}-${id}`;
}

export function interpretDjResponse(status: number, body: unknown): DjClientResult {
	const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	const session = rec.session as DjSession | undefined;
	const rawError = typeof rec.error === 'string' ? rec.error : undefined;
	const conflict = status === 409;
	return {
		ok: status >= 200 && status < 300 && rec.ok !== false,
		status,
		conflict,
		session,
		error: conflict ? formatConflictError(rawError ?? 'revision conflict') : rawError,
		replayed: rec.replayed === true,
		verb: typeof rec.verb === 'string' ? rec.verb : undefined
	};
}

async function readBody(res: Response): Promise<unknown> {
	try {
		return await res.json();
	} catch {
		return {};
	}
}

export async function getDjSession(): Promise<DjSession> {
	const res = await fetch('/api/dj/session');
	const body = (await readBody(res)) as { session?: DjSession };
	if (!res.ok || !body.session) {
		throw new Error(`session_get ${res.status}`);
	}
	return body.session;
}

async function postDj(url: string, payload: Record<string, unknown>): Promise<DjClientResult> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return interpretDjResponse(res.status, await readBody(res));
}

export async function postIntent(
	text: string,
	meta: { if_revision?: number; client_op_id?: string }
): Promise<DjClientResult> {
	return postDj('/api/dj/intent', {
		text,
		if_revision: meta.if_revision,
		client_op_id: meta.client_op_id ?? newClientOpId('intent')
	});
}

export async function postSessionStart(ifRevision?: number): Promise<DjClientResult> {
	return postDj('/api/dj/session/start', {
		if_revision: ifRevision,
		client_op_id: newClientOpId('start')
	});
}

export async function postSessionPause(ifRevision?: number): Promise<DjClientResult> {
	return postDj('/api/dj/session/pause', {
		if_revision: ifRevision,
		client_op_id: newClientOpId('pause')
	});
}

export async function postSessionStop(ifRevision?: number): Promise<DjClientResult> {
	return postDj('/api/dj/session/stop', {
		if_revision: ifRevision,
		client_op_id: newClientOpId('stop')
	});
}

export async function postEnergy(energy: number, ifRevision?: number): Promise<DjClientResult> {
	return postDj('/api/dj/energy', {
		energy,
		if_revision: ifRevision,
		client_op_id: newClientOpId('energy')
	});
}

export async function postMute(
	role: RoleId,
	mute: boolean,
	ifRevision?: number
): Promise<DjClientResult> {
	return postDj('/api/dj/role/mute', {
		role,
		mute,
		if_revision: ifRevision,
		client_op_id: newClientOpId(`mute-${role}`)
	});
}

export async function postBar(by = 1): Promise<void> {
	try {
		await fetch('/api/dj/bar', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ by })
		});
	} catch {
		/* non-fatal heartbeat */
	}
}
