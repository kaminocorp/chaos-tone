import type { RequestHandler } from './$types';
import { setRoleFilter } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_role_filter — body: { role, filter: 0..1, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const role = typeof body.role === 'string' ? body.role : '';
	const filter = typeof body.filter === 'number' ? body.filter : NaN;
	return mutateResponse(setRoleFilter(role, filter, parseMeta(body)));
};
