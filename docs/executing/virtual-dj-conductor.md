# Virtual DJ conductor (in-app)

The instrument on `/` is a human surface over the same HTTP session MCP already uses. Since 0.1.10 it also carries the **AGENT** panel: a chat transcript and push-to-talk mic in front of the in-app DeepSeek Harness agent (see [`virtual-dj-agent.md`](./virtual-dj-agent.md)). The pads and the `> intent` field stay deterministic (phrase mapper, no LLM); the agent panel is where free-form language goes.

## Gesture gate

`Tone.start` only runs from the Start (or Resume) click via `startDeck`. Until the deck is started, intent pads and the `> intent` field are disabled. The shell shows one line: **Start the deck to send intent.**

## Intent

`POST /api/dj/intent` with `{ text, if_revision, client_op_id }`.

Pads send:

| Pad | text |
|-----|------|
| Darker | `take it darker` |
| Softer | `take it softer` |
| Drop | `drop` |
| Break | `break` |
| Build | `build` |
| Stop | `emergency stop` |

On HTTP 409 the client adopts the returned session (refresh) and shows `Revision conflict — session refreshed. …`.

Last-intent plaques are **sentence case**, never ALL CAPS.

## Transport

- IDLE → white **Start** (`startDeck` + `POST /api/dj/session/start`)
- LIVE → Pause / Stop (`/session/pause`, `/session/stop` + `stopDeck`)
- STOPPED / halt → outline **Resume** (start + energy restore + unmute)

Mute buttons call `POST /api/dj/role/mute`. Energy / phase / stem meters read the polled session.

## Agent panel

Third column of the mid row. Status pill (offline / stopped / starting / ready / working / error), transcript with you / agent / verb rows, composer, mic (Chrome Web Speech), “speak replies” toggle. It POSTs `/api/agent/chat` and adopts any DJ session a verb returns, so meters move before the next poll. Deck gating does not apply: the agent can be asked before Start; the panel just reminds you to start the deck to hear it.

## Display vs session

`src/lib/dj/instrument-view.ts` maps session + local deck-started into the four mockup states (IDLE / LIVE groove / LIVE break / STOPPED halt). It does not own session state. Mockup stems are Kick…Vocals (`vox` → VOCALS). `perc` remains API-only.

Stem activity and role-bay VU are **derived from role gain**, not a live analyzer.

North-star PNGs: [`docs/refs/virtual-dj-ui/`](../refs/virtual-dj-ui/README.md).
