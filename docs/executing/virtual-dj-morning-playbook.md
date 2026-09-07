# Virtual DJ — morning playbook (~6am SGT)

Phil: exact steps to smoke the overnight build on the Mac Mini.
Branch: `feat/virtual-dj-v0-2-loop` (PR #3). Placeholders only — no real WAVs, no MCP, no Ableton.

## 1. Boot

```bash
cd ~/kaminocorp/chaos-tone
git checkout feat/virtual-dj-v0-2-loop
git pull
pnpm install
pnpm dev
```

Open the Vite URL (usually http://localhost:5173). System default out on Mini.

## 2. Start deck → hear loop

1. Click **Start deck** once (user gesture → Tone.start).
2. Within a second you should hear deep-house placeholders: kick on quarters, offbeat hats, bass, soft chords.
3. Panel shows energy · revision · bpm · key · bar · phase. `intent:` appears after the first `/api/dj/intent` call.

If silent: check Mini volume / output device, reload, Start deck again.

## 3. Session start + intent morph

In another terminal (same machine):

```bash
curl -s http://localhost:5173/api/dj/session | jq .

curl -s -X POST http://localhost:5173/api/dj/session/start \
  -H 'content-type: application/json' \
  -d '{"client_op_id":"morning-start-1"}' | jq .

REV=$(curl -s http://localhost:5173/api/dj/session | jq .session.revision)
curl -s -X POST http://localhost:5173/api/dj/intent \
  -H 'content-type: application/json' \
  -d "{\"text\":\"take it darker\",\"if_revision\":$REV,\"client_op_id\":\"morning-darker-1\"}" | jq .
```

**What you should hear:** quieter, closed filter, hats/perc ducked. Panel: `intent: take it darker`, energy ~0.15, revision bumped.

## 4. More intents

```bash
REV=$(curl -s http://localhost:5173/api/dj/session | jq .session.revision)
curl -s -X POST http://localhost:5173/api/dj/intent \
  -H 'content-type: application/json' \
  -d "{\"text\":\"drop\",\"if_revision\":$REV,\"client_op_id\":\"morning-drop-1\"}" | jq .

REV=$(curl -s http://localhost:5173/api/dj/session | jq .session.revision)
curl -s -X POST http://localhost:5173/api/dj/intent \
  -H 'content-type: application/json' \
  -d "{\"text\":\"break\",\"if_revision\":$REV,\"client_op_id\":\"morning-break-1\"}" | jq .

REV=$(curl -s http://localhost:5173/api/dj/session | jq .session.revision)
curl -s -X POST http://localhost:5173/api/dj/intent \
  -H 'content-type: application/json' \
  -d "{\"text\":\"make it brighter\",\"if_revision\":$REV,\"client_op_id\":\"morning-bright-1\"}" | jq .
```

Drop = peak lift. Break = dipped break/duck. Brighter = open/loud.

## 5. Verb spot-checks (CAS + idempotency)

```bash
REV=$(curl -s http://localhost:5173/api/dj/session | jq .session.revision)
curl -s -X POST http://localhost:5173/api/dj/bpm \
  -H 'content-type: application/json' \
  -d "{\"bpm\":126,\"if_revision\":$REV,\"client_op_id\":\"morning-bpm-1\"}" | jq .

curl -s -X POST http://localhost:5173/api/dj/bpm \
  -H 'content-type: application/json' \
  -d '{"bpm":126,"if_revision":999,"client_op_id":"morning-bpm-1"}' | jq .

curl -s "http://localhost:5173/api/dj/library/search?role=kick&limit=3" | jq .
```

## 6. Kill switch

Use POST /api/dj/emergency-stop with if_revision + client_op_id. All roles mute, energy 0. Then Stop deck.

## 7. Green checks
out-of-scope-next-MCP
