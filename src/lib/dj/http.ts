import { json } from '@sveltejs/kit';
import type { MutateMeta, MutateResult } from './session';

export function parseMeta(body: Record<string, unknown>): MutateMeta {
	const meta: MutateMeta = {};
	if (typeof body.if_revision === 'number') meta.if_revision = body.if_revision;
	if (typeof body.client_op_id === 'string' && body.client_op_id.length > 0) {
		meta.client_op_id = body.client_op_id;
	}
	if (typeof body.bars === 'number') meta.bars = body.bars;
	return meta;
}

export function mutateResponse(result: MutateResult): Response {
	if (result.ok) {
		return json({ ok: true, replayed: result.replayed, session: result.session });
	}
	if (result.status === 409) {
		return json(
			{ ok: false, error: result.error, session: result.session },
			{ status: 409 }
		);
	}
	return json({ ok: false, error: result.error }, { status: 400 });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		if (body && typeof body === 'object' && !Array.isArray(body)) {
			return body as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}
