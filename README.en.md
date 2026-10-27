# Pet Lab

Standalone workspace for the whale-girl pet “大肥鱼”. **It does not depend on Hexo or Butterfly** — a static server is all it needs.
It does not depend on Hexo or Butterfly; porting it to a site means editing a single adapter layer.

## Pages

Double-click `home.html`, or open any page directly:

| Page | Purpose |
| --- | --- |
| `home.html` | Entry point |
| `index.html` | Live demo (needs a server, ES modules) |
| `config-editor.html` | What she **is**: looks, timing, speech, animation library, states (clip, pool, weight) |
| `zone-editor.html` | Body zones: 2D rects, mouse reactions, look and backdrop |
| `rules-editor.html` | **When** she does what: state rules (condition → state) + context rules (condition → line / action) |
| `tests.html` | Test panel: 8 suites, each runnable alone or all at once |

### Division: one field, one page

| Setting | Owned by | Elsewhere |
| --- | --- | --- |
| `animations.*` | `config-editor` | read-only, no entry point |
| `states.*` (`clip` / `pool` / `weight`) | `config-editor` | the rules page no longer shows weights |
| `policy.stateRules` | `rules-editor` | the config page only owns `states` definitions |
| `policy.calendar` | edit the YAML by hand | neither editor touches it |
| `zones` / `zoneReactions` | `zone-editor` | — |
| `rules.items` | `rules-editor` | export contains `policy.stateRules` + `rules.items` only |

Two lines:

- **States are vocabulary, rules are behaviour.** What a state looks like (clip, pool, weight) is
  decided on the config page; when it gets picked is a rule. So `policy.stateRules` lives on the
  rules page next to `rules.items` — both are "condition → result", only the result differs.
- **Exports must not overreach.** The rules page exports only `policy.stateRules` and
  `rules.items`; it no longer carries `states`, whose paste-back would wipe clip/pool/weight.

## Running

**Double-click `start.bat`**: it locates Python, starts a local server and opens the browser. Close the black window to stop.

It runs `tools/serve.py`, which adds two capabilities over a plain static server:

- `POST /api/save` writes files under `config/`
- `POST /api/patch` merges `zones` / `zoneReactions` / `rules.items` and rebuilds
- `POST /api/restore` rolls back to a snapshot in `config/.backup/`

That is why the “Save & build” button needs no terminal. After a successful save the open demo tab reloads itself, and the dev server sends `Cache-Control: no-store`, so a normal refresh already picks up new settings.

You can also start a server by hand:

```powershell
python -m http.server 8080
```

- Entry: <http://127.0.0.1:8080/home.html>
- Demo: <http://127.0.0.1:8080/index.html> (ES modules require HTTP)

> Doubling-clicking an HTML file mostly works (`file://`), but the browser blocks automatic reads — use “Open YAML” in the config editor, or run the server.

## Layout

```
pet-lab/
├─ home.html              entry point
├─ index.html             demo + signal panel
├─ config-editor.html     visual settings
├─ zone-editor.html       visual zones
├─ rules-editor.html      visual rules
├─ docs.html              markdown viewer
├─ start.bat              one-click server
├─ assets/i18n.js         ZH/EN switch + help panels
├─ config/pet.yaml        config source (hand-edited)
├─ js/pet/                ES modules
│  ├─ index.js            entry
│  ├─ core.js             kernel: bus / arbitration / assembly
│  ├─ adapter.js          site layer: DOM / URL / storage / rules
│  └─ modules/            player, machine, actions, speech,
│                         renderers, rules, zones, search
├─ vendor/js-yaml.min.js  YAML parser (editors + build-config)
├─ images/pet/anim/       33 transparent WebM clips + poster.webp
├─ tools/                 build, smoke test, unit tests, dev server
├─ docs/                  API reference, interaction draft, screenshots
├─ LICENSE                code: MIT
├─ LICENSE-ASSETS.md      artwork: CC BY-NC-SA 4.0
├─ CREDITS.md             authors, upstream repos, per-file mapping
└─ release/               distribution README template + per-version notes
```

## Docs

| File | Content |
| --- | --- |
| [STATUS.md](STATUS.md) | Project status: module map, tests, release state |
| [docs/API.md](docs/API.md) | Public API, events, extension points |
| [docs/INTERACTION.md](docs/INTERACTION.md) | Interaction protocol **draft**: consent, voice input (not implemented) |
| [HANDOFF.md](HANDOFF.md) | Pre-refactor history and decisions |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Known issues with causes and fixes |

Chinese versions use the `.en`-less names (`README.md`, `STATUS.md`, `docs/API.md`, `docs/INTERACTION.md`, `HANDOFF.md`, `KNOWN-ISSUES.md`).

## Configuration

```powershell
node tools/build-config.js
```

`config/pet.yaml` → `js/pet-config.json` + `js/pet/config.js`.

At runtime `PetConfig` is deep-merged over built-in defaults, so you only write what you change. Groups: identity, shadow, timing, drag, click, speech, chat, rules, search, animations, zones, zoneReactions.

### Swapping in another pet

Nothing here is specific to the whale girl. Everything character-related lives in the config, so
swapping pets means **editing YAML only**:

| Key | Purpose | When swapping |
| --- | --- | --- |
| `animDir` / `image` | clip directory, poster frame | point at the new assets |
| `clipExt` | clip extension (default `webm`) | change if the art isn't WebM |
| `hostId` | DOM mount id (default `deepseek-pet`) | different value for a second pet on one page |
| `size` | character box `width` / `height`, written to CSS vars | match the new art ratio |
| `accent` | theme colours `primary` / `primary2` / `cyan` | match the new character |
| `persona` | every line: name, intro, sleep, feeding, greetings, streak, icons, credit | rewrite the block |
| `states` / `policy` / `zones` / `rules` | states, arbitration, zones, context rules | redo for the new character |

No character-specific copy is left in code: `js/pet/index.js` reads strings through
`CONFIG.persona.*` and only falls back to neutral defaults. Verified live: switching the config to
"小橘" (an orange cat) plus another asset directory changed the mount id, chat title, input
placeholder, accent colour, character box size and requested asset paths — without touching a
single line of JS.

The CSS root selector is `.dp-root`, not an id, so `hostId` is free to change.

**Art format**: the player only takes alpha WebM (two `<video>` buffers). GIF / APNG / sprite
sheets mean replacing `js/pet/modules/player.js`, whose surface is just
`play / ready / warm / setMirror`.

**Site side**: `js/pet/adapter.js` and `modules/search.js` target Hexo + Butterfly; porting to
another framework means rewriting those two files only.

### Two pets on one page

When the module URL carries `?pet=<name>`, it looks that name up in `window.PetProfiles` for an
override. Different URLs are evaluated as separate module instances, so each gets its own closure,
kernel and storage:

```html
<script>
window.PetProfiles = {
  cat: {
    hostId: 'pet-cat',          // separate mount point
    storageKey: 'pet-cat-v1',   // separate save slot (localStorage key dp:pet-cat-v1)
    offset: { x: 168, y: 8 },   // don't overlap
    size: { width: 150, height: 133 },
    accent: { primary: '#f08a3c', primary2: '#e2603a', cyan: '#ffd08a' },
    persona: { name: '小橘', about: '…', feed: ['…'] },
    states: { idle: { clip: 'sad', pool: ['sad'] }, sleepy: { clip: 'doze', pool: ['doze'] }, busy: { clip: 'think', pool: ['think'] } }
  }
};
</script>
<script type="module" src="/js/pet/index.js"></script>
<script type="module" src="/js/pet/index.js?pet=cat"></script>
```

`pets.html` is a runnable example (whale + cat). Notes:

- `hostId`, `storageKey` and `offset` must differ, or the two instances fight over one mount point
  or sit on top of each other
- `window.PetDebug[hostId]` gives you a debug handle per instance
- Cost: the module body is evaluated twice (shared submodules such as `rules.js` and `adapter.js`
  stay single), so there is one extra closure in memory

### Action menu timing

The column of buttons to the left of the character (feed / chat / hide) stays clickable for a short
grace period after the pointer leaves:

```yaml
ui:
  actionHideDelayMs: 320   # how long it lingers after the pointer leaves
  actionFadeMs: 140        # fade in / out duration
```

The grace period fixes a real usability bug: the buttons sit 8px to the left of the character, and
crossing that gap used to drop `:hover`, so the menu vanished before the pointer arrived. The gap is
now filled with `padding` (the pointer stays inside the element) and the extra 320ms covers slower
movements. Tune the numbers to taste.

## Tests

```powershell
node tools/run-tests.js          # unit: kernel / rules / zones / levels / rules-data
node tools/run-tests.js --all    # plus the end-to-end smoke test (headless Chrome)
```

The smoke test covers: mount, module assembly, bubble rendering, zone clicks, action intents, site search.

Click assertions use `Input.dispatchMouseEvent` — real mouse events. Synthetic `PointerEvent`s cannot exercise drag-vs-click detection.

## Architecture

```
site (data + events) ──signals──▶ rules ──intents──▶ pet modules
```

Three hard constraints:

1. Modules never mutate body state directly (emit `intent.action` / `speech.act`)
2. Single body ownership (conflicts emit `intent.rejected`)
3. The HFSM is internal to the actions module

Read [STATUS.md](STATUS.md) for the module map; [HANDOFF.md](HANDOFF.md) for the pre-refactor history.

## Caching and reloads

**pet-lab (dev)**: config changes need **no** manual `build-config.js` run.

| How you change it | Auto rebuild | Demo reloads |
| --- | --- | --- |
| “Save & build” in an editor | yes | yes (`localStorage` broadcast, instant) |
| Edit `config/pet.yaml` directly | yes (watcher notices within 1 s, snapshots the pre-edit version) | yes (polls `/api/version`, ~2.5 s) |
| Edit `css/` or `js/pet/` | not needed | yes (same watcher, no rebuild) |
| No server (`file://`) | no, run it yourself | no |

`tools/serve.py` also sends `Cache-Control: no-store` for everything, so a normal refresh picks up new settings.

**Blog (production)**: `scripts/pet-version.js` stamps the pet modules at the end of a build —
`HTML → custom-global.js?v=H → index.js?v=H → config.js?v=H`. The hash comes from the sources under
`source/js/pet`, so it is stable across rebuilds and only changes when config or modules really change.
Stamp file: `public/js/pet/version.txt`.

## Version control

`.gitignore` covers `config/.backup/` (local snapshots; the ones taken on a hand edit end with `-edit`), Chrome profiles, debug logs and screenshots, plus `build/` (release artefacts).
`config/pet.yaml` itself **should** be committed — it is the source.

## Releases

```powershell
node tools/release.js 1.0.2            # assemble + verify + pack locally, print the plan
node tools/release.js 1.0.2 --push     # push the release branch, tag, create the GitHub Release
```

Artefacts land in `build/` (ignored): the `pet-lab-1.0.2/` tree, `pet-lab-v1.0.2.zip` and `.sha256`.

Four steps, each one verifying the artefact instead of assuming success:

1. **Assemble** — allow-list only (`SHIP` + `images/pet/**` + `release/README.md`); development
   content is simply not on the list
2. **Verify** — dev files (`tools/manual`, `*.html`, `HANDOFF`, `screenshots`, …) fail the run; every
   file under `js/`, `css/`, `config/`, `vendor/`, `tools/` is compared byte-for-byte with the repo
   (this is the "copy silently didn't run" guard); every `.js` goes through `node --check`; the
   release README must carry this version; and `config/pet.yaml` is recompiled with the bundled
   `tools/build-config.js` and must match the repo's `config.js`
3. **Pack** — a small deterministic ZIP writer (fixed timestamps and ordering), so identical input
   always yields the same sha256
4. **Publish** (`--push`) — mirror into `../pet-dist` (the standalone `release` branch repo), commit,
   push the branch, tag, `gh release create`, then **read the remote asset digest back and compare it
   with the local sha256**

Release notes live in `release/notes/<version>.md`; the shipped README is `release/README.md` with a
`{{VERSION}}` placeholder.

## Known issues

See [KNOWN-ISSUES.en.md](KNOWN-ISSUES.en.md) for the full list with causes and fixes.

## License

| Scope | License | File |
| --- | --- | --- |
| Code (`js/`, `css/`, docs; MIT excludes artwork) | MIT | [LICENSE](LICENSE) |
| Artwork (`images/`) | CC BY-NC-SA 4.0 | [LICENSE-ASSETS.md](LICENSE-ASSETS.md) |
| Attribution and clip mapping | — | [CREDITS.md](CREDITS.md) |

**The artwork is non-commercial**: no ads, sponsorship, paid content or merchandise, and public use
must credit the authors and link the upstream repositories. For commercial use, ask the original
authors.
