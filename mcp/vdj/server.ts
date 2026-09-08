#!/usr/bin/env node
/**
 * Virtual DJ MCP stdio server — mirrors HTTP verbs on the running chaos-tone app.
 * Default base: http://localhost:5173 (override with VDJ_BASE_URL).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createDjHttpClient, formatToolResult } from './client.js';

const metaShape = {
	if_revision: z.number().int().nonnegative().optional(),
	client_op_id: z.string().min(1).optional(),
	bars: z.number().optional()
};

const role = z.string().min(1);

function buildServer() {
	const client = createDjHttpClient();
	const server = new McpServer({
		name: 'virtual-dj',
		version: '0.1.8'
	});

	server.tool(
		'intent',
		'Natural-language DJ intent (mapped server-side). Requires running app.',
		{ text: z.string().min(1), ...metaShape },
		async (args) => formatToolResult(await client.intent(args))
	);

	server.tool('session_get', 'Read current DJ session (revision, energy, roles).', {}, async () =>
		formatToolResult(await client.session_get())
	);

	server.tool(
		'session_start',
		'Mark session playing (CAS + idempotency).',
		{ ...metaShape },
		async (args) => formatToolResult(await client.session_start(args))
	);

	server.tool(
		'session_stop',
		'Mark session idle.',
		{ ...metaShape },
		async (args) => formatToolResult(await client.session_stop(args))
	);

	server.tool(
		'set_energy',
		'Set master energy 0..1 (audible filter/gain).',
		{ energy: z.number().min(0).max(1), ...metaShape },
		async (args) => formatToolResult(await client.set_energy(args))
	);

	server.tool(
		'set_bpm',
		'Set session BPM.',
		{ bpm: z.number().positive(), ...metaShape },
		async (args) => formatToolResult(await client.set_bpm(args))
	);

	server.tool(
		'swap_role',
		'Swap a role to a stem id (from library_search).',
		{ role, stem_id: z.string().nullable().optional(), ...metaShape },
		async (args) => formatToolResult(await client.swap_role(args))
	);

	server.tool(
		'mute_role',
		'Mute or unmute a role.',
		{ role, mute: z.boolean(), ...metaShape },
		async (args) => formatToolResult(await client.mute_role(args))
	);

	server.tool(
		'solo_role',
		'Solo or unsolo a role.',
		{ role, solo: z.boolean(), ...metaShape },
		async (args) => formatToolResult(await client.solo_role(args))
	);

	server.tool(
		'set_role_gain',
		'Set role gain 0..1.',
		{ role, gain: z.number().min(0).max(1), ...metaShape },
		async (args) => formatToolResult(await client.set_role_gain(args))
	);

	server.tool(
		'set_role_filter',
		'Set role filter 0..1.',
		{ role, filter: z.number().min(0).max(1), ...metaShape },
		async (args) => formatToolResult(await client.set_role_filter(args))
	);

	server.tool(
		'transition',
		'Start a transition over N bars (energy dip + ducks).',
		{ bars: z.number().positive(), ...metaShape },
		async (args) => formatToolResult(await client.transition(args))
	);

	server.tool('drop', 'Peak energy lift.', { ...metaShape }, async (args) =>
		formatToolResult(await client.drop(args))
	);

	server.tool('break', 'Energy dip + duck bright roles.', { ...metaShape }, async (args) =>
		formatToolResult(await client.break(args))
	);

	server.tool(
		'emergency_stop',
		'Mute all, idle, energy 0.',
		{ ...metaShape },
		async (args) => formatToolResult(await client.emergency_stop(args))
	);

	server.tool(
		'library_search',
		'Search stub/real stem library by q/role/limit.',
		{
			q: z.string().optional(),
			role: z.string().optional(),
			limit: z.number().int().positive().optional()
		},
		async (args) => formatToolResult(await client.library_search(args))
	);

	return server;
}

async function main() {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error('virtual-dj MCP server failed:', err);
	process.exit(1);
});
