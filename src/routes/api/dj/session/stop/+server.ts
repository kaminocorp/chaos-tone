import type { RequestHandler } from './$types';
import { sessionStop } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** session_stop — mark session idle. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(sessionStop(parseMeta(body)));
};
