import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { advanceBar } from '$lib/dj/session';
import { readJsonBody } from '$lib/dj/http';

/** Optional bar heartbeat from the deck (keeps server bar in sync). */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const by = typeof body.by === 'number' && body.by > 0 ? Math.floor(body.by) : 1;
	return json({ ok: true, session: advanceBar(by) });
};
