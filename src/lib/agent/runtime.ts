// src/lib/agent/runtime.ts
//
// The Virtual DJ agent runtime: one DeepSeek Harness (`dsh --profile sdk`)
// subprocess per SvelteKit server process, driven over its stdio JSON-RPC
// protocol through @deepseek-ai/dsh-sdk-client. The harness is the brain, the
// Virtual DJ MCP server (mounted by agent/vdj.cordis.patch.yml) is the hands,
// and /api/dj/* in this same process is the deck.
//
// Lifecycle: lazy start on the first chat, memoized handshake, one harness
// session per browser conversation, runs serialized per session. A dead
// subprocess is reaped and the next chat starts a fresh one. Nothing here is
// persisted by us; the harness keeps its own JSONL under <dshHome>/sessions.
//
// No `$lib` aliases on purpose: scripts/agent-smoke.ts runs this file with tsx.

import { agentConfigKey, isAgentConfigured, type AgentConfig } from './config';
import {
	mapSessionEvent,
	type AgentRuntimeState,
	type AgentStatus,
	type ConductorEvent
} from './events';

export type { AgentRuntimeState, AgentStatus } from './events';

export type ConductorEventSink = (event: ConductorEvent) => void;

/** The slice of the SDK we use, so tests can substitute a fake. */
export interface HarnessNotificationLike {
	method: string;
	params: Record<string, unknown>;
}

export interface HarnessRunResultLike {
	finalResponse: string;
}

export interface HarnessSessionLike {
	run(
		input: string,
		options?: { onNotification?: (notification: HarnessNotificationLike) => void }
	): Promise<HarnessRunResultLike>;
}

export interface HarnessLike {
	start(): Promise<void>;
	session(id: string): HarnessSessionLike;
	close(): Promise<void>;
}

export interface HarnessLaunchOptions {
	profile: string;
	patches: string[];
	dshHome: string;
	processCwd: string;
	cwd: string;
	env: NodeJS.ProcessEnv;
	provider: string;
	model: string;
	reasoningEffort?: string;
	initializeTimeoutMs: number;
}

export type HarnessFactory = (options: HarnessLaunchOptions) => HarnessLike;

export interface AgentRuntimeDeps {
	/** Loads the SDK; defaults to a dynamic import of @deepseek-ai/dsh-sdk-client. */
	createHarness?: () => Promise<HarnessFactory>;
	env?: NodeJS.ProcessEnv;
	log?: (line: string) => void;
}

interface ConversationRecord {
	harnessSessionId: string;
	generation: number;
	queue: Promise<unknown>;
}

async function defaultHarnessFactory(): Promise<HarnessFactory> {
	const sdk = await import('@deepseek-ai/dsh-sdk-client');
	return (options) => {
		const { reasoningEffort, ...rest } = options;
		return new sdk.DeepSeekHarness({
			...rest,
			...(reasoningEffort === undefined ? {} : { reasoningEffort: reasoningEffort as never })
		}) as unknown as HarnessLike;
	};
}

function errorMessage(error: unknown): string {
	if (error instanceof AggregateError) {
		return error.errors.map((e) => errorMessage(e)).join(' | ');
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

export const HARNESS_INITIALIZE_TIMEOUT_MS = 45_000;

export class AgentRuntime {
	readonly config: AgentConfig;
	private readonly deps: Required<Pick<AgentRuntimeDeps, 'createHarness' | 'log'>> &
		Pick<AgentRuntimeDeps, 'env'>;
	private harness: HarnessLike | null = null;
	private starting: Promise<void> | null = null;
	private state: AgentRuntimeState;
	private lastError: string | null = null;
	private tools: string[] = [];
	private appBaseUrl: string | null;
	private readonly conversations = new Map<string, ConversationRecord>();

	constructor(config: AgentConfig, deps: AgentRuntimeDeps = {}) {
		this.config = config;
		this.deps = {
			createHarness: deps.createHarness ?? defaultHarnessFactory,
			log: deps.log ?? ((line) => console.error(`[vdj-agent] ${line}`)),
			env: deps.env
		};
		this.state = isAgentConfigured(config) ? 'stopped' : 'offline';
		this.appBaseUrl = config.appBaseUrl;
	}

	status(): AgentStatus {
		return {
			configured: isAgentConfigured(this.config),
			provider: this.config.provider,
			model: this.config.model,
			reasoning: this.config.reasoning,
			state: this.state,
			error: this.lastError,
			tools: [...this.tools],
			sessions: this.conversations.size
		};
	}

	/** Environment handed to the dsh subprocess (and, filtered, to the MCP child). */
	childEnv(): NodeJS.ProcessEnv {
		const base = this.deps.env ?? process.env;
		const env: NodeJS.ProcessEnv = {
			...base,
			DSH_HOME: this.config.dshHome,
			DSH_TELEMETRY_DISABLED: '1',
			VDJ_REPO_ROOT: this.config.repoRoot,
			VDJ_AGENT_MODEL: this.config.model,
			VDJ_BASE_URL: this.appBaseUrl ?? base.VDJ_BASE_URL ?? 'http://localhost:5173'
		};
		if (this.config.apiKey) env.OPENROUTER_API_KEY = this.config.apiKey;
		if (this.config.openrouterBaseUrl) env.VDJ_OPENROUTER_BASE_URL = this.config.openrouterBaseUrl;
		else delete env.VDJ_OPENROUTER_BASE_URL;
		return env;
	}

	launchOptions(): HarnessLaunchOptions {
		return {
			profile: 'sdk',
			patches: [this.config.patchPath],
			dshHome: this.config.dshHome,
			processCwd: this.config.repoRoot,
			cwd: this.config.repoRoot,
			env: this.childEnv(),
			provider: this.config.provider,
			model: this.config.model,
			...(this.config.reasoning ? { reasoningEffort: this.config.reasoning } : {}),
			initializeTimeoutMs: HARNESS_INITIALIZE_TIMEOUT_MS
		};
	}

	/**
	 * Spawn + handshake once. `appBaseUrl` (the origin the browser used) is
	 * captured on first start so the MCP bridge can reach this app.
	 */
	async ensureStarted(appBaseUrl?: string): Promise<void> {
		if (!isAgentConfigured(this.config)) {
			throw new Error('agent is offline: OPENROUTER_API_KEY is not set');
		}
		if (this.harness && this.state === 'ready') return;
		if (this.starting) return this.starting;
		if (appBaseUrl && !this.config.appBaseUrl) this.appBaseUrl = appBaseUrl;

		this.state = 'starting';
		this.lastError = null;
		this.starting = (async () => {
			try {
				const factory = await this.deps.createHarness();
				const harness = factory(this.launchOptions());
				await harness.start();
				this.harness = harness;
				this.state = 'ready';
				this.deps.log(`runtime ready (${this.config.provider}/${this.config.model})`);
			} catch (error) {
				this.harness = null;
				this.state = 'error';
				this.lastError = errorMessage(error);
				this.deps.log(`runtime failed to start: ${this.lastError}`);
				throw error;
			} finally {
				this.starting = null;
			}
		})();
		return this.starting;
	}

	private conversation(sessionId: string): ConversationRecord {
		let record = this.conversations.get(sessionId);
		if (!record) {
			record = { harnessSessionId: `${sessionId}-g1`, generation: 1, queue: Promise.resolve() };
			this.conversations.set(sessionId, record);
		}
		return record;
	}

	/** Forget a conversation: the next chat starts a fresh harness session. */
	reset(sessionId: string): void {
		const record = this.conversations.get(sessionId);
		if (!record) return;
		record.generation += 1;
		record.harnessSessionId = `${sessionId}-g${record.generation}`;
	}

	/**
	 * Send one message and stream ConductorEvents until the agent is idle.
	 * Runs are serialized per conversation; a second message waits its turn.
	 */
	async chat(
		sessionId: string,
		text: string,
		onEvent: ConductorEventSink,
		opts: { appBaseUrl?: string } = {}
	): Promise<{ text: string }> {
		const record = this.conversation(sessionId);
		const run = record.queue.then(() => this.runTurn(record, text, onEvent, opts));
		record.queue = run.catch(() => undefined);
		return run;
	}

	private async runTurn(
		record: ConversationRecord,
		text: string,
		onEvent: ConductorEventSink,
		opts: { appBaseUrl?: string }
	): Promise<{ text: string }> {
		await this.ensureStarted(opts.appBaseUrl);
		const harness = this.harness;
		if (!harness) throw new Error('agent runtime is not running');
		const harnessSessionId = record.harnessSessionId;
		let streamed = '';
		let lastAssistant = '';
		let sawError = false;

		const onNotification = (notification: HarnessNotificationLike) => {
			const params = notification.params;
			if (params.sessionId !== harnessSessionId) return;
			if (notification.method === 'session.status') {
				const status = params.status === 'running' ? 'running' : 'idle';
				onEvent({ type: 'status', status });
				return;
			}
			if (notification.method !== 'session.event') return;
			const event = params.event as { type: string; data?: unknown } | undefined;
			if (!event || typeof event.type !== 'string') return;
			this.learnTools(event);
			for (const mapped of mapSessionEvent(event)) {
				if (mapped.type === 'text') streamed += mapped.delta;
				if (mapped.type === 'assistant') {
					lastAssistant = mapped.text;
					streamed = '';
				}
				if (mapped.type === 'error') sawError = true;
				onEvent(mapped);
			}
		};

		try {
			const result = await harness.session(harnessSessionId).run(text, { onNotification });
			const finalText = (result.finalResponse || lastAssistant || streamed).trim();
			onEvent({ type: 'done', text: finalText });
			return { text: finalText };
		} catch (error) {
			const message = errorMessage(error);
			this.deps.log(`turn failed on ${harnessSessionId}: ${message}`);
			if (!sawError) onEvent({ type: 'error', message });
			await this.handleTransportFailure(error);
			throw error;
		}
	}

	private learnTools(event: { type: string; data?: unknown }): void {
		if (event.type !== 'request/header') return;
		const data = event.data as { header?: { tools?: Array<{ name?: unknown }> } } | undefined;
		const tools = data?.header?.tools;
		if (!Array.isArray(tools)) return;
		const names = tools
			.map((tool) => (typeof tool?.name === 'string' ? tool.name : ''))
			.filter((name) => name.length > 0)
			.sort();
		if (names.length > 0) this.tools = names;
	}

	private async handleTransportFailure(error: unknown): Promise<void> {
		const name = error instanceof Error ? error.name : '';
		if (name !== 'TransportClosedError' && name !== 'SdkProtocolError') return;
		this.deps.log(`runtime transport lost (${name}); it will be restarted on the next chat`);
		await this.shutdown();
		this.state = 'error';
		this.lastError = errorMessage(error);
	}

	/** Stop the subprocess; conversations keep their ids and restart lazily. */
	async shutdown(): Promise<void> {
		const harness = this.harness;
		this.harness = null;
		this.state = isAgentConfigured(this.config) ? 'stopped' : 'offline';
		if (!harness) return;
		try {
			await harness.close();
		} catch (error) {
			this.deps.log(`runtime close failed: ${errorMessage(error)}`);
		}
	}

	/** Restart with the same config (after editing the profile overlay). */
	async restart(appBaseUrl?: string): Promise<void> {
		await this.shutdown();
		this.tools = [];
		await this.ensureStarted(appBaseUrl);
	}
}

// --- module singleton -------------------------------------------------------

let current: { key: string; runtime: AgentRuntime } | null = null;

/**
 * The server-wide runtime. A config change (new key, model, ...) retires the
 * old subprocess and builds a fresh runtime.
 */
export function getAgentRuntime(config: AgentConfig, deps?: AgentRuntimeDeps): AgentRuntime {
	const key = agentConfigKey(config);
	if (current && current.key === key) return current.runtime;
	const previous = current;
	current = { key, runtime: new AgentRuntime(config, deps) };
	if (previous) void previous.runtime.shutdown();
	return current.runtime;
}

export function resetAgentRuntimeForTests(): void {
	current = null;
}
