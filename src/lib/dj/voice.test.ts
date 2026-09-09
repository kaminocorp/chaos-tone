import { describe, it, expect } from 'vitest';
import {
	createSpeechInput,
	speechErrorMessage,
	speechRecognitionSupported,
	speechSynthesisSupported,
	speechText,
	transcriptFromResults
} from './voice';

function result(transcript: string, isFinal: boolean) {
	return Object.assign([{ transcript }], { isFinal, length: 1 });
}

describe('transcriptFromResults', () => {
	it('separates interim from final text from resultIndex onward', () => {
		const results = [result('old ', true), result('take it ', true), result('darker', false)];
		expect(transcriptFromResults(results, 1)).toEqual({ interim: 'darker', final: 'take it' });
		expect(transcriptFromResults(results, 0).final).toBe('old take it');
		expect(transcriptFromResults([], 0)).toEqual({ interim: '', final: '' });
	});
});

describe('speechText', () => {
	it('strips markup noise and clamps at a sentence boundary', () => {
		expect(speechText('**Pulled** energy to `0.2`.  Closed the hats.')).toBe(
			'Pulled energy to 0.2. Closed the hats.'
		);
		const long = `${'Energy is down. '.repeat(30)}Tail that will be cut`;
		const spoken = speechText(long, 100);
		expect(spoken.length).toBeLessThanOrEqual(100);
		expect(spoken.endsWith('.')).toBe(true);
	});

	it('adds an ellipsis when no sentence boundary is available', () => {
		const spoken = speechText('x'.repeat(50), 20);
		expect(spoken).toHaveLength(21);
		expect(spoken.endsWith('…')).toBe(true);
	});
});

describe('feature detection outside a browser', () => {
	it('reports no speech support and returns null recognizers', () => {
		expect(speechRecognitionSupported()).toBe(false);
		expect(speechSynthesisSupported()).toBe(false);
		expect(createSpeechInput({ onFinal: () => {} })).toBeNull();
	});

	it('explains common recognition errors', () => {
		expect(speechErrorMessage('not-allowed')).toMatch(/Microphone/);
		expect(speechErrorMessage('audio-capture')).toMatch(/No microphone/);
		expect(speechErrorMessage('weird')).toBe('Speech recognition failed (weird).');
	});
});
