import type { RequestHandler } from './$types';
import { muteRole } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** mute_role — body: { role, mute: boolean, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const role = typeof body.role === 'string' ? body.role : '';
	const mute = Boolean(body.mute);
	return mutateResponse(muteRole(role, mute, parseMeta(body)));
};
