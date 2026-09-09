// src/lib/dj/voice.ts
//
// Voice mode for the agent conductor, browser-only and dependency-free:
// Web Speech API recognition for push-to-talk input and speech synthesis for
// reading replies aloud. Chrome (and Chromium) on the Mini is the target;
// Safari and Firefox degrade to text. Pure helpers are unit-tested; the DOM
// wrappers are thin and feature-detected.

export interface SpeechInputEvents {
	onInterim?: (text: string) => void;
	onFinal: (text: string) => void;
	onError?: (message: string) => void;
	onListening?: (listening: boolean) => void;
}

export interface SpeechInput {
	start(): void;
	stop(): void;
	abort(): void;
	readonly listening: boolean;
}

interface RecognitionAlternativeLike {
	transcript: string;
}
interface RecognitionResultLike extends ArrayLike<RecognitionAlternativeLike> {
	isFinal: boolean;
}
interface RecognitionEventLike {
	resultIndex: number;
	results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionErrorLike {
	error?: string;
	message?: string;
}
interface SpeechRecognitionLike {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onresult: ((event: RecognitionEventLike) => void) | null;
	onerror: ((event: RecognitionErrorLike) => void) | null;
	onend: (() => void) | null;
	onstart: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as unknown as {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
	return recognitionCtor() !== null;
}

export function speechSynthesisSupported(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Fold a recognition result list from `resultIndex` into the interim text
 * still being refined and the final text that just settled.
 */
export function transcriptFromResults(
	results: ArrayLike<RecognitionResultLike>,
	resultIndex = 0
): { interim: string; final: string } {
	let interim = '';
	let final = '';
	for (let i = resultIndex; i < results.length; i += 1) {
		const result = results[i];
		const text = result?.[0]?.transcript ?? '';
		if (!text) continue;
		if (result?.isFinal) final += text;
		else interim += text;
	}
	return { interim: interim.trim(), final: final.trim() };
}

/** Push-to-talk recognizer; `null` when the browser has no Web Speech API. */
export function createSpeechInput(
	events: SpeechInputEvents,
	opts: { lang?: string } = {}
): SpeechInput | null {
	const Ctor = recognitionCtor();
	if (!Ctor) return null;
	const recognition = new Ctor();
	recognition.lang = opts.lang ?? 'en-US';
	recognition.continuous = false;
	recognition.interimResults = true;
	recognition.maxAlternatives = 1;
	let listening = false;
	let finalText = '';

	recognition.onstart = () => {
		listening = true;
		finalText = '';
		events.onListening?.(true);
	};
	recognition.onresult = (event) => {
		const { interim, final } = transcriptFromResults(event.results, event.resultIndex);
		if (final) finalText = `${finalText} ${final}`.trim();
		if (interim) events.onInterim?.(interim);
	};
	recognition.onerror = (event) => {
		const code = event.error ?? 'error';
		if (code === 'aborted' || code === 'no-speech') return;
		events.onError?.(speechErrorMessage(code));
	};
	recognition.onend = () => {
		listening = false;
		events.onListening?.(false);
		const text = finalText.trim();
		finalText = '';
		if (text) events.onFinal(text);
	};

	return {
		get listening() {
			return listening;
		},
		start() {
			if (listening) return;
			try {
				recognition.start();
			} catch (error) {
				events.onError?.(error instanceof Error ? error.message : String(error));
			}
		},
		stop() {
			if (listening) recognition.stop();
		},
		abort() {
			finalText = '';
			recognition.abort();
		}
	};
}

export function speechErrorMessage(code: string): string {
	switch (code) {
		case 'not-allowed':
		case 'service-not-allowed':
			return 'Microphone access was blocked. Allow the mic for this site and try again.';
		case 'audio-capture':
			return 'No microphone was found.';
		case 'network':
			return 'Speech recognition needs a network connection in this browser.';
		default:
			return `Speech recognition failed (${code}).`;
	}
}

export const SPEECH_TEXT_MAX = 280;

/** Trim a reply for the speaker: drop markup-ish noise, clamp length. */
export function speechText(text: string, max = SPEECH_TEXT_MAX): string {
	const cleaned = text
		.replace(/[*_`#>]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (cleaned.length <= max) return cleaned;
	const cut = cleaned.slice(0, max);
	const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
	return lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

/** Speak a reply; returns false when synthesis is unavailable or text is empty. */
export function speak(text: string, opts: { rate?: number; lang?: string } = {}): boolean {
	if (!speechSynthesisSupported()) return false;
	const spoken = speechText(text);
	if (!spoken) return false;
	const utterance = new SpeechSynthesisUtterance(spoken);
	utterance.rate = opts.rate ?? 1.05;
	utterance.lang = opts.lang ?? 'en-US';
	window.speechSynthesis.cancel();
	window.speechSynthesis.speak(utterance);
	return true;
}

export function cancelSpeech(): void {
	if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
