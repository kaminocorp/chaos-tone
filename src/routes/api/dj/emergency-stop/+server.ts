import type { RequestHandler } from './$types';
import { emergencyStop } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** emergency_stop — mute all, idle, energy 0. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	return mutateResponse(emergencyStop(parseMeta(body)));
};
