# Handoff: Before the Refactor

> This document records the state **before** the refactor and the bugs that shaped the design.
> For the current architecture see [STATUS.en.md](STATUS.en.md).

---

## The original monolith

One file, ~1450 lines, doing everything:

```
deepseek-pet.js (64 KB)
├─ player        two <video> buffers
├─ state machine idle / reading / sleepy
├─ click zones   three hard-coded y-bands
├─ dialogue      22 regex groups + ad-hoc assembly
├─ context rules 11 if / else-if branches
├─ site search   lazy index + tokenizer + scoring
├─ renderers     bubble + dialog DOM
└─ site access   location / querySelector / localStorage
```

The problem was never length. It was **coupling**: changing a line meant scrolling to line 900;
changing a click zone meant editing coordinate comparisons; adding a feature meant reading all of it.

## Why this shape

The pet only does two things — **move** and **speak**. The site supplies three things — **data**,
**events**, **environment**. Mixing them produces the monolith. So a mediator sits between:

```
site signals → rules → intents → modules
```

## Six concrete differences

### 1. Site coupling: from everywhere to zero

The monolith read `location.pathname` in four places and scattered `document.querySelector`
across word count, comments and tags. Now the pet body has **zero** `location.` and
`querySelector`; all of it lives in `adapter.js` (~9 KB).

### 2. Rules: branches → data

```js
// before: 11 else-if branches, order implicit in code
if (c.page === 'post' && matchTag(c.tags, ['unity'])) { ... }

// now: a table; adding a rule does not touch code
{ id: 'post.unity',
  when: c => c.page === 'post' && matchTag(c.tags, ['unity', 'c#']),
  say: '这篇和 Unity 有关……',
  cooldown: 25 }
```

Bonus: each rule has its **own** cooldown. Previously a global 25 s gate starved every rule after one line.

Later the conditions themselves became data (`when: { page: post, tagsAny: [...] }`), compiled by
`PetRules.compileWhen`, so the rules editor can edit them as a form.

### 3. Actions and speech: two independent channels

`say()` used to write DOM inline and animations called `director.cue()` directly. Now:

```
speak → emit('speech.act')  → bubble / dialog (renderer decides)
move  → emit('intent.action') → kernel arbitration → player
```

Adding TTS means adding a subscriber. Swapping to an LLM means changing a text producer.

### 4. State machine: flat → hierarchical

`idle.sleepy`-style dotted states; children inherit the parent's animation pool. Common behaviour
lives in the parent, children describe only the difference.

### 5. Click zones: geometry and semantics separated

```js
ZONES      // normalised rects, finest match wins
ZONE_MAP   // zone → { act, say, weight }
```

Unmapped zones fall back to their parent; everything else falls back to default behaviour.
Both tables are now in `config/pet.yaml` and editable visually.

### 6. Configuration: hard-coded → YAML

```yaml
shadow:
  offsetX: 0
  offsetY: 10
```

→ visual editor → `node tools/build-config.js` → deep-merged at runtime.

## Costs

| Cost | Detail |
| --- | --- |
| More files | 1 → 12 modules |
| Extra indirection | “what happens on click” spans three layers |
| More code overall | ~64 KB → ~100 KB (module boundaries, injection, degradation paths) |

## Bugs that shaped the design

These are the incidents that produced the current invariants and tests.

### Undeclared globals killed handlers

`justDragged`, `lastScrollSeen`, `mdKey` were assigned without declaration. In strict mode the
handler threw and the interaction silently died. Lesson: a syntax check is not a behaviour check.

### Stale timers interrupted later actions

`dropTimer` was never cleared when `rollTimer` was; a delayed drop fired in the middle of a drag.
Every `clearTimeout(rollTimer)` site now clears `dropTimer` too.

### Drag got stuck floating

`hold` looped the animation forever. Split into `drag-up` (once) / `drag-hold` (loop) / `drag-down`.

### Brace matching cut a function in half

Extracting the speech bridge by matching `{}` stopped at a nested object and inserted code inside
`showBubble`. Lesson: never extract code by brace matching; rewrite the region instead.

### Kernel `start()` returned early

Modules registered after `start()` were never mounted. Fixed with incremental mounting via `mountedIds`.

### `mountSpeech` ran before `build()`

`root` was null. Added a guard and moved `speechMounted = true` after a successful mount.

### Synthetic events hid a deleted handler

`doPet` was deleted accidentally; synthetic `PointerEvent`s still “passed”. Only trusted
`Input.dispatchMouseEvent` revealed that clicks were dead.

### Rules were lost to a bad test

While testing `/api/patch`, a one-rule payload replaced all twelve. The interface was correct —
the test was wrong: it used a replace-style API as a delete-style probe.

## Verification rules learned

1. Use real mouse events for gesture logic
2. Run the smoke test after touching any module
3. Back up `config/pet.yaml` before testing write endpoints (the server now does this automatically)
4. A passing syntax check proves nothing about behaviour
5. A 200 response with `ok: true` can still mean nothing happened — assert on payload fields
