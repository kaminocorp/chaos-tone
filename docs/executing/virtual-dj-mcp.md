# Virtual DJ MCP
Thin stdio MCP bridge over the running app HTTP API. SoT stays in chaos-tone.

## Prerequisites
1. App up via Vite on port 5173
2. Start deck once in the browser
3. Install deps including MCP SDK zod tsx

## Run
Script: mcp:vdj (see package.json). Env VDJ_BASE_URL overrides base (default http://localhost:5173).

## Tools to HTTP
- intent -> POST /api/dj/intent
- session_get -> GET /api/dj/session
- session_start / session_stop -> POST /api/dj/session/start|stop
- set_energy -> POST /api/dj/energy
- set_bpm -> POST /api/dj/bpm
- swap_role mute_role solo_role set_role_gain set_role_filter -> POST /api/dj/role/*
- transition drop break emergency_stop -> matching /api/dj/*
- library_search -> GET /api/dj/library/search

Mutators accept optional if_revision and client_op_id. Missing client_op_id is auto-filled as mcp-uuid. HTTP 409 revision conflicts surface as MCP tool errors with a refresh hint.
Host config: MCP name virtual-dj; cwd chaos-tone on Mini; VDJ_BASE_URL to Vite.
Launcher package script mcp:vdj or tsx mcp/vdj/server.ts.
Cursor MCP settings or mcp.json. Claude Code mcpServers entry.
Smoke: Vite, Start deck, enable MCP, session_get, session_start, intent with if_revision. On 409 refresh revision.
Files: mcp/vdj/client.ts server.ts client.test.ts. See virtual-dj-next-steps.md.
