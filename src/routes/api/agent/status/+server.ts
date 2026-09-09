import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { resolveAgentConfig } from '$lib/agent/config';
import { getAgentRuntime } from '$lib/agent/runtime';

/** agent_status — is the Virtual DJ agent configured, running, and with which tools? */
export const GET: RequestHandler = () => {
	const runtime = getAgentRuntime(resolveAgentConfig(env));
	return json({ ok: true, ...runtime.status() });
};
