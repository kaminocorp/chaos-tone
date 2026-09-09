import { describe, it, expect } from 'vitest';
import { formatConflictError } from './instrument-view';
import { interpretDjResponse, newClientOpId } from './client';

describe('dj HTTP client helpers', () => {
	it('treats 409 as a conflict and keeps the returned session', () => {
		const session = { revision: 4, last_intent: 'take it darker' };
		const parsed = interpretDjResponse(409, {
			ok: false,
			error: 'revision conflict: expected 1, have 4',
			session
		});
		expect(parsed.ok).toBe(false);
		expect(parsed.conflict).toBe(true);
		expect(parsed.session).toEqual(session);
		expect(parsed.error).toBe(formatConflictError('revision conflict: expected 1, have 4'));
	});

	it('passes through a successful mutate', () => {
		const session = { revision: 2 };
		const parsed = interpretDjResponse(200, { ok: true, session, replayed: false });
		expect(parsed.ok).toBe(true);
		expect(parsed.conflict).toBe(false);
		expect(parsed.session).toEqual(session);
	});

	it('mints unique client_op_id values', () => {
		expect(newClientOpId('intent')).not.toBe(newClientOpId('intent'));
		expect(newClientOpId('intent')).toMatch(/^intent-/);
	});
});
