/**
 * Thin HTTP client: MCP tool args → chaos-tone /api/dj/* routes.
 * Session SoT stays in the running Vite/SvelteKit app.
 */

export type FetchLike = (
	input: string,
	init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export interface DjClientOptions {
	baseUrl?: string;
	fetchImpl?: FetchLike;
	/** Override op-id factory (tests). */
	newOpId?: () => string;
}

export interface MutateArgs {
	if_revision?: number;
	client_op_id?: string;
	bars?: number;
}

export interface DjHttpResult {
	ok: boolean;
	status: number;
	conflict: boolean;
	body: unknown;
	error?: string;
	session?: unknown;
}

function defaultBaseUrl(): string {
	const raw = process.env.VDJ_BASE_URL ?? 'http://localhost:5173';
	return raw.replace(/\/$/, '');
}

function defaultOpId(): string {
	return `mcp-${crypto.randomUUID()}`;
}

export function createDjHttpClient(opts: DjClientOptions = {}) {
	const baseUrl = (opts.baseUrl ?? defaultBaseUrl()).replace(/\/$/, '');
	const fetchImpl: FetchLike = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
	const newOpId = opts.newOpId ?? defaultOpId;

	function withMeta<T extends MutateArgs>(args: T): T & { client_op_id: string } {
		const client_op_id =
			typeof args.client_op_id === 'string' && args.client_op_id.length > 0
				? args.client_op_id
				: newOpId();
		return { ...args, client_op_id };
	}

	async function request(
		method: 'GET' | 'POST',
		path: string,
		body?: Record<string, unknown>
	): Promise<DjHttpResult> {
		const url = `${baseUrl}${path}`;
		const init: { method: string; headers?: Record<string, string>; body?: string } = {
			method
		};
		if (body !== undefined) {
			init.headers = { 'content-type': 'application/json' };
			init.body = JSON.stringify(body);
		}

		let status = 0;
		let parsed: unknown;
		try {
			const res = await fetchImpl(url, init);
			status = res.status;
			parsed = await res.json();
		} catch (err) {
			return {
				ok: false,
				status: 0,
				conflict: false,
				error: err instanceof Error ? err.message : String(err),
				body: { ok: false, error: 'fetch failed' }
			};
		}

		const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		const conflict = status === 409;
		const ok = status >= 200 && status < 300 && obj.ok !== false;
		const error =
			typeof obj.error === 'string'
				? obj.error
				: conflict
					? 'revision conflict (409)'
					: !ok
						? `HTTP ${status}`
						: undefined;

		return {
			ok,
			status,
			conflict,
			error,
			session: obj.session,
			body: parsed
		};
	}

	return {
		baseUrl,

		intent(args: MutateArgs & { text: string }) {
			return request('POST', '/api/dj/intent', withMeta(args) as Record<string, unknown>);
		},

		session_get() {
			return request('GET', '/api/dj/session');
		},

		session_start(args: MutateArgs = {}) {
			return request('POST', '/api/dj/session/start', withMeta(args) as Record<string, unknown>);
		},

		session_stop(args: MutateArgs = {}) {
			return request('POST', '/api/dj/session/stop', withMeta(args) as Record<string, unknown>);
		},

		set_energy(args: MutateArgs & { energy: number }) {
			return request('POST', '/api/dj/energy', withMeta(args) as Record<string, unknown>);
		},

		set_bpm(args: MutateArgs & { bpm: number }) {
			return request('POST', '/api/dj/bpm', withMeta(args) as Record<string, unknown>);
		},

		swap_role(args: MutateArgs & { role: string; stem_id?: string | null }) {
			return request('POST', '/api/dj/role/swap', withMeta(args) as Record<string, unknown>);
		},

		mute_role(args: MutateArgs & { role: string; mute: boolean }) {
			return request('POST', '/api/dj/role/mute', withMeta(args) as Record<string, unknown>);
		},

		solo_role(args: MutateArgs & { role: string; solo: boolean }) {
			return request('POST', '/api/dj/role/solo', withMeta(args) as Record<string, unknown>);
		},

		set_role_gain(args: MutateArgs & { role: string; gain: number }) {
			return request('POST', '/api/dj/role/gain', withMeta(args) as Record<string, unknown>);
		},

		set_role_filter(args: MutateArgs & { role: string; filter: number }) {
			return request('POST', '/api/dj/role/filter', withMeta(args) as Record<string, unknown>);
		},

		transition(args: MutateArgs & { bars: number }) {
			return request('POST', '/api/dj/transition', withMeta(args) as Record<string, unknown>);
		},

		drop(args: MutateArgs = {}) {
			return request('POST', '/api/dj/drop', withMeta(args) as Record<string, unknown>);
		},

		break(args: MutateArgs = {}) {
			return request('POST', '/api/dj/break', withMeta(args) as Record<string, unknown>);
		},

		emergency_stop(args: MutateArgs = {}) {
			return request(
				'POST',
				'/api/dj/emergency-stop',
				withMeta(args) as Record<string, unknown>
			);
		},

		library_search(args: { q?: string; role?: string; limit?: number } = {}) {
			const params = new URLSearchParams();
			if (args.q) params.set('q', args.q);
			if (args.role) params.set('role', args.role);
			if (args.limit !== undefined) params.set('limit', String(args.limit));
			const qs = params.toString();
			return request('GET', `/api/dj/library/search${qs ? `?${qs}` : ''}`);
		}
	};
}

export type DjHttpClient = ReturnType<typeof createDjHttpClient>;

/** Format tool result for MCP text content; 409 conflicts called out clearly. */
export function formatToolResult(result: DjHttpResult): {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
} {
	if (result.conflict) {
		const text = JSON.stringify(
			{
				ok: false,
				status: 409,
				error: result.error ?? 'revision conflict',
				hint: 'Pass if_revision from the latest session_get (or previous success). Idempotent retries with the same client_op_id may still succeed.',
				session: result.session,
				body: result.body
			},
			null,
			2
		);
		return { content: [{ type: 'text', text }], isError: true };
	}

	const text = JSON.stringify(result.body ?? result, null, 2);
	return {
		content: [{ type: 'text', text }],
		...(result.ok ? {} : { isError: true })
	};
}
