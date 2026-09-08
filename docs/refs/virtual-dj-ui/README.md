# Virtual DJ UI — north star

Jony’s signed-off Chaos Tone instrument mockups (Phil + JM, 2026-09-08/09).

Implement the FE to **match these screens**, not as loose inspiration. Apply Kamino product CI (`apply-kamino-product-ci`: Cockpit + Atelier).

## States

| File | State |
|------|--------|
| `01-idle-start.png` | IDLE — Start (white primary); conductor gated; meters empty |
| `02-live-mid-energy.png` | LIVE mid energy — Pause/Stop; pads live; stem meters + role bays |
| `03-after-take-it-darker.png` | After intent “take it darker” — phase break; last intent sentence case |
| `04-emergency-stop.png` | STOPPED / halt — Resume; Stop pad active; alert on roles |

## Soft rules

- **Last intent:** sentence case (not ALL CAPS)
- **Stem hues:** categorical meters (kick/bass/hats/…) — not brand accent copper
- Agent conductor is a pad row + intent field + plaque — **never a chat thread**
- Wire to existing `/api/dj/*` (same as MCP)

## Structure to match

1. Header: `chaos tone | kamino` + LIVE/IDLE/STOPPED pill + bpm/key/phase/clock
2. Agent conductor: `> intent` + pads Darker/Softer/Drop/Break/Build/Stop + LAST INTENT
3. Main deck: Start / Pause+Stop / Resume; energy meter; stem activity + mod meters
4. Session plaque: BPM/KEY/ENERGY/PHASE + last agent intent + deck/agent/stems legend
5. Role modules: Kick…Vocals bays with mute, meters, status

Source HTML/generator also lived on the shared agent machine under `chaos-tone-ui/` (`generate.py`, state HTMLs).
