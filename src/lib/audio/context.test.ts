import { describe, it, expect, vi, beforeEach } from 'vitest';

const startMock = vi.fn(() => Promise.resolve());

// Mock the dynamically-imported 'tone' module.
vi.mock('tone', () => ({ start: startMock }));

beforeEach(() => {
	startMock.mockClear();
	vi.resetModules(); // reset the module-scoped `started`/`tone` singletons
	vi.stubGlobal('window', { AudioContext: class {} });
});

describe('ensureAudioStarted', () => {
	it('calls Tone.start() only once across multiple calls', async () => {
		const { ensureAudioStarted } = await import('./context');
		await ensureAudioStarted();
		await ensureAudioStarted();
		expect(startMock).toHaveBeenCalledTimes(1);
	});
});
