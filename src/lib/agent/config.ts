// src/lib/agent/config.ts
//
// Virtual DJ agent configuration, resolved from environment variables. Pure:
// the caller passes the env record (SvelteKit routes use $env/dynamic/private,
// scripts pass process.env) so this stays testable and alias-free.

import { resolve } from 'node:path';

export const AGENT_PROVIDER = 'openrouter';
export const DEFAULT_AGENT_MODEL = 'deepseek/deepseek-v4-flash';
export const DEFAULT_AGENT_REASONING = 'off';
export const AGENT_PATCH_RELATIVE = 'agent/vdj.cordis.patch.yml';

export type EnvRecord = Record<string, string | undefined>;

export interface AgentConfig {
	/** OpenRouter key; `null` means the agent is offline (deck still works). */
	apiKey: string | null;
	provider: typeof AGENT_PROVIDER;
	/** OpenRouter model id (must support tool calling). */
	model: string;
	/** pi-ai reasoning level, or `null` to keep the model's default. */
	reasoning: string | null;
	/** Override for the OpenRouter endpoint (fakes/proxies); `null` = real. */
	openrouterBaseUrl: string | null;
	/** Harness home for the dsh subprocess (sessions, caches). */
	dshHome: string;
	/** Absolute path of the profile overlay. */
	patchPath: string;
	/** Repo root: dsh cwd and the MCP server's cwd. */
	repoRoot: string;
	/** Fixed app origin for the MCP bridge; `null` = derive from the request. */
	appBaseUrl: string | null;
}

function clean(value: string | undefined): string | null {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function resolveAgentConfig(env: EnvRecord, opts: { cwd?: string } = {}): AgentConfig {
	const repoRoot = resolve(opts.cwd ?? process.cwd());
	const reasoningRaw = clean(env.VDJ_AGENT_REASONING) ?? DEFAULT_AGENT_REASONING;
	return {
		apiKey: clean(env.OPENROUTER_API_KEY),
		provider: AGENT_PROVIDER,
		model: clean(env.VDJ_AGENT_MODEL) ?? DEFAULT_AGENT_MODEL,
		reasoning: reasoningRaw.toLowerCase() === 'default' ? null : reasoningRaw,
		openrouterBaseUrl: clean(env.VDJ_OPENROUTER_BASE_URL),
		dshHome: resolve(repoRoot, clean(env.VDJ_DSH_HOME) ?? '.dsh'),
		patchPath: resolve(repoRoot, AGENT_PATCH_RELATIVE),
		repoRoot,
		appBaseUrl: clean(env.VDJ_BASE_URL)
	};
}

export function isAgentConfigured(config: AgentConfig): boolean {
	return config.apiKey !== null;
}

/** Stable identity for "does this config need a fresh runtime?" */
export function agentConfigKey(config: AgentConfig): string {
	return [
		config.apiKey ?? '',
		config.model,
		config.reasoning ?? '',
		config.openrouterBaseUrl ?? '',
		config.dshHome,
		config.patchPath,
		config.appBaseUrl ?? ''
	].join(' ');
}

/** Session ids travel to the harness and into file names: keep them boring. */
export function isValidAgentSessionId(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
}
