// src/lib/dj/library.ts
//
// Stub library search — returns placeholder stem ids shaped for future WAVs.
 // No real purchased stems yet.

import { ROLE_IDS, type RoleId, isRoleId } from './session';

export interface LibraryStem {
	id: string;
	role: RoleId;
	label: string;
	bpm: number;
	key: string;
	/** Relative path once real WAVs land under library/ */
	path: string | null;
	placeholder: true;
}

const CATALOG: LibraryStem[] = ROLE_IDS.flatMap((role) =>
	['a', 'b', 'dark', 'bright'].map((tag) => ({
		id: `placeholder-${role}-${tag}`,
		role,
		label: `${role} ${tag} (placeholder)`,
		bpm: tag === 'dark' ? 120 : tag === 'bright' ? 126 : 122,
		key: tag === 'dark' ? 'Am' : tag === 'bright' ? 'Em' : 'Am',
		path: null,
		placeholder: true as const
	}))
);

export interface LibrarySearchQuery {
	q?: string;
	role?: string;
	limit?: number;
}

export interface LibrarySearchResult {
	ok: true;
	query: { q: string; role: string | null; limit: number };
	stems: LibraryStem[];
	note: string;
}

export function librarySearch(query: LibrarySearchQuery = {}): LibrarySearchResult {
	const q = (query.q ?? '').trim().toLowerCase();
	const roleFilter =
		typeof query.role === 'string' && isRoleId(query.role) ? (query.role as RoleId) : null;
	const limit = Math.min(50, Math.max(1, Math.floor(query.limit ?? 12)));

	let stems = CATALOG.slice();
	if (roleFilter) {
		stems = stems.filter((s) => s.role === roleFilter);
	}
	if (q) {
		stems = stems.filter(
			(s) =>
				s.id.includes(q) ||
				s.label.toLowerCase().includes(q) ||
				s.role.includes(q) ||
				s.key.toLowerCase().includes(q)
		);
	}

	return {
		ok: true,
		query: { q, role: roleFilter, limit },
		stems: stems.slice(0, limit),
		note: 'Stub catalog — swap path fields for real WAVs under library/ later. MCP next.'
	};
}
