import type { RequestHandler } from './$types';
import { sessionPause } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** session_pause — mark session paused. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(sessionPause(parseMeta(body)));
};
