import { describe, expect, it } from 'vitest';

describe('smoke', () => {
	it('confirms the test harness runs', () => {
		expect(1 + 1).toBe(2);
	});
});
