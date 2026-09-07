import type { RequestHandler } from './$types';
import { transition } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** transition — body: { bars, if_revision?, client_op_id? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const bars = typeof body.bars === 'number' ? body.bars : NaN;
	return mutateResponse(transition(bars, parseMeta(body)));
};
