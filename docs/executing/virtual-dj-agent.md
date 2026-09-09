# Virtual DJ agent — DeepSeek Harness + OpenRouter

*Phil's direction (2026-09-09): talk to the agent from the platform itself — text and voice — and have it change what's playing. The open-source [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) is lifted in as the app's native agent; models come from OpenRouter.*

The morning-loop agents (Claude Code, Cursor) keep working exactly as before through MCP. This adds a third brain that lives inside chaos-tone and a human surface for it in the Cockpit.

---

## Shape

```
browser (Cockpit · AGENT panel: chat + push-to-talk)
   │ POST /api/agent/chat  (SSE stream of ConductorEvents)
   ▼
SvelteKit server ── src/lib/agent/runtime.ts ──stdio JSON-RPC──► dsh --profile sdk  (DeepSeek Harness, subprocess)
   ▲                                                                    │
   │ /api/dj/*  (same verbs MCP always used)                            │ MCP stdio (dsh-mcp-client)
   └──────────────────────────────────────── mcp/vdj/server.ts ◄────────┘
```

- **Brain:** the harness runtime, launched once per server process and driven over its SDK protocol by `@deepseek-ai/dsh-sdk-client`. Model route: OpenRouter via the harness's pi-ai adapter. Default model `deepseek/deepseek-v4-flash`, reasoning off (a live room cannot wait for thinking tokens).
- **Hands:** the existing Virtual DJ MCP server, unchanged. The harness mounts it over stdio; its 16 verbs show up to the model as `mcp__vdj__<verb>` and nothing else does — every filesystem, shell, web, subagent and planning tool row is disabled in the overlay.
- **Deck:** unchanged. Verbs land on the session store, the browser polls, Tone.js follows on the next bar. `last_intent` now also records what the human said to the agent, so the plaque shows it before the first verb lands.
- **Voice:** Web Speech API in the browser. Push-to-talk recognition, optional spoken replies. Chrome on the Mini; Safari and Firefox fall back to text.

## Why a subprocess and not an in-process plugin

The harness's own architecture rules say only the `dsh` launcher boots a profile and that direct in-process plugin mounting is not a supported application path. Its supported embedding is the TypeScript SDK client, which spawns `dsh --profile sdk` and speaks newline-delimited JSON-RPC. That is what `runtime.ts` does. Custom behaviour goes into a **profile overlay** (`agent/vdj.cordis.patch.yml`), not into forked harness code, so upgrading the harness is a version bump.

The three `@deepseek-ai/*` packages are pinned to the same `0.1.2-rc.1`: the client refuses a runtime of another version, and the rc's `dsh-sdk-jsonrpc-server` needs `dsh-sdk-protocol` installed explicitly (npm's `latest` tag still points at an older `0.0.1-rc.1`). pnpm 10 ignores the harness's optional native postinstalls (`node-pty`, `koffi`, `dsh-subprocess-local`); the sdk profile boots without them.

## Files

| File | Role |
|------|------|
| `agent/vdj.cordis.patch.yml` | Profile overlay: DJ persona, tool roster, OpenRouter route, MCP mount |
| `src/lib/agent/config.ts` | Env → `AgentConfig` (pure) |
| `src/lib/agent/events.ts` | `ConductorEvent` vocabulary + harness event → event mapping (pure) |
| `src/lib/agent/runtime.ts` | `AgentRuntime`: spawn, handshake, per-conversation sessions, restart |
| `src/routes/api/agent/status` | GET: configured / state / model / tools |
| `src/routes/api/agent/chat` | POST `{ text, session_id }` → SSE |
| `src/routes/api/agent/restart` | POST: relaunch the subprocess (after editing the overlay) |
| `src/lib/dj/agent-client.ts` | Browser SSE client (`parseSseBuffer` is pure) |
| `src/lib/dj/voice.ts` | Web Speech wrappers + pure helpers |
| `src/lib/components/dj/ConductorChat.svelte` | The AGENT panel |
| `scripts/agent-smoke.ts` | End-to-end smoke, with an offline fake model |

## Setup

1. `cp .env.example .env` and set `OPENROUTER_API_KEY` (from openrouter.ai/keys). Without it the AGENT panel shows **offline** and everything else keeps working.
2. `pnpm install` (the harness is already a dependency). Node must satisfy the harness range `^22.19 || >=24`; `.nvmrc` says 22, so use a current 22.x.
3. `pnpm dev`, open `/`. The panel reports **stopped** until the first message, then **starting** (about two seconds: dsh boot plus MCP discovery), then **ready**.
4. Start the deck, then type or press the mic: “take it darker and a touch slower”, “drop in eight bars”, “mute the hats”.

| Variable | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for the agent |
| `VDJ_AGENT_MODEL` | `deepseek/deepseek-v4-flash` | Any OpenRouter model id with tool calling |
| `VDJ_AGENT_REASONING` | `off` | pi-ai level: `off`, `low`, `medium`, `high`, or `default` |
| `VDJ_DSH_HOME` | `<repo>/.dsh` | Harness home (gitignored) |
| `VDJ_OPENROUTER_BASE_URL` | real OpenRouter | Point the route at a proxy or the fake |
| `VDJ_BASE_URL` | request origin | Where the MCP bridge finds this app |

Changing any of these needs a dev-server restart (the runtime is keyed on its config).

## Runtime lifecycle

- One `dsh` subprocess per SvelteKit server process, started lazily on the first message. One harness session per browser conversation (a page reload starts a new conversation; the DJ session itself survives, as it always has).
- Turns are serialized per conversation. There is no wire-level cancel in the harness protocol; a turn runs to idle.
- A dead subprocess is reaped and relaunched on the next message. `POST /api/agent/restart` relaunches on demand — needed after editing the overlay, because the sdk profile applies patches at startup only.
- `.dsh/` holds the harness's own state (session JSONL, storages, anonymous id). It is gitignored and not part of the product's stateless-v1 promise; delete it freely.
- Telemetry is disabled in the child (`DSH_TELEMETRY_DISABLED=1`). Nothing leaves the machine except the model request to OpenRouter and, in Chrome, speech recognition audio to Google's recognizer.
- Approval never blocks: the roster contains only MCP verbs and the harness only asks before shell or file effects, which do not exist here.

## The overlay, block by block

- **`system-prompt`** — replaces the coding-agent persona with the DJ brief (energy scale, roles, verbs, act-before-replying, one plain sentence under 25 words so it can be spoken). Harness identity and runtime-context snapshots are switched off so no sandbox prose reaches the model.
- **disabled rows** — `agent-instructions` (would inject this repo's CLAUDE.md), telemetry, the repeat-tool reminder, plan mode, and every `tool-*` row except the MCP one.
- **`llm-pi-ai`** — the base profile mounts pi-ai dormant; the overlay gives it one `openrouter` route (`apiKeyEnv: OPENROUTER_API_KEY`, attribution headers, two retries). pi-ai's installed catalog already knows OpenRouter's endpoint, protocol and 300+ models, including the DeepSeek V4 family.
- **`mcp-vdj` insert** — `dsh-mcp-client` runs `node_modules/.bin/tsx mcp/vdj/server.ts` with cwd at the repo root and `VDJ_BASE_URL` in its env; `failOnStartupError: true` so a broken bridge fails the handshake loudly instead of yielding a mute agent.

## Chat protocol

`POST /api/agent/chat` streams `data: <ConductorEvent>` frames until the agent is idle.

| type | payload | meaning |
|---|---|---|
| `status` | `running` / `idle` | whole-agent state |
| `text` | `delta` | streamed reply tokens |
| `assistant` | `text` | one assembled assistant message (a step may have several) |
| `tool-call` | `callId`, `tool`, `args` | verb requested (`mcp__vdj__` stripped) |
| `tool-result` | `callId`, `ok`, `summary`, `session?` | verb outcome; `session` is the DJ snapshot the UI adopts immediately |
| `error` | `message`, `code?` | turn or transport failure |
| `done` | `text` | final reply text |

## Voice mode

Push the mic (Chrome): interim words show in the transcript while you speak, the final phrase is sent when you pause. “speak replies” reads the agent's sentence back with speech synthesis; the mic cancels any speech first so it does not hear itself. No server-side STT/TTS yet — Whisper-style transcription stays on the sketchbook roadmap.

## Smoke

```sh
pnpm agent:smoke --fake                 # offline: fake model → set_energy 0.15 → PASS/FAIL
pnpm agent:smoke                        # real OpenRouter with .env key, prints the whole turn
pnpm agent:smoke --fake-server          # keep a fake model up, then run pnpm dev with the printed env
```

The app must be running at `--base` (default `http://localhost:5173`). `--fake` proves the whole chain without a key: runtime → dsh → MCP stdio → HTTP → session store, and asserts the session's energy actually changed.

## Troubleshooting

- **offline** — no `OPENROUTER_API_KEY` in `.env`; restart `pnpm dev` after adding it.
- **OpenRouter rejected the key (401)** — the key reached OpenRouter and was refused; check it at openrouter.ai.
- **runtime failed to start** — `/api/agent/status` carries the harness's stderr tail in `error`. Usual causes: Node below 22.19, a stale `node_modules`, or the MCP server failing (`pnpm mcp:vdj` by hand shows why).
- **verbs succeed but nothing changes** — the bridge is talking to another origin. Set `VDJ_BASE_URL` to the port you actually opened.
- **edited the overlay, nothing changed** — `POST /api/agent/restart`.

## Not in this slice

- Vercel: the agent needs a long-lived Node process and a subprocess; on the Mini it runs under `pnpm dev` / `pnpm preview`. The Vercel build still succeeds; the panel simply reports offline there.
- Cancel mid-turn (the harness protocol has no cancel yet), persistence of conversations, multi-user, server-side transcription, Ableton.
