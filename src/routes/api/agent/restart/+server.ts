import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { resolveAgentConfig } from '$lib/agent/config';
import { getAgentRuntime } from '$lib/agent/runtime';

/**
 * agent_restart — stop and relaunch the harness subprocess. Use after editing
 * agent/vdj.cordis.patch.yml (patches apply at startup only).
 */
export const POST: RequestHandler = async ({ url }) => {
	const runtime = getAgentRuntime(resolveAgentConfig(env));
	if (!runtime.status().configured) {
		return json(
			{ ok: false, error: 'agent is offline: OPENROUTER_API_KEY is not set' },
			{ status: 503 }
		);
	}
	try {
		await runtime.restart(url.origin);
	} catch (error) {
		return json(
			{
				ok: false,
				...runtime.status(),
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 502 }
		);
	}
	return json({ ok: true, ...runtime.status() });
};
