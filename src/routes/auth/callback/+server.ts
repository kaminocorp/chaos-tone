import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/*
 * Placeholder magic-link callback. Phase 5 (Authentication Flow) replaces
 * this with the real Supabase session exchange. For now we just bounce
 * back to `/` so the route resolves cleanly during scaffolding.
 */
export const GET: RequestHandler = () => {
	throw redirect(303, '/');
};
