# Site integration requirements (for the site maintainer)

| Field | Value |
| --- | --- |
| **Document version** | `preq-1.1` |
| **Targets SiteAPI** | `1.1.0` (site-side changes: `SITE_API_CHANGELOG.md`) |
| **Last updated** | 2026-10-28 |
| **Maintained by** | pet side (pet-lab) |
| **Items** | 13 (R1–R13) |
| **Chinese version** | [SITE_API_REQUIREMENTS.md](SITE_API_REQUIREMENTS.md) |

> **Consumer**: the pet-lab desktop pet. It talks to the site **only** through `window.SiteAPI`:
> no DOM queries, no direct `content-db` access, no `localStorage`.
> **Based on**: `SITE_API_INTEGRATION_GUIDE.md`, `SITE_API.md`.
> **Status**: these 13 items shipped in SiteAPI 1.1.0 and were integrated/verified from the pet side;
> the status table below records how each one landed.
>
> **Citation format**: quote the document version and item id, e.g. `preq-1.1 / R7`.
> Versioning and increment rules live in [section 7](#7-versioning-and-increments).

## Delivery status (verified from the pet, 2026-10-28)

| ID | Status | How it landed |
| --- | --- | --- |
| R1 | ✅ integrated | light `ready()` + `readyContent()`; the pet calls `ready()` on mount, scroll tracking from first paint |
| R2 | ✅ integrated | `currentContext().tags` / `wordCount`; post pages never load the content DB (0 `content-db.json` requests measured) |
| R3 | ✅ integrated | `currentContext().contentId`; full text via `ensureContent()` |
| R4 | ✅ integrated | `type` taken directly from the site; no path parsing (the guess remains only as a 1.0 fallback) |
| R5 | ✅ integrated | `theme` + `context:change`; both theme lines restored (verified for dark and light) |
| R6 | ✅ integrated | `comments` + `commentsAvailable`; when false the pet treats it as unknown (`null`), so the rules stay dormant |
| R7 | ◐ partial | new `/search-index.json` (1.2 MB) serves search, so searching no longer pulls the 5.2 MB DB; `content-db.json` itself is still uncompressed |
| R8 | ✅ integrated | search rows carry `paperId` / `questionId` (unused by the pet so far, but available) |
| R9 | ✅ integrated | `err.code` is used to tell a cancelled confirmation from a failure |
| R10 | ✅ documented | `ready()` / `readyContent()` are idempotent |
| R11 | ✅ integrated | `capabilities()` returns `contextFields` / `actions` |
| R12 | ✅ documented | guide and changelog note when each action exists |
| R13 | ✅ documented | `userState()` prefix, 8 KB cap, `keys()` / `clear()` |

> The only item not fully landed is the second half of **R7** (`content-db.json` is still 5.2 MB and
> uncompressed). The pet no longer loads it while browsing — only an explicit `readyContent()` does — so
> the blast radius is limited to "actually needs the full text". 

---

## 0. How the pet uses SiteAPI today

The pet deliberately keeps the first paint light:

```js
// 1) on mount: context only, no content library
const ctx = await SiteAPI.currentContext();     // { type, id, title, path }

// 2) 6 seconds later (site.readyDelayMs): ready()
await SiteAPI.ready();                          // ready() pulls the 5.2 MB content-db.json

// 3) 2 seconds after that: post metadata, once per page
const doc = await SiteAPI.content().list('document', { where: { path: ctx.path }, limit: 1 });
//    → doc.tags / doc.word_count  (this is what triggers the full download)

// 4) scrolling: event subscription (needs SiteReadingPosition.start() from ready())
SiteAPI.events().on('reading:position', row => { /* row.ratio */ });

// 5) questions: search
const rows = await SiteAPI.content().search('object pool', { limit: 3 });

// 6) writes: always through actions, never faking `confirmed`
await SiteAPI.actions().invoke('bookmark.toggle', { type: 'post', id, title, path });
```

Measured on the local build (2026-10-28):

| Metric | Value |
| --- | --- |
| `content-db.json` size | 5,265,124 B (~5.2 MB, uncompressed) |
| First `content().list()` (local HTTP) | ~60 ms, memoised afterwards |
| `ready()` → content library loaded | network bound, 1–2 s locally |
| Delay the pet adds before `ready()` | 6 s (configurable) |
| Behaviour affected | scroll lines and tag-page greeting during the first seconds |

---

## 1. Summary

| ID | Priority | Request | Today |
| --- | --- | --- | --- |
| R1 | P0 | Split `ready()` into "light ready" and "content load" | Bound together; reading position costs 5.2 MB |
| R2 | P0 | `currentContext()` returns `tags` and `wordCount` | Only `type/id/title/path`; pet must scan the full DB |
| R3 | P0 | `currentContext().contentId` = content-library primary key | Only the DOM id `article-container` |
| R4 | P0 | `currentContext().type` distinguishes home / tag / category / 404 | All report `'page'`; pet guesses from the path |
| R5 | P1 | `theme: 'dark' \| 'light'` in context | Missing; theme lines are dead |
| R6 | P1 | `comments: number` in context | Missing; two comment rules never fire |
| R7 | P1 | Pre-compress + long-cache the content DB, or ship a light index | 5.2 MB revalidated on every visit |
| R8 | P1 | Deep-linkable search results | question rows always point at `/questions/` |
| R9 | P2 | Error `code` on `actions().invoke` failures | Only a Chinese message; consumers string-match |
| R10 | P2 | Document whether `ready()` is idempotent | Not stated; repeated calls re-register actions |
| R11 | P2 | Manifest lists `contextFields` and `actions` | Only capability ids |
| R12 | P2 | Guide marks which pages register which action | `navigation.*` only after `ready()`, `quiz.*` only on exam pages |
| R13 | P2 | Document `userState()` keys, serialisation, limits | Behaviour inferable, not specified |

---

## 2. Details

### R1 [P0] Split `ready()` in two

**Today**: `SiteAPI.ready()` does three things at once — `SiteContentAPI.ready()` (5.2 MB content DB +
question index), `SiteReadingPosition.start()`, and registering the `navigation.*` actions.

**Consequence**: any consumer that only wants reading position or navigation pays 5.2 MB first.
The pet therefore delays `ready()` by 6 s, and **scrolling during the first seconds is invisible**
(`reading:position` has not started yet).

**Request**:

```js
await SiteAPI.ready();            // light: context, events, reading tracking, action registration
await SiteAPI.readyContent();     // explicit content-library load
```

or a flag: `SiteAPI.ready({ content: false })`.

**Acceptance**: right after `ready()`, this returns an empty array —

```js
performance.getEntriesByType('resource').filter(r => r.name.indexOf('content-db') >= 0)
```

---

### R2 [P0] Context carries tags and word count

**Today**: to say "this one is about Unity", the pet calls
`content().list('document', { where: { path } })`, which downloads and parses the whole 5.2 MB.

**Request**: on post pages, `currentContext()` returns

```js
{ type: 'post', id, contentId, title, path, tags: ['Unity', 'C#'], wordCount: 16186 }
```

Twelve tags is plenty; `wordCount` is just `documents.word_count`.

**Benefit**: post pages need no content library at all; only real questions trigger a search.

**Acceptance**: on a post page, `tags.length > 0 && wordCount > 0`.

---

### R3 [P0] Expose the content-library primary key

**Today**: `currentContext().id` is the DOM id (`article-container`), while the document id is
`post:_posts/游戏中的对象池技术探索（一）.md`. The pet can only match on `path` with a linear scan.

**Request**: add `contentId` so that

```js
const doc = await SiteAPI.content().get('document', ctx.contentId);
```

hits directly. Exam pages could also expose `paperId`.

**Acceptance**: `content().get('document', ctx.contentId).title` matches the page title.

---

### R4 [P0] Distinguish page types

**Today**: `/`, `/tags/Unity/`, `/categories/Unity/` and `/404.html` all report `type: 'page'`.
The pet ends up copying the site's routing rules into the consumer (`/^\/tags\//`).

**Request**: `type` becomes
`'home' | 'post' | 'tag' | 'category' | '404' | 'page' | 'paper' | 'algorithm' | 'mock' | 'stats'`.

**Acceptance**: on `/tags/Unity/`, `(await SiteAPI.currentContext()).type === 'tag'`.

---

### R5 [P1] Theme in context

**Today**: no theme field. The pet used to watch `data-theme` with a `MutationObserver`; that has been
removed under the new rules, so `dark` is always `null`: **both theme lines are gone**, and `home.late`
can only look at the hour.

**Request**: add `theme: 'dark' | 'light'` and emit `context:change` when it flips (today that event only
fires on pjax).

**Acceptance**: toggling the theme flips `(await SiteAPI.currentContext()).theme` and fires one
`context:change`.

---

### R6 [P1] Comment count (if the site has comments)

**Today**: `comments` is always `null`; "nobody commented yet" and "lively discussion" never fire.

**Request**: `comments: number` (`0` when there are none, not `null`).
**If the site has no comments at all, please say so** — the pet will delete those two rules instead of
keeping dead code.

**Acceptance**: `typeof ctx.comments === 'number'` on a post page.

---

### R7 [P1] Cost of the content database

**Today**: `/content-db.json` is 5.2 MB and fetched with `{ cache: 'no-cache' }`, so every visit
revalidates; 60 ms locally, roughly 5 s at 1 MB/s.

**Request** (any one of these):

1. pre-compressed `.br` / `.gz` plus `Cache-Control: public, max-age=86400, immutable` (cheapest);
2. a light search index (`/search-index.json`: id/type/title/path/tags, a few hundred KB) with details
   still served by `content().get()`;
3. or shard `content-db.json` per content type.

**Acceptance**: transfer size of `content-db.json` under 1 MB, second visit served from disk cache.

---

### R8 [P1] Deep-linkable search results

**Today**: question rows from `content().search()` always have `path: '/questions/'`, so the pet can only
drop the visitor on the question-bank home page.

**Request**: include `paperId` + `questionId` on the row (or a real `path` including the hash), so consumers
can call `actions().invoke('navigation.openQuestion', { paperId, questionId })`.

**Acceptance**: the first search row exposes `paperId` and `questionId`.

---

### R9 [P2] Machines need error codes

**Today**, declining a confirmation throws `Error('操作需要用户确认：data.clear')`.
The pet string-matches that Chinese message to tell "user declined" from "something broke".

**Request**: an `error.code` such as `'E_CONFIRM' | 'E_UNKNOWN_ACTION' | 'E_DENIED' | 'E_INVALID'`,
keeping the message.

**Acceptance**: after cancelling `data.clear`, `e.code === 'E_CONFIRM'`.

---

### R10 [P2] Is `ready()` idempotent?

**Today**: undocumented. Repeated calls re-register `navigation.open` (harmless overwrite today, but a
future `register` that throws would break consumers).

**Request**: state "safe to call repeatedly and concurrently", or memoise internally.

**Acceptance**: `await Promise.all([SiteAPI.ready(), SiteAPI.ready()])` does not throw and does not
duplicate actions.

---

### R11 [P2] Manifest should describe the contract

**Today**: `/site-api-manifest.json` only lists capability ids and scopes.

**Request**: add `contextFields` (what `currentContext()` actually returns) and `actions` (what is
registered on the current page), so consumers can detect features instead of guessing.

**Acceptance**: `(await SiteAPI.manifest()).contextFields` is an array.

---

### R12 [P2] Document when each action exists

**Today**: `navigation.*` is registered inside `ready()`, `quiz.*` only on exam pages. Calling
`navigation.open` before `ready()` yields "未知操作".

**Request**: add an "available on / when" column to the action table in
`SITE_API_INTEGRATION_GUIDE.md`.

**Note**: the pet already falls back to `SiteAPI.navigation().open(path)` when the action is unknown,
but that is a workaround; the contract should say it.

---

### R13 [P2] `userState()` ground rules

**Today**: writing an object reads back fine, but none of this is specified: allowed characters in keys,
per-entry and total limits, whether `keys()` exists, and whether exceeding quota throws or silently drops.

**Request**: document these in section 17 of the guide.
**Pet side today**: only `pet.*` keys (`pet.state`, `pet.lang`, `pet.greeted`), each under 8 KB.

---

## 3. Self-check snippets

On a post page, one paste covers R2–R8 and R11:

```js
(async () => {
  const ctx = await SiteAPI.currentContext();
  console.log('context:', ctx);
  console.log('R2 tags/wordCount:', ctx.tags, ctx.wordCount);
  console.log('R3 contentId:', ctx.contentId,
    ctx.contentId ? await SiteAPI.content().get('document', ctx.contentId) : 'missing');
  console.log('R4 type:', ctx.type);
  console.log('R5 theme:', ctx.theme);
  console.log('R6 comments:', ctx.comments);
  console.log('R8 search row:', (await SiteAPI.content().search('对象池', { limit: 1 }))[0]);
  console.log('R11 manifest:', await SiteAPI.manifest());
})();
```

On `/tags/Unity/`:

```js
(await SiteAPI.currentContext()).type   // expect 'tag'
```

Theme toggle:

```js
SiteAPI.events().on('context:change', c => console.log('ctx changed', c.theme));
```

---

## 4. Explicitly out of scope

- **No pet-specific endpoints.** The pet does not want `PetContentAPI`-style named APIs; generic
  capabilities are all it needs.
- **No visitor identity.** Bookmarks, notes and reading position stay local; no account required.
- **The pet must not read the DOM.** R2–R6 exist so that it *does not have to* read the page. If a field
  cannot be provided, say so — the pet degrades instead of scraping.
- **No raw SQL surface.** `content().search/get/list` is enough.

---

## 5. Compatibility

- Everything here is a backwards-compatible addition (new fields, error codes, manifest keys). The only
  behaviour change is R1; keeping the old signature (`ready()` still returns a Promise, just no longer
  loads the content DB) is recommended.
- If R1 is too big for now, the minimum viable version is a public entry point for
  `SiteReadingPosition.start()` (e.g. `SiteAPI.reading().start()`), which lets the pet track scrolling
  without calling `ready()` early.
- Each item is independently verifiable from the pet side; no interface shape changes needed later.

---

## 6. If only three things can be done

1. **R1** — unhook reading position from the 5.2 MB load;
2. **R2 + R3** — post pages stop downloading the content library entirely (saves ~5 MB per visit);
3. **R4** — move routing knowledge back to the site.

R5 / R6 decide whether the theme and comment lines come back; R7 decides the first-question latency;
the rest are contract clarity issues that do not block anything.

---

## 7. Versioning and increments

### 7.1 How versions move

`preq-<major>.<minor>`: **major** only for removed / renumbered / semantically changed items;
**minor** for new items, status changes and added acceptance details. The document version and the
SiteAPI version are independent tracks, tied together by the table below.

| Doc version | Date | Targets SiteAPI | Change |
| --- | --- | --- | --- |
| `preq-1.0` | 2026-10-28 | 1.0.0 | first issue: R1–R13 raised |
| `preq-1.1` | 2026-10-28 | 1.1.0 | R1–R6, R8–R13 shipped and integrated; R7 partially shipped (search split out, `content-db.json` still uncompressed); document versioning and increment rules added |

### 7.2 How to add to it

- **Ids only grow**: new requirements start at `R14`; shipped items keep their id and change status
  instead of disappearing. Commits and changelogs on both sides can then cite the same id forever.
- **Five fixed statuses**: `raised` → `shipped` (site side done) → `integrated` (pet side wired and
  verified) → `partial` (half done, must say which half) → `withdrawn` (both sides agreed to drop it,
  with a reason).
- **Every change leaves a trace**: add a row to the version table above. Do not put timestamps inside
  individual items — dates live in the version table only, so one event never carries two dates.
- **Site side writes back**: cite `preq-x.y / R#` in `SITE_API_CHANGELOG.md` when shipping; the pet side
  flips the status here after integrating. Same id on both sides means no drift.

### 7.3 Open items

| Item | Status | What is missing |
| --- | --- | --- |
| R7 | partial | `/search-index.json` now serves search; `content-db.json` is still 5.2 MB and uncompressed. Browsing no longer loads it, so only the explicit `readyContent()` path is affected |

