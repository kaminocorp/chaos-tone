import type { RequestHandler } from './$types';
import { setEnergy } from '$lib/dj/session';
import { mutateResponse, parseMeta, readJsonBody } from '$lib/dj/http';

/** set_energy — body: { energy: 0..1, if_revision?, client_op_id?, bars? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const energy = typeof body.energy === 'number' ? body.energy : NaN;
	return mutateResponse(setEnergy(energy, parseMeta(body)));
};
