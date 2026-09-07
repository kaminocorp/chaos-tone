import type { RequestHandler } from './$types';
import { setPhase } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_phase — body: { phase, if_revision?, client_op_id?, bars? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const phase = typeof body.phase === 'string' ? body.phase : '';
	return mutateResponse(setPhase(phase, parseMeta(body)));
};
