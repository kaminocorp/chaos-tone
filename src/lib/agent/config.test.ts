import { describe, it, expect } from 'vitest';
import {
	agentConfigKey,
	DEFAULT_AGENT_MODEL,
	isAgentConfigured,
	isValidAgentSessionId,
	resolveAgentConfig
} from './config';

describe('resolveAgentConfig', () => {
	it('is offline without a key and uses defaults', () => {
		const cfg = resolveAgentConfig({}, { cwd: '/repo' });
		expect(cfg.apiKey).toBeNull();
		expect(isAgentConfigured(cfg)).toBe(false);
		expect(cfg.model).toBe(DEFAULT_AGENT_MODEL);
		expect(cfg.reasoning).toBe('off');
		expect(cfg.dshHome).toBe('/repo/.dsh');
		expect(cfg.patchPath).toBe('/repo/agent/vdj.cordis.patch.yml');
		expect(cfg.appBaseUrl).toBeNull();
	});

	it('reads env overrides and treats "default" reasoning as null', () => {
		const cfg = resolveAgentConfig(
			{
				OPENROUTER_API_KEY: ' sk-or-x ',
				VDJ_AGENT_MODEL: 'openai/gpt-5-mini',
				VDJ_AGENT_REASONING: 'Default',
				VDJ_DSH_HOME: '/tmp/home',
				VDJ_BASE_URL: 'http://127.0.0.1:5199',
				VDJ_OPENROUTER_BASE_URL: 'http://127.0.0.1:9/v1'
			},
			{ cwd: '/repo' }
		);
		expect(cfg.apiKey).toBe('sk-or-x');
		expect(cfg.model).toBe('openai/gpt-5-mini');
		expect(cfg.reasoning).toBeNull();
		expect(cfg.dshHome).toBe('/tmp/home');
		expect(cfg.appBaseUrl).toBe('http://127.0.0.1:5199');
		expect(cfg.openrouterBaseUrl).toBe('http://127.0.0.1:9/v1');
	});

	it('changes its key when the model or key changes', () => {
		const a = resolveAgentConfig({ OPENROUTER_API_KEY: 'a' }, { cwd: '/repo' });
		const b = resolveAgentConfig(
			{ OPENROUTER_API_KEY: 'a', VDJ_AGENT_MODEL: 'x/y' },
			{ cwd: '/repo' }
		);
		expect(agentConfigKey(a)).not.toBe(agentConfigKey(b));
		expect(agentConfigKey(a)).toBe(
			agentConfigKey(resolveAgentConfig({ OPENROUTER_API_KEY: 'a' }, { cwd: '/repo' }))
		);
	});
});

describe('isValidAgentSessionId', () => {
	it('accepts boring ids and rejects the rest', () => {
		expect(isValidAgentSessionId('web-abc_123')).toBe(true);
		expect(isValidAgentSessionId('')).toBe(false);
		expect(isValidAgentSessionId('-lead')).toBe(false);
		expect(isValidAgentSessionId('has space')).toBe(false);
		expect(isValidAgentSessionId('a'.repeat(65))).toBe(false);
		expect(isValidAgentSessionId(42)).toBe(false);
	});
});
