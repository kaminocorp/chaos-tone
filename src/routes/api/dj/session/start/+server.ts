import type { RequestHandler } from './$types';
import { sessionStart } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** session_start — mark session playing (revision CAS + idempotency). */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(sessionStart(parseMeta(body)));
};
