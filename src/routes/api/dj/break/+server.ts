import type { RequestHandler } from './$types';
import { breakDown } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** break — energy dip + duck bright roles. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(breakDown(parseMeta(body)));
};
