<script lang="ts">
	import { Mic, Send } from '@lucide/svelte';
	import { onDestroy, onMount, tick } from 'svelte';
	import { friendlyAgentError, type AgentStatus, type ConductorEvent } from '$lib/agent/events';
	import { fetchAgentStatus, newAgentSessionId, streamAgentChat } from '$lib/dj/agent-client';
	import type { DjSession } from '$lib/dj/session';
	import {
		cancelSpeech,
		createSpeechInput,
		speak,
		speechRecognitionSupported,
		speechSynthesisSupported,
		type SpeechInput
	} from '$lib/dj/voice';

	type EntryKind = 'user' | 'agent' | 'tool' | 'error';
	interface Entry {
		id: number;
		kind: EntryKind;
		text: string;
		tool?: string;
		callId?: string;
		ok?: boolean | null;
		result?: string;
		pending?: boolean;
	}

	let {
		deckOn = false,
		onSession
	}: { deckOn?: boolean; onSession?: (session: DjSession) => void } = $props();

	const sessionId = newAgentSessionId();
	let entries = $state<Entry[]>([]);
	let draft = $state('');
	let busy = $state(false);
	let status = $state<AgentStatus | null>(null);
	let hint = $state<string | null>(null);
	let hintIsError = $state(false);
	let listening = $state(false);
	let interim = $state('');
	let speakReplies = $state(false);
	let voiceSupported = $state(false);
	let ttsSupported = $state(false);
	let logEl = $state<HTMLDivElement | undefined>();
	let speech: SpeechInput | null = null;
	let nextId = 1;

	const offline = $derived(status !== null && !status.configured);
	const stateLabel = $derived.by(() => {
		if (!status) return 'checking';
		if (!status.configured) return 'offline';
		if (busy) return 'working';
		return status.state;
	});
	const verbCount = $derived(status?.tools.length ?? 0);
	const placeholder = $derived.by(() => {
		if (offline) return 'offline: set OPENROUTER_API_KEY in .env';
		if (listening) return 'listening…';
		return deckOn
			? 'tell the agent what you want to hear…'
			: 'agent ready · start the deck to hear changes';
	});

	function setHint(text: string | null, isError = false) {
		hint = text;
		hintIsError = isError;
	}

	function push(entry: Omit<Entry, 'id'>): Entry {
		const full: Entry = { id: nextId++, ...entry };
		entries.push(full);
		return full;
	}

	function lastPending(kind: EntryKind): Entry | undefined {
		for (let i = entries.length - 1; i >= 0; i -= 1) {
			const entry = entries[i];
			if (entry && entry.kind === kind && entry.pending) return entry;
		}
		return undefined;
	}

	function formatArgs(args: Record<string, unknown> | string): string {
		if (typeof args === 'string') return args;
		return Object.entries(args)
			.filter(([key]) => key !== 'client_op_id' && key !== 'if_revision')
			.map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
			.join(' ');
	}

	function applyEvent(event: ConductorEvent) {
		switch (event.type) {
			case 'status':
				return;
			case 'text': {
				const current = lastPending('agent');
				if (current) current.text += event.delta;
				else push({ kind: 'agent', text: event.delta, pending: true });
				return;
			}
			case 'assistant': {
				const current = lastPending('agent');
				if (current) {
					current.text = event.text;
					current.pending = false;
				} else {
					push({ kind: 'agent', text: event.text });
				}
				return;
			}
			case 'tool-call':
				push({
					kind: 'tool',
					tool: event.tool,
					text: formatArgs(event.args),
					callId: event.callId,
					ok: null,
					pending: true
				});
				return;
			case 'tool-result': {
				const target =
					entries.find((e) => e.kind === 'tool' && e.pending && e.callId === event.callId) ??
					lastPending('tool');
				if (target) {
					target.ok = event.ok;
					target.result = event.summary;
					target.pending = false;
				}
				if (event.session && onSession) onSession(event.session as unknown as DjSession);
				return;
			}
			case 'error':
				push({ kind: 'error', text: friendlyAgentError(event.message, event.code) });
				return;
			case 'done': {
				for (const entry of entries) entry.pending = false;
				if (speakReplies && event.text) speak(event.text);
				return;
			}
		}
	}

	async function scrollLog() {
		await tick();
		logEl?.scrollTo({ top: logEl.scrollHeight });
	}

	async function refreshStatus() {
		try {
			status = await fetchAgentStatus();
			if (status.state === 'error' && status.error) {
				setHint(friendlyAgentError(status.error), true);
			}
		} catch (err) {
			console.error('[vdj-agent] status failed', err);
		}
	}

	async function send(text: string) {
		const trimmed = text.trim();
		if (!trimmed || busy) return;
		if (offline) {
			setHint(
				'The agent is offline. Add OPENROUTER_API_KEY to .env and restart the dev server.',
				true
			);
			return;
		}
		push({ kind: 'user', text: trimmed });
		draft = '';
		busy = true;
		setHint(null);
		void scrollLog();
		try {
			await streamAgentChat({ text: trimmed, sessionId }, (event) => {
				applyEvent(event);
				void scrollLog();
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			push({ kind: 'error', text: friendlyAgentError(message) });
		} finally {
			busy = false;
			for (const entry of entries) entry.pending = false;
			void scrollLog();
			void refreshStatus();
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void send(draft);
	}

	function ensureSpeech(): SpeechInput | null {
		if (speech) return speech;
		speech = createSpeechInput({
			onInterim: (text) => {
				interim = text;
				void scrollLog();
			},
			onFinal: (text) => {
				interim = '';
				void send(text);
			},
			onError: (message) => setHint(message, true),
			onListening: (on) => {
				listening = on;
				if (!on) interim = '';
			}
		});
		return speech;
	}

	function toggleMic() {
		const input = ensureSpeech();
		if (!input) {
			setHint('Voice input needs Chrome (Web Speech API). Type instead.', true);
			return;
		}
		if (input.listening) {
			input.stop();
			return;
		}
		cancelSpeech();
		setHint(null);
		input.start();
	}

	onMount(() => {
		voiceSupported = speechRecognitionSupported();
		ttsSupported = speechSynthesisSupported();
		void refreshStatus();
	});

	onDestroy(() => {
		speech?.abort();
		cancelSpeech();
	});
</script>

<section class="agent" aria-label="Agent conductor chat" data-state={stateLabel}>
	<div class="kicker">
		<span>AGENT</span>
		<span class="kicker-right"
			>{status?.configured ? status.model : 'conductor · chat + voice'}</span
		>
	</div>

	<div class="statusline">
		<span class="pill" data-state={stateLabel}>
			<span class="dot"></span>
			{stateLabel}
		</span>
		<span class="meta">
			{#if status?.configured}
				{verbCount > 0 ? `${verbCount} verbs` : 'verbs on first turn'} · voice {voiceSupported
					? 'ready'
					: 'n/a'}
			{:else if status}
				deck keeps working without it
			{:else}
				…
			{/if}
		</span>
	</div>

	<div class="log" bind:this={logEl} role="log" aria-live="polite">
		{#if entries.length === 0}
			<p class="empty">
				Text or talk to the conductor. It changes the deck with the same verbs the pads use. Try
				“take it darker and a touch slower” or “drop in eight bars”.
			</p>
		{/if}
		{#each entries as entry (entry.id)}
			<div class="entry" data-kind={entry.kind} data-pending={entry.pending ? 'true' : 'false'}>
				{#if entry.kind === 'tool'}
					<span class="who">verb</span>
					<span class="tool">
						<span class="tool-name">{entry.tool}</span>
						{#if entry.text}<span class="tool-args">{entry.text}</span>{/if}
						<span
							class="tool-result"
							data-ok={entry.ok === null ? 'pending' : entry.ok ? 'true' : 'false'}
						>
							{entry.pending ? '…' : (entry.result ?? '')}
						</span>
					</span>
				{:else}
					<span class="who"
						>{entry.kind === 'user' ? 'you' : entry.kind === 'agent' ? 'agent' : 'error'}</span
					>
					<span class="text">{entry.text}{entry.pending ? '…' : ''}</span>
				{/if}
			</div>
		{/each}
		{#if interim}
			<div class="entry" data-kind="user" data-pending="true">
				<span class="who">you</span>
				<span class="text">{interim}…</span>
			</div>
		{/if}
	</div>

	<form class="composer" onsubmit={handleSubmit}>
		<button
			type="button"
			class="mic"
			data-on={listening ? 'true' : 'false'}
			aria-pressed={listening}
			aria-label={listening ? 'Stop listening' : 'Talk to the agent'}
			title={voiceSupported ? 'Push to talk' : 'Voice input needs Chrome'}
			disabled={!voiceSupported || busy || offline}
			onclick={toggleMic}
		>
			<Mic size={14} />
		</button>
		<input
			bind:value={draft}
			{placeholder}
			aria-label="Message the agent"
			autocomplete="off"
			disabled={busy || offline}
		/>
		<button
			type="submit"
			class="send"
			aria-label="Send"
			disabled={busy || offline || !draft.trim()}
		>
			<Send size={14} />
		</button>
	</form>

	<div class="foot">
		<label class="toggle">
			<input type="checkbox" bind:checked={speakReplies} disabled={!ttsSupported} />
			speak replies
		</label>
		{#if hint}
			<span
				class="hint"
				role={hintIsError ? 'alert' : undefined}
				data-error={hintIsError ? 'true' : 'false'}
			>
				{hint}
			</span>
		{:else if !deckOn && status?.configured}
			<span class="hint">Start the deck to hear what the agent changes.</span>
		{/if}
	</div>
</section>

<style>
	.agent {
		border: 1px solid #222;
		border-radius: 4px;
		padding: 8px 10px 10px;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto auto;
		gap: 8px;
		font-family: var(--font-sans);
		color: #e8e3da;
	}

	.kicker {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #6b665c;
	}

	.kicker-right {
		text-transform: none;
		letter-spacing: 0.04em;
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 60%;
	}

	.statusline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 11px;
		color: #8a847a;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid #2a2a2a;
		border-radius: 999px;
		padding: 2px 10px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: #9a9389;
	}

	.pill[data-state='ready'] {
		color: #86efac;
		border-color: #245c3a;
	}

	.pill[data-state='working'],
	.pill[data-state='starting'] {
		color: #67e8f9;
		border-color: #155e75;
	}

	.pill[data-state='error'] {
		color: #f07167;
		border-color: #7a2e28;
	}

	.pill[data-state='offline'] {
		color: #d97f3a;
		border-color: #6b3d1c;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 18%, transparent);
	}

	.meta {
		font-family: var(--font-mono);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.log {
		min-height: 0;
		overflow-y: auto;
		border: 1px solid #1a1a1a;
		background: #050505;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		scrollbar-width: thin;
		scrollbar-color: #2a2a2a transparent;
	}

	.empty {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		color: #6b665c;
	}

	.entry {
		display: grid;
		grid-template-columns: 38px minmax(0, 1fr);
		gap: 8px;
		font-size: 12px;
		line-height: 1.45;
	}

	.who {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6b665c;
		padding-top: 2px;
	}

	.entry[data-kind='agent'] .who {
		color: #3b6ea5;
	}

	.entry[data-kind='error'] .who,
	.entry[data-kind='error'] .text {
		color: #f07167;
	}

	.entry[data-kind='user'] .text {
		color: #e8e3da;
	}

	.entry[data-kind='agent'] .text {
		color: #dbeafe;
	}

	.entry[data-pending='true'] .text {
		color: #9a9389;
	}

	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.tool {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: #9a9389;
	}

	.tool-name {
		color: #67e8f9;
	}

	.tool-args {
		color: #c4bdb1;
	}

	.tool-result[data-ok='true'] {
		color: #3dba6e;
	}

	.tool-result[data-ok='false'] {
		color: #f07167;
	}

	.tool-result[data-ok='pending'] {
		color: #6b665c;
	}

	.composer {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 36px;
		gap: 6px;
		align-items: stretch;
	}

	.composer input {
		min-width: 0;
		border: 1px solid #2a2a2a;
		border-radius: 3px;
		padding: 0 10px;
		background: #070707;
		color: #e8e3da;
		font-family: var(--font-mono);
		font-size: 13px;
		min-height: 36px;
		outline: none;
	}

	.composer input:focus-visible {
		border-color: #3b6ea5;
	}

	.composer input:disabled {
		color: #4a463f;
	}

	.mic,
	.send {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid #2a2a2a;
		border-radius: 3px;
		background: #0a0a0a;
		color: #9a9389;
		cursor: pointer;
	}

	.send:not(:disabled) {
		background: #f4f1ea;
		color: #111;
		border-color: #f4f1ea;
	}

	.mic[data-on='true'] {
		background: #f0716722;
		border-color: #e24a3c;
		color: #f07167;
	}

	.mic:disabled,
	.send:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 11px;
		color: #8a847a;
		min-height: 16px;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		white-space: nowrap;
	}

	.toggle input {
		accent-color: #3b6ea5;
	}

	.hint {
		color: #c4bdb1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint[data-error='true'] {
		color: #f07167;
		white-space: normal;
	}
</style>
