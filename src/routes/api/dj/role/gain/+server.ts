import type { RequestHandler } from './$types';
import { setRoleGain } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_role_gain — body: { role, gain: 0..1, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const role = typeof body.role === 'string' ? body.role : '';
	const gain = typeof body.gain === 'number' ? body.gain : NaN;
	return mutateResponse(setRoleGain(role, gain, parseMeta(body)));
};
