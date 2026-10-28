# Pet API Reference

> For anyone extending the pet, porting it to another site, or scripting it.
> Modules talk to each other through **intents** and **events** only.

---

## 1. Kernel `core.js`

```js
import { PetKernel } from './core.js';
```

### 1.1 Event bus

| Method | Notes |
| --- | --- |
| `on(type, fn)` | Subscribe; returns `off()` |
| `emit(type, payload)` | Broadcast; a throwing listener never affects the others |

Built-in events:

| Event | Payload | When |
| --- | --- | --- |
| `action` | `{ act, level, duration, token }` | An action was accepted |
| `intent.rejected` | `{ act, level, by }` | Blocked by a higher priority |
| `action.hold` / `action.release` | `{ act }` | A held state starts / ends |
| `speech.act` | `{ text, channel, priority, ttl }` | A line is requested |
| `kernel.ready` | `{ modules }` | Assembly finished |

### 1.2 Action arbitration

```js
PetKernel.action({ act: 'eat', level: 'direct', duration: 7000 });  // → boolean
PetKernel.hold({ act: 'drag' });      // same as level='hold', never expires
PetKernel.release({ act: 'drag' });
PetKernel.busy();                     // → { act, level } | null
```

**Levels are numbers; names are only conventions:**

| Name | Value |
| --- | --- |
| `ambient` | 1 |
| `scheduled` | 2 |
| `direct` | 3 |
| `hold` | 4 |

```js
PetKernel.level('direct');            // → 3
PetKernel.level(2.5);                 // → 2.5 (any number works)
PetKernel.defineLevel('cinematic', 5);
```

Rule: if the current occupancy level is higher than the requested one, the request is rejected and `intent.rejected` fires.

`duration` is **how long the body stays claimed**, not how long the clip runs — the player knows the clip length.

### 1.3 Module assembly

```js
PetKernel.register({
    id: 'my-module',
    requires: ['speech'],          // dependencies, topologically ordered
    provides: ['speech.voice'],    // capability declaration
    mount(ctx) { /* ... */ },      // required
    unmount() { /* idempotent */ }
});

PetKernel.start();   // safe to call repeatedly; mounts only what is missing
PetKernel.stop();
PetKernel.modules(); // → ['speech','actions',...]
PetKernel.log();     // ring buffer of 200: mount / action / reject / error
```

### 1.4 Mount context `ctx`

```js
{
    id,                        // module id
    on, emit,                  // bus
    action, hold, release, busy,
    speech(act),               // equals emit('speech.act', act)
    store(ns),                 // namespaced localStorage: get/set/remove
    log
}
```

---

## 2. Speech channel `modules/speech.js`

```js
import { PetSpeech } from './modules/speech.js';

const speech = PetSpeech.createSpeechModule({
    renderBubble(text, ttl) {},
    renderDialog(text) {},
    isDialogOpen() { return false; },
    dedupeMs: 8000,      // suppress repeats
    maxQueue: 8
});
```

Behaviour:

- Identical text within 8 s is dropped, `speech.dropped` is emitted
- Queued by `priority`: `reply(3) > context(2) > ambient(1)`
- With `channel: 'auto'`, an open dialog receives the line; otherwise a bubble is used

---

## 3. Renderers `modules/renderers.js`

```js
import { PetRenderers } from './modules/renderers.js';

const bubble = PetRenderers.bubble(rootEl);        // (text, ttl) => void
const dialog = PetRenderers.dialog(logEl, { max: 10, onRendered });
PetRenderers.fillText(el, 'Results: /knowledge/#tcp');  // site paths → <a class="dp-link">
```

Swapping a renderer changes bubble style, TTS output, or a danmaku overlay — producers stay untouched.

---

### 3.x States

The pet only declares the state vocabulary; it never decides when to enter one.

```js
import PetConfig from './config.js';
PetConfig.states;          // { idle: { clip, pool, weight }, sleepy: {...}, busy: {...} }
```

| Method | Meaning |
| --- | --- |
| `PetAdapter.pickState(ctx)` | Applies `policy.stateRules`; without a match it rolls on `states.*.weight` (`idle` by default) |
| `PetAdapter.holiday(date?)` | Returns `{ act, line }` from `policy.calendar`, or `null` |
| `ctx` | `{ page, type, tags, words, comments, scroll, dark, hour }` |

`policy` is site-side data: porting a site means editing config, not pet code. Unknown states fall back to `idle`.

`stateRules` uses the same operator table as `rules.items` (see 7.1), so both sides speak one
vocabulary. The old key names stay valid as aliases:

| Old key (stateRules) | Now equivalent to |
| --- | --- |
| `hourBelow` | `hourLt` |
| `hourFrom` | `hourGte` |
| `scrollFrom` | `scrollGte` |
| `scrollTo` | `scrollLte` |

Boundaries match the old semantics (`Gte` / `Lte` are inclusive). Aliases are normalised once
in the adapter and the compiled predicate is cached per `when` object, so the frequent
`pickState` calls never recompile.

---

## 4. Action port `modules/actions.js`

```js
import { PetActions } from './modules/actions.js';

const actions = PetActions.createActionsModule({
    play(act) {}, hold(act) {}, release(act) {}, setState(s) {}
});
```

Subscribes to four intents:

| Intent | Payload |
| --- | --- |
| `intent.action` | `{ act, level, duration }` |
| `intent.state` | `{ state }` |
| `intent.hold` | `{ act }` |
| `intent.release` | `{ act }` |

---

## 5. State machine `modules/machine.js`

```js
import { PetMachine } from './modules/machine.js';

const m = PetMachine.createMachine({
    initial: 'idle',
    states: {
        idle: { pool: ['look', 'hum'] },
        'idle.sleepy': { pool: ['yawn'] },      // no pool → inherit from parent
        reading: { pool: ['think'] }
    },
    resolve: (ctx) => (ctx.hour >= 22 ? 'idle.sleepy' : 'idle')
});

m.sync(ctx);        // transition via resolve
m.set('reading');   // explicit transition
m.state();          // → 'idle'
m.actions();        // current pool, inheriting from parents
m.parents('a.b.c'); // → ['a','a.b','a.b.c']
m.onEnter((next, prev) => {});
```

**Cost of adding a state:** one key in `states`, `O(1)`; no index rebuild.
The real cost is whatever you add to `resolve()`. Keep it a short table once you pass ~6 branches.

---

## 6. Zones `modules/zones.js`

```js
import { PetZones } from './modules/zones.js';

const zones = PetZones.createZones({ zones: ZONES, map: ZONE_MAP, fallback: 'body' });

zones.hit(y, x);        // normalised 0..1 → finest zone id
zones.resolve(id);      // → { zone, rule } | null (walks up the parent chain)
zones.pickSay(rule);    // supports [{ t: 'line', w: 2 }]
```

Zones are **2D rectangles** in normalised coordinates (0..1), independent of the character image size:

```js
{ id: 'head.crown.tip', xMin: 0.40, yMin: 0.00, xMax: 0.60, yMax: 0.05, parent: 'head.crown' }
```

- Omit `xMin` / `xMax` for full-row bands, so older configs stay valid
- Siblings may overlap freely: deeper zones win, and at the same depth the **smaller area wins**, so results never depend on declaration order

Hit testing is a linear scan: 8 zones ≈ 1 µs, 100 zones ≈ tens of µs — negligible next to gesture handling.

In the zone editor you can **drag a rectangle** right on the character (`＋ Draw new`, or hold Shift), release to create it, then set its parent and reaction on the right.

**A zone without a reaction is not an error**: it falls back to its parent, then to `fallback`, then `null` (default behaviour).

---

## 7. Rules `modules/rules.js`

```js
import { PetRules } from './modules/rules.js';

const engine = PetRules.createEngine(rules, { cooldown: 25 });
engine.evaluate(ctx, env);   // → { id, say, act } | null

PetRules.compileWhen({ page: 'post', tagsAny: ['unity'] });  // declarative → predicate
PetRules.renderSay(['a {tag}'], ctx, { tagName: 'Unity' });  // template + random pick
```

Rule data (from `config/pet.yaml`):

```yaml
rules:
  items:
    - id: post.unity
      when: { page: post, tagsAny: [unity, "c#"] }
      say: 这篇和 Unity 有关……
      act: look
      cooldown: 25
```

Array order is priority; the first match wins. A throwing predicate counts as no match.

### 7.1 Declarative conditions and custom operators

`PetRules.compileWhen(spec)` turns `{ key: value }` into a predicate. Every key is one
entry in the operator table:

```js
PetRules.compileWhen({ page: 'post', wordsGt: 800 });
```

Built-in keys (also what `getWhenKeys()` returns, and what the editor dropdown lists):

| Key | Kind | Meaning |
| --- | --- | --- |
| `page` / `type` | text | page kind / sub type |
| `tagsAny` | text[] | any tag contains |
| `wordsGt` / `wordsLt` | number | body length above / below (0 words is not "short") |
| `commentsEq` / `commentsGte` | number | comment count equals / at least |
| `scrollGt` / `scrollLt` | number | reading progress above / below |
| `lastScrollGt` | number | scroll delta since last time (reads `env.lastScroll`) |
| `dark` | bool | dark theme on |
| `hourGte` / `hourLt` | number | hour of day |
| `streakGte` | number | consecutive-day streak (reads `env.streak`) |

`PetRules.getWhenMeta()` returns what the editors need: `{ key, kind, label, legacy }`.
Both editors build their dropdowns from it instead of keeping their own label tables.
Legacy keys (`hourBelow` / `hourFrom` / `scrollFrom` / `scrollTo`) show up at the end marked
`legacy`, labelled "hour < (old)"; switching them to the new key keeps the value instead of
resetting it to 0.

To add a condition, register an operator — config and the editor dropdown follow:

```js
PetRules.registerWhen('hasQuote', {
    kind: 'bool',                                  // bool / tags / text / number
    test: (ctx, value, env) => ctx.words > 100
});

// now the config may use
// when: { hasQuote: true }
```

- `test(ctx, value, env)` returning truthy means match; a throw counts as no match.
- **Unknown keys never match** (fail-closed): a typo makes the rule dead instead of
  making it match everything.
- The editor `import()`s this module at boot and reads `getWhenKeys()`, so any
  registered key is recognised in the dropdown (no red "unknown key" warning).

---

## 8. Site adapter `site.js` + `adapter.js`

### 8.1 One door: `window.SiteAPI`

```js
import { PetSite } from './site.js';

await PetSite.ready();               // once per session
const ctx = await PetSite.context();  // { type, id, title, path, ... }
const rows = await PetSite.search('object pool', { limit: 3 });
await PetSite.navigate('/algorithm/');
await PetSite.action('bookmark.toggle', { type: 'post', id, title, path });
```

`site.js` contains no DOM selectors, no `location`, no `localStorage`, no `content-db`.
Anything the site does not expose is treated as unknown (empty value) instead of being fetched behind its back.

| Scope | What the pet uses it for |
| --- | --- |
| `read` | `currentContext()`, `content().search()`, `content().list('document')` |
| `read-local` | `reading().get()`, `bookmarks().list()` |
| `write-local` | `userState()`, `actions().invoke('bookmark.*' / 'reading.*' / 'note.*')` |

Writes always go through `actions().invoke`, and the pet **never fakes `confirmed`**:
operations that need consent let the SiteAPI prompt, and a refusal is simply not done.

### 8.2 Throttling: keep the first paint light

`SiteAPI.ready()` makes the site load its content library (a multi-megabyte `content-db.json`),
so the pet does not call it during first paint:

- on mount it only reads `currentContext()` (no network);
- after `site.readyDelayMs` (default 6s) it calls `ready()`, which also starts reading-position tracking;
- post metadata (tags / word count) is fetched 2s later, and only if the configured rules really use
  `tagsAny` / `wordsGt` / `wordsLt`;
- `site.postMeta: false` turns that step off entirely.

### 8.3 Members

| Member | Returns | Notes |
| --- | --- | --- |
| `init()` / `refresh()` | `Promise<ctx>` | start / re-read after navigation |
| `context()` | `ctx` | synchronous snapshot the rule engine reads |
| `ensureReady()` | `Promise<boolean>` | throttled `SiteAPI.ready()` |
| `loadMeta()` | `Promise<doc \| null>` | on-demand post metadata |
| `pageType()` | `'post' \| 'tag' \| ...` | derived from `context.type` + `path` |
| `tags()` / `wordCount()` | `string[]` / `number` | from the content library, empty when absent |
| `commentCount()` / `isDark()` | `null` | not exposed by SiteAPI: always unknown |
| `scrollRatio()` | `0~1` | from the site's `reading:position` events |
| `tagName()` | `string` | parsed from `path`, no DOM |
| `rawGet/rawSet/rawRemove` | any | stored under `userState('pet.*')` |
| `rules` | `Rule[]` | context rules |

### 8.4 Porting to another site

As long as the site implements `window.SiteAPI` (even a minimal one: `ready / currentContext /
content.search / actions.invoke / userState / events`), the pet needs no changes — `site.js` is the
entire coupling surface. Without SiteAPI the pet still runs: animation, dialogue and replies are local;
only site context and search are missing.

---

## 9. Search `modules/search.js`

The index belongs to the site; the pet only decides whether a sentence is a site question and
phrases the result.

| Member | Notes |
| --- | --- |
| `matches(text)` | intent regex from `content.search.intent` |
| `answer(text)` | `Promise<string>` via `PetSite.search()`; `null` when nothing matched |
| `ensure()` | kept as a no-op for compatibility (nothing is preloaded) |

Stopwords, intent regex and wording live in `content/<lang>.js` under `search`.

---

## 10. Copy `content/`

```js
import { PetContent } from './content/index.js';

PetContent.t('mood.sleeping');                 // one string in the current language
PetContent.t('site.streak', { n: 3 });         // {name}-style interpolation
PetContent.pick('chat.fallback');              // random entry from an array (variables too)
PetContent.list('zone.tail');                  // the whole array (a copy)
PetContent.replies();                          // [{ id, re, lines }], regexes compiled on read
PetContent.lang;                               // 'zh' | 'en'
PetContent.setLang('en');                      // switch at runtime; missing keys fall back to Chinese
```

- Data lives in `content/zh.js` and `content/en.js` with identical shapes; a new language = one new file plus a `PACKS` entry in `content/index.js`.
- Keys are dotted paths: `chat.replies`, `adapter.finished`, `search.kindCard`.
- Missing keys resolve current language → Chinese → the key itself, so gaps show up instead of going silent.
- Regex-shaped copy (`search.intent`, `site.patterns.*`) is compiled by the caller with `new RegExp(...)` and cached per language.

---

## 11. Configuration

```js
import PetConfig from './config.js';   // compiled from config/pet.yaml
```

See `config/pet.yaml`, or open `config-editor.html`.

### 11.1 Character portability

Swapping in another pet needs only these keys; nothing character-specific is hardcoded:

| Key | Type | Meaning |
| --- | --- | --- |
| `animDir` | text | clip directory, joined as `animDir + clip + '.' + clipExt` |
| `clipExt` | text | clip extension, default `webm` |
| `image` | text | poster frame |
| `hostId` | text | DOM mount id, default `deepseek-pet` |
| `size` | `{width, height}` | character box, written to `--dp-w` / `--dp-h` |
| `accent` | `{primary, primary2, cyan}` | theme colours, written to the same CSS variables |
| `persona` | object | every line and the character voice, see below |

```yaml
persona:
  name: 小橘                 # chat title, aria-labels, placeholder
  alt: 橘猫小橘              # image alt
  icons: { feed: "🐟", restore: "🐱" }
  about: opening line in the chat window
  sleep: said when dozing off
  feed: [feeding lines…]     # array = pick one at random
  greet:
    late: [...]              # 00-05
    morning: [...]           # 06-11
    afternoon: [...]         # 12-17
    evening: [...]           # 18-23
  firstMeet: first visit
  again: seen you before
  streak3: back again, day {n}.          # {n} is the streak length
  streak7: day {n} already, I know you.
  credit: attribution HTML (links allowed)
```

Values come from `CONFIG.persona`; missing keys fall back to neutral defaults, so `name` alone is
enough to run.

---

## 12. Debug handles

```js
window.PetDebug.kernel   // fire intents, read the log
window.PetDebug.search   // test search alone
window.PetDebug.zones    // zone hit testing
window.PetDebug[name]    // per instance: director / player / config / content / state
window.PetDebug[name].reply('hello')  // run "user says > what she answers"
window.PetContent        // copy layer; setLang switches language
window.PetKernel         // shortcut kept for convenience
```

Zone overlay: add `?pet-zone=1` to the page URL — zone bands are drawn over the character and the current zone id shows in the corner.
