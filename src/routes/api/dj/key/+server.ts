import type { RequestHandler } from './$types';
import { setKey } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_key — body: { key, if_revision?, client_op_id?, bars? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const key = typeof body.key === 'string' ? body.key : '';
	return mutateResponse(setKey(key, parseMeta(body)));
};
