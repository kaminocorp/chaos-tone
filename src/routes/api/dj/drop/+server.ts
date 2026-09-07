import type { RequestHandler } from './$types';
import { drop } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** drop — peak energy lift. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(drop(parseMeta(body)));
};
