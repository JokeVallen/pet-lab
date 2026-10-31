# Integrating with this blog

> Written for whoever (or whatever AI) maintains the blog. The pet is a black box: sync the files,
> load it as described, and never edit anything inside `js/pet/`.

---

## 0. TL;DR

Download the latest release, drop `js/pet/`, `css/deepseek-pet.css` and `images/pet/` into place,
load `/js/pet/index.js` with a version query from your global script, then build.

---

## 1. The only source

**Release archive**: <https://github.com/JokeVallen/pet-lab/releases/latest> (asset `pet-lab-v*.zip`)

Do **not** copy `js/pet/` from the `main` branch — that is the development environment, with test
bench, probes and dev notes. The release archive has all developer-only content removed at pack
time.

---

## 2. Target layout

```
source/
  js/pet/                 whole directory, from <zip>/js/pet/
  css/deepseek-pet.css    single file
  images/pet/             whole directory, from <zip>/images/pet/ (33 WebM + poster)
config/pet.yaml           the blog's own config — never overwrite it with the archive's copy
```

| From | To |
| --- | --- |
| `<zip>/js/pet/**` | `source/js/pet/**` |
| `<zip>/css/deepseek-pet.css` | `source/css/deepseek-pet.css` |
| `<zip>/images/pet/**` | `source/images/pet/**` |
| `<zip>/config/pet.yaml` | **do not copy** |

---

## 3. First-time install

1. Unzip `pet-lab-v*.zip`.
2. Copy the three items above into place.
3. Load the module from your global script (e.g. `source/js/custom-global.js`):

```js
(function () {
    var V = '1.0.2';                          // bump on every update
    function ensurePet() {
        if (document.querySelector('script[data-pet-module]')) return;
        var s = document.createElement('script');
        s.type = 'module';
        s.src = '/js/pet/index.js?v=' + V;     // the only way to bust the ES-module cache
        s.dataset.petModule = '1';
        document.body.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensurePet);
    else ensurePet();
    document.addEventListener('pjax:complete', ensurePet);   // when the theme uses pjax
})();
```

4. Import the stylesheet: `@import url("/css/deepseek-pet.css");` or a `<link>` in `head`.
5. `hexo clean && hexo g && hexo d`.

The pet creates its own DOM and mounts in the bottom-right corner; the host page needs **no**
container element.

---

## 4. Updating

1. Download the new archive.
2. **Delete before copying** (never overwrite in place):

```bash
rm -rf source/js/pet
cp -r <unzipped>/js/pet source/js/pet
```

> Why: module names change between versions (1.0.2 added `content/expr.js`). A plain overwrite
> leaves orphaned files behind, and then nobody can tell which copy actually loaded.

3. Replace `css/` and `images/` only when the release notes mention them — the assets are large,
   there is no need to re-upload them every time.
4. Bump the `V` constant in the global script.
5. Rebuild and run the checks in section 6.

---

## 5. Hard rules

| Never | Why |
| --- | --- |
| Copy `js/pet/` from `main` | That is the dev build, with test and debug entry points |
| Edit any file inside `js/pet/` | The next update overwrites it, and the bug stops being reproducible |
| Overwrite the blog's `config/pet.yaml` with the archive's | You lose the blog's own name and lines |
| Touch the DOM subtree the pet creates | It owns `#deepseek-pet`; outside edits break the state machine |
| Put site logic inside the pet | Site capabilities only ever arrive through `window.SiteAPI` |

Found a bug? Report it to the `pet-lab` repository — **do not patch it in the blog**.

---

## 6. Verify

Open any post and run in the console:

```js
document.getElementById('deepseek-pet')         // an element, not null
document.querySelectorAll('.dp-root').length    // 1, never 2
```

Then check the network panel: **no 4xx requests**. The pet only requests two kinds of paths:

```
/js/pet/**
/images/pet/anim/**
```

Troubleshooting:

| Symptom | Check first |
| --- | --- |
| Pet never appears | Any console error starting with `[pet]`; is `/js/pet/index.js` 200? |
| Appears but blank / frozen | Are the WebM files under `/images/pet/anim/` 200? |
| Still old behaviour after an update | `V` not bumped, or `/js/pet/index.js` cached by the browser |
| Two pets | `hostId` clash, or the `ensurePet` guard is bypassed |
| Copy still shows the old name | `js/pet/config.js` was not rebuilt (`node tools/build-config.js`) |
| Styling gone | `css/deepseek-pet.css` not imported, or wrong path |

---

## 7. Site capabilities (optional)

There is **one door** between the pet and the site: `window.SiteAPI`. Implement it and the pet uses
it automatically; skip it and the pet degrades silently — no errors, no blocking.

### 7.1 Modules the pet probes (each optional)

```
content / reading / bookmarks / notes / quiz / stats / userState / events
```

### 7.2 Root members used

```
ready / readyContent / capabilities / health / currentContext / navigation / actions
```

### 7.3 Two-stage loading

| Stage | Call | Cost | When |
| --- | --- | --- | --- |
| Light | `ready()` + `currentContext()` | one `page-context.json` (tens of KB) | right at mount |
| Content DB | `readyContent()` | `content-db.json` (megabytes) | only when full text is needed |

### 7.4 Permissions

| Level | What the pet does with it |
| --- | --- |
| `read` | `currentContext()`, `content().search()` |
| `read-local` | `reading().get()`, `bookmarks().list()` |
| `write-local` | `userState()`, `actions().invoke(...)` |

Writes always go through `actions().invoke` and **never fake `confirmed`** — if the site wants
consent, it shows its own dialog, and a refusal is treated as "did not happen".

### 7.5 Works without SiteAPI

Moves, chat and lines are all local. What you lose is "knowing what page it is on": page title,
tags, word count, reading progress, site search and reading-position memory.

---

## 8. Who owns the config

| File | Owner | Who edits |
| --- | --- | --- |
| `js/pet/config.js` | generated | compiled from `config/pet.yaml` — **never by hand** |
| `config/pet.yaml` | the blog | people / AI, as needed |
| everything else under `js/pet/` | the pet | **nobody** |

After editing the YAML, rebuild:

```bash
node tools/build-config.js
```

The release archive vendors `vendor/js-yaml.min.js`; no `npm install` needed.
