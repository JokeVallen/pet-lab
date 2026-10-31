# Project Status

> Updated: 2026-10-26

---

## 1. What this is

A refactor of a site pet from a monolith into a **portable, pluggable** system.

```
site (data + events) ──signals──▶ rules ──intents──▶ pet modules
```

- Pet = actions (required) + speech (optional) + other optional modules
- The site only supplies signals; the pet knows nothing about Hexo or Butterfly
- Porting to another site means rewriting `js/pet/adapter.js` only

## 2. Module map

| File | Size | Responsibility |
| --- | --- | --- |
| `js/pet/core.js` | 7.3 KB | Kernel: bus, priority arbitration, incremental assembly, ring log |
| `js/pet/adapter.js` | 8.9 KB | Site layer: DOM / URL / storage / context rules |
| `js/pet/modules/player.js` | 7.5 KB | Double-buffered player (deps injected) |
| `js/pet/modules/machine.js` | 2.8 KB | Hierarchical state machine |
| `js/pet/modules/actions.js` | 2.3 KB | Action port: intents / state / hold / release |
| `js/pet/modules/speech.js` | 3.3 KB | Speech channel: dedupe, priority queue |
| `js/pet/modules/renderers.js` | 2.3 KB | Bubble / dialog rendering, linkification |
| `js/pet/modules/rules.js` | 3.0 KB | Declarative rules + `compileWhen` / `renderSay` |
| `js/pet/modules/zones.js` | 2.8 KB | Zone geometry + reaction resolution |
| `js/pet/modules/search.js` | 5.2 KB | Site search: lazy index, bigram window, scoring |
| `js/pet/config.js` | generated | Compiled from `config/pet.yaml` |
| `js/pet/index.js` | 57 KB | Entry: interaction, chat, idle scheduling, UI |

Dependencies flow one way: `adapter → signals → rules → intents → modules`.

## 3. Three hard constraints

1. **Modules never mutate body state** — emit `intent.action` or `speech.act`
2. **Single body ownership** — one action at a time, losers get `intent.rejected`
3. **The HFSM is internal to the actions module** — only intents are exposed

Priority levels are numbers: `ambient(1) < scheduled(2) < direct(3) < hold(4)`.
Any number works (`2.5`), and `defineLevel(name, value)` registers new names.

## 4. Configuration

**Source of truth**: `config/pet.yaml` (the only file you edit by hand)

```powershell
# Visual editing (needs the server, see below)
node tools/build-config.js
```

- Parsed with **js-yaml 4.x** (`vendor/js-yaml.min.js`, copied from the blog's `node_modules`)
- Runtime merges `PetConfig` over built-in defaults
- Editors: grouped Chinese/English labels, sliders, toggles, colour picker, chips, category tables

Groups: identity, shadow, timing, drag, click, speech, chat, rules (12 items), search,
animations, **zones (8)**, **zoneReactions (8)**.

Rules and zone reactions are data: `when` uses 14 condition keys; lines support arrays and
`{tag}` / `{streak}` templates.

## 5. Zones

Zones are geometry, mappings are semantics — two independent tables:

```yaml
zones:
  - id: head
    y0: 0
    y1: 0.42

zoneReactions:
  head:
    act: click-shy
    say: [别戳脑袋啦。, 脑袋不能乱摸……]
```

Unmapped zones fall back to their parent (`head.crown → head`), then to `body`, then `null`
(default behaviour). Debug: `?pet-zone=1` draws zone bands over the character.

## 6. Visual tools

`index.html` is the entry point; all three editors open by double-click:

| Page | Purpose |
| --- | --- |
| `config-editor.html` | Looks / timing / speech / pools; can open YAML directly |
| `zone-editor.html` | Drag zones, edit reaction + lines (`text*2` = weight 2), export both sections |
| `rules-editor.html` | Edit the 12 rules as a form (undo / redo), export `rules.items` |

“Save & build” writes through `tools/serve.py` (`/api/save`, `/api/patch`), rebuilds, and
`/api/restore` rolls back to a snapshot in `config/.backup/` (max 20).

## 7. Tests

```powershell
node tools/run-tests.js          # unit
node tools/run-tests.js --all    # unit + end-to-end smoke
```

| Suite | Coverage | Status |
| --- | --- | --- |
| `tests/kernel.test.js` | bus, arbitration, hold/release, assembly | 15 pass |
| `tests/rules.test.js` | order, cooldown, function fields, matchTag | 6 pass |
| `tests/zones.test.js` | child priority, fallback, x ranges, weighted lines | 10 pass |
| `tests/levels.test.js` | numeric levels, custom names | 9 pass |
| `tests/rules-data.test.js` | `compileWhen`, templates, config integrity | 11 pass |
| `tools/smoke.js` | mount, assembly, bubble, clicks, intents, search | 12 pass |
| `tools/i18n-check.js` | zh/en text, titles, placeholders | 10 pass |

The smoke test dispatches **real mouse events** via `Input.dispatchMouseEvent`.

## 8. Known issues

See [KNOWN-ISSUES.en.md](KNOWN-ISSUES.en.md).

## 9. Next steps

1. **Split the entry file**: `doPet` / `doFeed` / `sendChat` are still in `index.js`; they belong to the adapter layer
2. **Externalise phrases**: `REPLIES` and zone reactions could become theme/locale packs
3. **Move state thresholds into config**: the `resolve()` cut-offs (22:00, 06:00, scroll 12 %–92 %) are personality parameters
4. **Third video buffer**: fixes the drag gap
5. **More modules**: music listening, conversational page interaction (both only emit intents)

## 10. Release status

- Toolkit: verified (unit + end-to-end + zh/en consistency)
- Site integration: sync five modules (`adapter` / `config` / `core` / `index` / `rules`); builds stamp a version hash (`pet-version.js`) so visitors never run a stale config
- Assets: code MIT, animations **non-commercial**, attribution required (see `PET_CREDITS.md`)

- The interaction protocol (capability grants / voice input) exists only as a design doc: [docs/INTERACTION.md](docs/INTERACTION.md), not implemented.

- State vocabulary (`states`) is now separate from site policy (`policy`): the pet only resolves state ids, while `PetAdapter.pickState` applies configured rules; the holiday calendar moved out of code into config.

- Test panel `tests.html`: 8 suites (6 unit + smoke + i18n) runnable individually via `POST /api/test`, suite ids whitelisted.
