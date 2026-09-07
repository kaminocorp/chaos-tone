import type { RequestHandler } from './$types';
import { swapRole } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** swap_role — body: { role, stem_id | stemId, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const role = typeof body.role === 'string' ? body.role : '';
	const stemRaw = body.stem_id ?? body.stemId ?? null;
	const stemId = typeof stemRaw === 'string' ? stemRaw : null;
	return mutateResponse(swapRole(role, stemId, parseMeta(body)));
};
