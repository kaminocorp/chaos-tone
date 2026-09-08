import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { librarySearch } from '$lib/dj/library';
import { readJsonBody } from '$lib/dj/http';

/** library_search — GET ?q=&role=&limit= or POST JSON same fields. Stub stem ids. */
export const GET: RequestHandler = ({ url }) => {
	const q = url.searchParams.get('q') ?? undefined;
	const role = url.searchParams.get('role') ?? undefined;
	const limitRaw = url.searchParams.get('limit');
	const limit = limitRaw ? Number(limitRaw) : undefined;
	return json(librarySearch({ q, role, limit }));
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const q = typeof body.q === 'string' ? body.q : undefined;
	const role = typeof body.role === 'string' ? body.role : undefined;
	const limit = typeof body.limit === 'number' ? body.limit : undefined;
	return json(librarySearch({ q, role, limit }));
};
