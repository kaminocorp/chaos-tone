import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/dj/session';

/** session_get — read current in-memory DJ session. */
export const GET: RequestHandler = () => {
	return json({ ok: true, session: getSession() });
};
