<script lang="ts">
	import { isAudioSupported } from '$lib/audio/context';
	import { applySession, isDeckRunning, startDeck, stopDeck } from '$lib/dj/deck';
	import {
		getDjSession,
		postBar,
		postEnergy,
		postIntent,
		postMute,
		postSessionPause,
		postSessionStart,
		postSessionStop
	} from '$lib/dj/client';
	import {
		INTENT_PADS,
		INSTRUMENT_STEMS,
		activePadIds,
		conductorHint,
		displayEnergy,
		formatClock,
		formatModDb,
		headerBpm,
		headerKey,
		headerPhase,
		lastIntentLabel,
		padDisabled,
		plaqueBpm,
		plaqueKey,
		plaquePhase,
		roleBayStatus,
		runStatus,
		type RunStatus
	} from '$lib/dj/instrument-view';
	import { ROLE_IDS, type DjSession, type RoleId } from '$lib/dj/session';
	import { onDestroy, onMount } from 'svelte';

	let session = $state<DjSession | null>(null);
	let deckOn = $state(false);
	let error = $state<string | null>(null);
	let intentText = $state('');
	let clock = $state(formatClock(new Date()));
	let mutating = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let clockTimer: ReturnType<typeof setInterval> | null = null;

	const run = $derived<RunStatus>(runStatus({ deckStarted: deckOn, session }));
	const energy = $derived(displayEnergy(run, session));
	const lastIntent = $derived(lastIntentLabel(session?.last_intent));
	const activePads = $derived(new Set(activePadIds({ run, session })));
	const gateLine = $derived(conductorHint(deckOn));
	const musicalPhase = $derived(headerPhase(run, session));
	const plaqueMusical = $derived(plaquePhase(run, session));
	const breakLike = $derived(musicalPhase === 'break');

	function adopt(next?: DjSession) {
		if (!next) return;
		session = next;
		if (deckOn) applySession(next);
	}

	async function refresh() {
		try {
			adopt(await getDjSession());
		} catch (err) {
			console.error('[vdj] session poll failed', err);
		}
	}

	async function syncBar() {
		await postBar(1);
		if (!mutating) await refresh();
	}

	function showResultError(result: { ok: boolean; error?: string; session?: DjSession }) {
		adopt(result.session);
		if (!result.ok) {
			error = result.error ?? 'Request failed.';
			return false;
		}
		error = null;
		return true;
	}

	async function handleStart() {
		error = null;
		if (!isAudioSupported()) {
			error = 'Web Audio is not supported in this browser.';
			return;
		}
		mutating = true;
		try {
			await startDeck({ onBar: () => void syncBar() });
			deckOn = true;
			const started = await postSessionStart(session?.revision);
			if (!showResultError(started)) await refresh();
			if (session) applySession(session);
		} catch (err) {
			error = 'Could not start DJ deck. Check the console.';
			console.error('[vdj] start failed:', err);
		} finally {
			mutating = false;
		}
	}

	async function handlePause() {
		if (!session) return;
		mutating = true;
		try {
			const result =
				session.phase === 'paused'
					? await postSessionStart(session.revision)
					: await postSessionPause(session.revision);
			if (!showResultError(result)) await refresh();
		} finally {
			mutating = false;
		}
	}

	async function handleDeckStop() {
		mutating = true;
		try {
			const result = await postSessionStop(session?.revision);
			showResultError(result);
			stopDeck();
			deckOn = false;
			await refresh();
		} finally {
			mutating = false;
		}
	}

	async function handleResume() {
		error = null;
		if (!isAudioSupported()) {
			error = 'Web Audio is not supported in this browser.';
			return;
		}
		mutating = true;
		try {
			if (!isDeckRunning()) {
				await startDeck({ onBar: () => void syncBar() });
			}
			deckOn = true;
			let latest = session;
			const started = await postSessionStart(latest?.revision);
			if (!showResultError(started)) {
				await refresh();
				return;
			}
			latest = started.session ?? session;
			const energyResult = await postEnergy(0.5, latest?.revision);
			if (!showResultError(energyResult)) {
				await refresh();
				return;
			}
			latest = energyResult.session ?? session;
			for (const role of ROLE_IDS) {
				const muteResult = await postMute(role, false, latest?.revision);
				if (muteResult.session) latest = muteResult.session;
				if (!muteResult.ok) {
					showResultError(muteResult);
					await refresh();
					return;
				}
			}
			adopt(latest);
		} catch (err) {
			error = 'Could not resume DJ deck. Check the console.';
			console.error('[vdj] resume failed:', err);
		} finally {
			mutating = false;
		}
	}

	async function sendIntent(text: string) {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (!deckOn) {
			error = conductorHint(false);
			return;
		}
		mutating = true;
		try {
			const result = await postIntent(trimmed, { if_revision: session?.revision });
			if (!showResultError(result)) {
				if (result.conflict) await refresh();
				return;
			}
			intentText = '';
		} catch (err) {
			error = 'Intent request failed.';
			console.error('[vdj] intent failed:', err);
		} finally {
			mutating = false;
		}
	}

	function handleIntentSubmit(event: SubmitEvent) {
		event.preventDefault();
		void sendIntent(intentText);
	}

	async function handleMute(role: RoleId) {
		if (!session) return;
		mutating = true;
		try {
			const next = !session.roles[role].mute;
			const result = await postMute(role, next, session.revision);
			if (!showResultError(result)) await refresh();
		} finally {
			mutating = false;
		}
	}

	function stemDb(role: RoleId, index: number): string {
		if (run === 'STOPPED' && role !== 'vox') {
			return String(-28 - index * 2);
		}
		const state = session?.roles[role];
		return formatModDb({
			idle: run === 'IDLE',
			muted: state?.mute ?? true,
			gain: state?.gain ?? 0,
			run
		});
	}

	function stemMuted(role: RoleId): boolean {
		return session?.roles[role]?.mute ?? run !== 'LIVE';
	}

	function activityWidths(role: RoleId): number[] {
		const state = session?.roles[role];
		const gain = run === 'IDLE' || state?.mute ? 0 : (state?.gain ?? 0);
		const energyN = run === 'IDLE' ? 0 : (session?.energy ?? 0);
		return Array.from({ length: 28 }, (_, i) => {
			const wave = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.55 + gain * 6));
			return Math.round(wave * gain * (0.4 + energyN) * 100);
		});
	}

	function vuHeights(role: RoleId): number[] {
		const state = session?.roles[role];
		const gain = run === 'IDLE' || (state?.mute && run !== 'STOPPED') ? 0 : (state?.gain ?? 0);
		const energyN = run === 'STOPPED' ? 0.08 : run === 'IDLE' ? 0 : (session?.energy ?? 0);
		return Array.from({ length: 18 }, (_, i) => {
			const wave = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.7 + gain * 4));
			return Math.round(wave * Math.max(gain, energyN * 0.25) * 100);
		});
	}

	function legendThird(): string {
		return breakLike ? 'mood' : 'stems';
	}

	onMount(() => {
		void refresh();
		pollTimer = setInterval(() => {
			if (!mutating) void refresh();
		}, 500);
		clockTimer = setInterval(() => {
			clock = formatClock(new Date());
		}, 1000);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (clockTimer) clearInterval(clockTimer);
		if (isDeckRunning()) stopDeck();
	});
</script>

<div class="vdj" data-run={run} data-phase={musicalPhase}>
	<header class="vdj-header">
		<div class="vdj-brand-row">
			<div class="vdj-brand">chaos tone <span class="vdj-brand-rule">|</span> kamino</div>
			<div class="vdj-run" data-run={run}>
				<span class="vdj-dot"></span>
				{run}
			</div>
		</div>
		<div class="vdj-meta">
			<span>bpm {headerBpm(run, session)}</span>
			<span>key {headerKey(run, session)}</span>
			<span>phase {musicalPhase}</span>
			<span class="vdj-clock">{clock}</span>
		</div>
	</header>

	<section class="vdj-section vdj-conductor" aria-label="Agent conductor">
		<div class="vdj-kicker">
			<span>AGENT CONDUCTOR</span>
			<span>intent pads · last plaque</span>
		</div>
		<div class="vdj-conductor-row">
			<form class="vdj-intent" onsubmit={handleIntentSubmit}>
				<span class="vdj-prompt" aria-hidden="true">&gt;</span>
				<input
					bind:value={intentText}
					placeholder="intent..."
					aria-label="Intent"
					disabled={!deckOn || mutating}
					autocomplete="off"
				/>
			</form>
			<div class="vdj-pads" role="group" aria-label="Intent pads">
				{#each INTENT_PADS as pad (pad.id)}
					<button
						type="button"
						class="vdj-pad"
						data-id={pad.id}
						data-active={activePads.has(pad.id) ? 'true' : 'false'}
						disabled={padDisabled(run, pad.id) || mutating}
						onclick={() => void sendIntent(pad.text)}
					>
						{pad.label}
					</button>
				{/each}
			</div>
			<div class="vdj-last" data-run={run}>
				<div class="vdj-last-label">LAST INTENT</div>
				<div class="vdj-last-value">{run === 'IDLE' ? '—' : lastIntent}</div>
			</div>
		</div>
		{#if !deckOn}
			<p class="vdj-hint">{gateLine}</p>
		{:else if error}
			<p class="vdj-hint" role="alert">{error}</p>
		{/if}
	</section>

	<div class="vdj-mid">
		<section class="vdj-section vdj-deck" aria-label="Main deck">
			<div class="vdj-kicker">
				<span>MAIN DECK</span>
				<span>deep house · stem session</span>
			</div>

			<div class="vdj-transport">
				{#if run === 'IDLE'}
					<button
						type="button"
						class="vdj-primary"
						onclick={() => void handleStart()}
						disabled={mutating}
					>
						<span aria-hidden="true">▶</span> Start
					</button>
				{:else if run === 'STOPPED'}
					<button
						type="button"
						class="vdj-resume"
						onclick={() => void handleResume()}
						disabled={mutating}
					>
						<span aria-hidden="true">▶</span> Resume
					</button>
				{:else}
					<button
						type="button"
						class="vdj-icon"
						data-on={session?.phase === 'paused' ? 'false' : 'true'}
						aria-pressed={session?.phase !== 'paused'}
						aria-label={session?.phase === 'paused' ? 'Resume playback' : 'Pause'}
						onclick={() => void handlePause()}
						disabled={mutating}
					>
						‖
					</button>
					<button
						type="button"
						class="vdj-icon"
						aria-label="Stop deck"
						onclick={() => void handleDeckStop()}
						disabled={mutating}
					>
						■
					</button>
					<span class="vdj-phase-pill" data-phase={musicalPhase}>
						<span class="vdj-dot"></span>
						{musicalPhase}
					</span>
				{/if}
			</div>

			<div class="vdj-energy">
				<span class="vdj-energy-label">ENERGY</span>
				<div
					class="vdj-energy-track"
					role="meter"
					aria-label="Energy"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={energy}
				>
					{#each Array.from({ length: 32 }, (_, i) => i) as i (i)}
						<span class="vdj-seg" data-on={i < Math.round((energy / 100) * 32) ? 'true' : 'false'}
						></span>
					{/each}
				</div>
				<span class="vdj-energy-val">{energy}</span>
			</div>

			<div class="vdj-stems">
				<div class="vdj-stem-head">
					<span>STEM ACTIVITY</span>
					<span>mod meters</span>
				</div>
				{#each INSTRUMENT_STEMS as stem, index (stem.id)}
					{@const db = stemDb(stem.role, index)}
					<div class="vdj-stem-row" data-muted={stemMuted(stem.role) ? 'true' : 'false'}>
						<span class="vdj-stem-name" style="color: {stem.hue}">{stem.label}</span>
						<div
							class="vdj-activity"
							aria-hidden="true"
							title="Derived from role gain — not a live analyzer"
						>
							{#each activityWidths(stem.role) as w, i (`${stem.id}-a-${i}`)}
								<i style="height: {Math.max(8, w)}%; background: {stem.hue}"></i>
							{/each}
						</div>
						<span class="vdj-db">{db}</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="vdj-section vdj-session" aria-label="Session plaque">
			<div class="vdj-kicker">
				<span>SESSION</span>
				<span>plaque</span>
			</div>
			<div class="vdj-plaques">
				<div class="vdj-plaque">
					<span>BPM</span>
					<strong>{plaqueBpm(run, session)}</strong>
				</div>
				<div class="vdj-plaque">
					<span>KEY</span>
					<strong>{plaqueKey(run, session)}</strong>
				</div>
				<div class="vdj-plaque">
					<span>ENERGY</span>
					<strong>{energy}</strong>
				</div>
				<div class="vdj-plaque">
					<span>PHASE</span>
					<strong>{plaqueMusical}</strong>
				</div>
			</div>
			<div class="vdj-session-intent" data-run={run}>
				<span>LAST AGENT INTENT</span>
				<strong>{run === 'IDLE' ? '—' : lastIntent}</strong>
			</div>
			<div class="vdj-legend">
				<span data-key="deck"><i></i> deck</span>
				<span data-key="agent"><i></i> agent</span>
				<span data-key="stems"><i></i> {legendThird()}</span>
			</div>
		</section>
	</div>

	<section class="vdj-section vdj-roles" aria-label="Role modules">
		<div class="vdj-kicker">
			<span>ROLE MODULES</span>
			<span>kick · bass · hats · chords · fx · vocals</span>
		</div>
		<div class="vdj-bays">
			{#each INSTRUMENT_STEMS as stem, index (stem.id)}
				{@const state = session?.roles[stem.role]}
				{@const status = roleBayStatus({
					run,
					muted: state?.mute ?? false,
					gain: state?.gain ?? 0,
					filter: state?.filter ?? 0.5,
					role: stem.role
				})}
				{@const db = stemDb(stem.role, index)}
				<article class="vdj-bay" data-status={status} data-run={run} style="--stem: {stem.hue}">
					<div class="vdj-bay-head">
						<span>{stem.label}</span>
						<button
							type="button"
							class="vdj-mute"
							data-on={state?.mute ? 'true' : 'false'}
							aria-pressed={state?.mute ?? false}
							aria-label="Mute {stem.label}"
							onclick={() => void handleMute(stem.role)}
							disabled={!session || mutating}
						>
							M
						</button>
					</div>
					<div
						class="vdj-vu"
						aria-hidden="true"
						title="Derived from role gain — not a live analyzer"
					>
						{#each vuHeights(stem.role) as h, i (`${stem.id}-v-${i}`)}
							<i style="height: {Math.max(4, h)}%"></i>
						{/each}
					</div>
					<div class="vdj-bay-pips" aria-hidden="true"><i></i><i></i><i></i></div>
					<div class="vdj-bay-foot">
						<span class="vdj-bay-status">{status}</span>
						<span class="vdj-db">{db}</span>
					</div>
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	.vdj {
		box-sizing: border-box;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
		background: #000;
		color: #e8e3da;
		padding: 10px 12px 12px;
		gap: 8px;
		font-family: var(--font-sans);
	}

	.vdj-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 28px;
		padding: 0 2px;
	}

	.vdj-brand-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.vdj-brand {
		font-size: 13px;
		letter-spacing: 0.02em;
		color: #f2eee8;
	}

	.vdj-brand-rule {
		color: #6b665c;
		padding: 0 4px;
	}

	.vdj-run {
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

	.vdj-run[data-run='LIVE'] {
		color: #86efac;
		border-color: #245c3a;
	}

	.vdj-run[data-run='STOPPED'] {
		color: #f07167;
		border-color: #7a2e28;
	}

	.vdj-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 18%, transparent);
	}

	.vdj-meta {
		display: flex;
		gap: 16px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: #8a847a;
	}

	.vdj-clock {
		color: #c4bdb1;
	}

	.vdj-section {
		border: 1px solid #222;
		border-radius: 4px;
		padding: 8px 10px 10px;
		min-width: 0;
	}

	.vdj-kicker {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #6b665c;
		margin-bottom: 8px;
	}

	.vdj-conductor-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 140px;
		gap: 8px;
		align-items: stretch;
	}

	.vdj-intent {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid #2a2a2a;
		border-radius: 3px;
		padding: 0 10px;
		background: #070707;
		min-height: 36px;
	}

	.vdj-prompt {
		color: #6b665c;
		font-family: var(--font-mono);
	}

	.vdj-intent input {
		flex: 1;
		background: transparent;
		border: 0;
		color: #e8e3da;
		font-family: var(--font-mono);
		font-size: 13px;
		outline: none;
	}

	.vdj-intent input:disabled {
		color: #4a463f;
	}

	.vdj-pads {
		display: flex;
		gap: 6px;
	}

	.vdj-pad {
		min-width: 64px;
		height: 36px;
		border: 1px solid #2a2a2a;
		border-radius: 3px;
		background: #0a0a0a;
		color: #8a847a;
		font-size: 12px;
		cursor: pointer;
	}

	.vdj-pad:disabled {
		cursor: not-allowed;
		color: #3d3a35;
	}

	.vdj-pad[data-active='true'][data-id='darker'] {
		border-color: #67e8f9;
		color: #dbeafe;
	}

	.vdj-pad[data-active='true'][data-id='break'] {
		border-color: #f59e3b;
		color: #fde68a;
	}

	.vdj-pad[data-active='true'][data-id='stop'] {
		border-color: #e24a3c;
		color: #f07167;
	}

	.vdj-last {
		border: 1px solid #2a2a2a;
		border-radius: 3px;
		padding: 4px 8px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
	}

	.vdj-last-label {
		font-size: 9px;
		letter-spacing: 0.12em;
		color: #6b665c;
	}

	.vdj-last-value {
		font-size: 12px;
		color: #d6d0c6;
	}

	.vdj[data-phase='break'] .vdj-last-value,
	.vdj[data-phase='break'] .vdj-session-intent strong {
		color: #c4b5fd;
	}

	.vdj[data-run='STOPPED'] .vdj-last-value,
	.vdj[data-run='STOPPED'] .vdj-session-intent {
		border-color: #7a2e28;
	}

	.vdj[data-run='STOPPED'] .vdj-session-intent strong,
	.vdj[data-run='STOPPED'] .vdj-last-value {
		color: #f07167;
	}

	.vdj-hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: #c4bdb1;
	}

	.vdj-mid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 8px;
		min-height: 0;
	}

	.vdj-transport {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.vdj-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #f4f1ea;
		color: #111;
		border: 1px solid #f4f1ea;
		border-radius: 6px;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.vdj-resume {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		color: #f4f1ea;
		border: 1px solid #f4f1ea;
		border-radius: 6px;
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
	}

	.vdj-icon {
		width: 36px;
		height: 36px;
		border: 1px solid #2a2a2a;
		border-radius: 4px;
		background: #0a0a0a;
		color: #9a9389;
		cursor: pointer;
	}

	.vdj-icon[data-on='true'] {
		background: #f4f1ea;
		color: #111;
		border-color: #f4f1ea;
	}

	.vdj-phase-pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid #2a2a2a;
		border-radius: 999px;
		padding: 3px 10px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: #86efac;
	}

	.vdj-phase-pill[data-phase='break'] {
		color: #c4b5fd;
		border-color: #5b21b6;
	}

	.vdj-energy {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 36px;
		gap: 10px;
		align-items: center;
		margin-bottom: 14px;
	}

	.vdj-energy-label {
		font-size: 10px;
		letter-spacing: 0.14em;
		color: #6b665c;
	}

	.vdj-energy-track {
		display: flex;
		gap: 3px;
		height: 14px;
		align-items: stretch;
	}

	.vdj-seg {
		flex: 1;
		background: #161616;
		border-radius: 1px;
	}

	.vdj-seg[data-on='true'] {
		background: #3dba6e;
	}

	.vdj[data-phase='break'] .vdj-seg[data-on='true'] {
		background: #8b5cf6;
	}

	.vdj[data-run='STOPPED'] .vdj-seg[data-on='true'] {
		background: #7a2e28;
	}

	.vdj-energy-val,
	.vdj-db {
		font-family: var(--font-mono);
		font-size: 12px;
		color: #c4bdb1;
		text-align: right;
	}

	.vdj-stem-head,
	.vdj-stem-row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) 48px;
		gap: 10px;
		align-items: center;
	}

	.vdj-stem-head {
		font-size: 10px;
		letter-spacing: 0.12em;
		color: #6b665c;
		margin-bottom: 6px;
	}

	.vdj-stem-head span:last-child,
	.vdj-db {
		text-align: right;
	}

	.vdj-stem-row {
		min-height: 22px;
	}

	.vdj-stem-row[data-muted='true'] {
		opacity: 0.45;
	}

	.vdj-stem-name {
		font-size: 11px;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.vdj-activity {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 16px;
	}

	.vdj-activity i {
		width: 2px;
		background: #2a2a2a;
		display: block;
		align-self: center;
	}

	.vdj-plaques {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 8px;
	}

	.vdj-plaque {
		border: 1px solid #222;
		border-radius: 3px;
		padding: 10px 10px 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.vdj-plaque span {
		font-size: 10px;
		letter-spacing: 0.14em;
		color: #6b665c;
	}

	.vdj-plaque strong {
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 500;
		color: #f2eee8;
	}

	.vdj-session-intent {
		border: 1px solid #222;
		border-radius: 3px;
		padding: 10px;
		min-height: 64px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.vdj-session-intent span {
		font-size: 10px;
		letter-spacing: 0.12em;
		color: #6b665c;
	}

	.vdj-session-intent strong {
		font-size: 16px;
		font-weight: 500;
	}

	.vdj-legend {
		display: flex;
		gap: 14px;
		margin-top: 10px;
		font-size: 11px;
		color: #8a847a;
	}

	.vdj-legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.vdj-legend i {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: #6b665c;
	}

	.vdj[data-run='IDLE'] .vdj-legend [data-key='deck'] i {
		background: #6b665c;
	}
	.vdj[data-run='IDLE'] .vdj-legend [data-key='agent'] i {
		background: #d97f3a;
	}
	.vdj[data-run='IDLE'] .vdj-legend [data-key='stems'] i {
		background: #3b6ea5;
	}

	.vdj[data-run='LIVE'] .vdj-legend [data-key='deck'] i {
		background: #3dba6e;
	}
	.vdj[data-run='LIVE'] .vdj-legend [data-key='agent'] i {
		background: #3b6ea5;
	}
	.vdj[data-run='LIVE'] .vdj-legend [data-key='stems'] i {
		background: #67e8f9;
	}

	.vdj[data-phase='break'] .vdj-legend [data-key='agent'] i,
	.vdj[data-phase='break'] .vdj-legend [data-key='stems'] i {
		background: #8b5cf6;
	}

	.vdj[data-run='STOPPED'] .vdj-legend i {
		background: #e24a3c;
	}

	.vdj-bays {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}

	.vdj-bay {
		border: 1px solid #222;
		border-radius: 3px;
		padding: 8px;
		min-height: 168px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.vdj-bay[data-status='muted'] {
		opacity: 0.55;
	}

	.vdj-bay-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		letter-spacing: 0.08em;
	}

	.vdj-mute {
		width: 20px;
		height: 20px;
		border: 1px solid #d97f3a;
		background: transparent;
		color: #d97f3a;
		font-size: 10px;
		border-radius: 2px;
		cursor: pointer;
	}

	.vdj-mute[data-on='true'] {
		background: #d97f3a22;
	}

	.vdj-vu {
		flex: 1;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 2px;
		min-height: 88px;
		border: 1px solid #1a1a1a;
		background: #050505;
		padding: 6px 8px;
	}

	.vdj-vu i {
		width: 4px;
		background: var(--stem);
		display: block;
		border-radius: 1px;
	}

	.vdj-bay[data-run='STOPPED'] .vdj-vu i {
		background: #7a2e28;
	}

	.vdj-bay-pips {
		display: flex;
		justify-content: center;
		gap: 6px;
	}

	.vdj-bay-pips i {
		width: 5px;
		height: 5px;
		border-radius: 999px;
		border: 1px solid #3d3a35;
	}

	.vdj-bay-foot {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #8a847a;
	}

	.vdj-bay-status {
		text-transform: lowercase;
	}

	.vdj-bay[data-status='alert'] .vdj-bay-status,
	.vdj-bay[data-status='alert'] .vdj-db {
		color: #f07167;
	}

	.vdj-bay[data-status='hold'] .vdj-bay-status {
		color: #f59e3b;
	}

	.vdj-bay[data-status='sys'] .vdj-bay-status {
		color: #c4b5fd;
	}

	.vdj-primary:disabled,
	.vdj-resume:disabled,
	.vdj-icon:disabled,
	.vdj-mute:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
