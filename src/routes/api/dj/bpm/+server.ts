import type { RequestHandler } from './$types';
import { setBpm } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_bpm — body: { bpm, if_revision?, client_op_id?, bars? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const bpm = typeof body.bpm === 'number' ? body.bpm : NaN;
	return mutateResponse(setBpm(bpm, parseMeta(body)));
};
