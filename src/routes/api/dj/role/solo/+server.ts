import type { RequestHandler } from './$types';
import { soloRole } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** solo_role — body: { role, solo: boolean, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const role = typeof body.role === 'string' ? body.role : '';
	const solo = Boolean(body.solo);
	return mutateResponse(soloRole(role, solo, parseMeta(body)));
};
