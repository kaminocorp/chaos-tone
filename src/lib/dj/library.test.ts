import { describe, it, expect } from 'vitest';
import { librarySearch } from './library';

describe('librarySearch stub', () => {
	it('returns placeholder stems with API shape', () => {
		const r = librarySearch({ limit: 5 });
		expect(r.ok).toBe(true);
		expect(r.stems.length).toBe(5);
		expect(r.stems[0]?.placeholder).toBe(true);
		expect(r.stems[0]?.id).toMatch(/^placeholder-/);
		expect(r.stems[0]?.path).toBeNull();
	});

	it('filters by role and q', () => {
		const r = librarySearch({ role: 'kick', q: 'dark' });
		expect(r.stems.every((s) => s.role === 'kick')).toBe(true);
		expect(r.stems.some((s) => s.id.includes('dark'))).toBe(true);
	});
});
