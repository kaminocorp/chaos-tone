import { describe, it, expect, vi } from 'vitest';
import { createDjHttpClient, formatToolResult } from './client';

function mockFetch(status: number, body: unknown) {
	return vi.fn(async (_url: string, _init?: unknown) => ({
		status,
		json: async () => body
	}));
}

describe('createDjHttpClient tool→HTTP mapping', () => {
	it('session_get GETs /api/dj/session', async () => {
		const fetchImpl = mockFetch(200, { ok: true, session: { revision: 1 } });
		const client = createDjHttpClient({
			baseUrl: 'http://localhost:5173',
			fetchImpl
		});
		const r = await client.session_get();
		expect(r.ok).toBe(true);
		expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5173/api/dj/session', {
			method: 'GET'
		});
	});

	it('intent POSTs /api/dj/intent and auto-fills client_op_id', async () => {
		const fetchImpl = mockFetch(200, { ok: true, verb: 'set_energy' });
		const client = createDjHttpClient({
			baseUrl: 'http://vdj.test',
			fetchImpl,
			newOpId: () => 'auto-op-1'
		});
		await client.intent({ text: 'take it darker', if_revision: 3 });
		expect(fetchImpl).toHaveBeenCalledWith('http://vdj.test/api/dj/intent', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				text: 'take it darker',
				if_revision: 3,
				client_op_id: 'auto-op-1'
			})
		});
	});

	it('preserves explicit client_op_id', async () => {
		const fetchImpl = mockFetch(200, { ok: true });
		const client = createDjHttpClient({
			baseUrl: 'http://vdj.test',
			fetchImpl,
			newOpId: () => 'should-not-use'
		});
		await client.set_bpm({ bpm: 126, client_op_id: 'explicit-1' });
		const body = JSON.parse((fetchImpl.mock.calls[0]![1] as { body: string }).body);
		expect(body.client_op_id).toBe('explicit-1');
		expect(body.bpm).toBe(126);
	});

	it('maps mute/swap/energy/transition/drop/break/emergency_stop paths', async () => {
		const fetchImpl = mockFetch(200, { ok: true });
		const client = createDjHttpClient({
			baseUrl: 'http://vdj.test',
			fetchImpl,
			newOpId: () => 'op'
		});

		await client.mute_role({ role: 'hats', mute: true });
		await client.swap_role({ role: 'kick', stem_id: 'placeholder-kick-a' });
		await client.set_energy({ energy: 0.7 });
		await client.transition({ bars: 8 });
		await client.drop({});
		await client.break({});
		await client.emergency_stop({});
		await client.solo_role({ role: 'bass', solo: true });
		await client.set_role_gain({ role: 'bass', gain: 0.5 });
		await client.set_role_filter({ role: 'hats', filter: 0.2 });
		await client.session_start({});
		await client.session_stop({});

		const urls = fetchImpl.mock.calls.map((c) => c[0] as string);
		expect(urls).toEqual([
			'http://vdj.test/api/dj/role/mute',
			'http://vdj.test/api/dj/role/swap',
			'http://vdj.test/api/dj/energy',
			'http://vdj.test/api/dj/transition',
			'http://vdj.test/api/dj/drop',
			'http://vdj.test/api/dj/break',
			'http://vdj.test/api/dj/emergency-stop',
			'http://vdj.test/api/dj/role/solo',
			'http://vdj.test/api/dj/role/gain',
			'http://vdj.test/api/dj/role/filter',
			'http://vdj.test/api/dj/session/start',
			'http://vdj.test/api/dj/session/stop'
		]);
	});

	it('library_search builds query string', async () => {
		const fetchImpl = mockFetch(200, { ok: true, stems: [] });
		const client = createDjHttpClient({ baseUrl: 'http://vdj.test', fetchImpl });
		await client.library_search({ role: 'kick', limit: 3, q: 'dark' });
		expect(fetchImpl.mock.calls[0]![0]).toBe(
			'http://vdj.test/api/dj/library/search?q=dark&role=kick&limit=3'
		);
	});

	it('surfaces 409 as conflict', async () => {
		const fetchImpl = mockFetch(409, {
			ok: false,
			error: 'revision mismatch',
			session: { revision: 9 }
		});
		const client = createDjHttpClient({
			baseUrl: 'http://vdj.test',
			fetchImpl,
			newOpId: () => 'op'
		});
		const r = await client.set_energy({ energy: 0.5, if_revision: 1 });
		expect(r.ok).toBe(false);
		expect(r.conflict).toBe(true);
		expect(r.status).toBe(409);
		const formatted = formatToolResult(r);
		expect(formatted.isError).toBe(true);
		expect(formatted.content[0]!.text).toContain('409');
		expect(formatted.content[0]!.text).toContain('revision');
	});

	it('strips trailing slash from baseUrl', async () => {
		const fetchImpl = mockFetch(200, { ok: true });
		const client = createDjHttpClient({
			baseUrl: 'http://vdj.test/',
			fetchImpl
		});
		await client.session_get();
		expect(fetchImpl.mock.calls[0]![0]).toBe('http://vdj.test/api/dj/session');
	});
});
