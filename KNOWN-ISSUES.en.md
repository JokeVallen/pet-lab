# Known Issues

> This is the **single** issue list; README and STATUS both point here.
> Delete an item when it is fixed — do not keep copies elsewhere.

Chinese version: [KNOWN-ISSUES.md](KNOWN-ISSUES.md)

---

## 1. 100–200 ms gap on the first drag swap

**Symptom**: the character briefly disappears the first time you pick it up.
**Cause**: only two `<video>` buffers — one idle spare, one playing — and the new source has not finished decoding when the swap happens.
**Fix**: add a third buffer, or preload the `drag` clip.

## 1.5 The first frames of the pickup look almost static

**Symptom**: the first frame or two after pressing the character look like nothing happened, so it reads as "the animation did not play".
**Cause**: the first frame of `drag-up.webm` sits almost exactly where `idle.webm` starts; the character rises a few frames later.
(`ffprobe` shows `drag-up` has a single keyframe and its first packet is at `t=0.042s`.)
**Mitigations already in place**:
- `modules/player.js` exposes `ready()`; until the front element really produces frames, `.dp-stage` keeps `is-static`, so the still image never yields to a blank or torn video.
- Pressing warms `drag-hold` on the back buffer so the airborne loop is already prepared.

**Note**: this is a property of the source clip, not a playback bug. Fixing it properly means re-cutting the asset so the first frame already leaves the ground.

---

## 2. Clips have no outline shadow (the ground shadow is fine)

**Symptom**: the still portrait gets an outline shadow; playing clips do not.
**Cause**: `drop-shadow` on `.dp-video` smears a grey halo under software rendering, so only `.dp-art` carries it.

**Status**: the ground ellipse `.dp-shadow` reads all four `shadow.*` values (offsetX / offsetY / blur / colour),
so changing the horizontal offset visibly moves the ground shadow — only the character's outline is missing while a clip plays.

**Fix**: build the outline shadow from a CSS `mask` or a duplicated layer — or accept it.

## 3. Dialogue is still rule-assembled

**Status**: 22 phrase groups + context answers + index search. Not an LLM.
**Impact**: questions outside the phrase library get template answers.
**Fix**: swapping in an LLM only replaces the text producer; the `speech.act` channel stays.

## 4. Search has no synonyms

**Symptom**: searching 协程 will not find a card titled *Coroutine*.
**Cause**: Chinese uses a bigram sliding window, English uses substrings; there is no lexicon.
**Fix**: add a `synonyms` field to the build-time index and expand queries.

## 5. `.chrome-smoke` accumulates

**Symptom**: each smoke run leaves a Chrome profile of roughly 10 MB.
**Fix**: delete it periodically, or clean up when `smoke.js` exits (file handles may still be held on Windows — needs retries).

## 6. Saving loses YAML comments

**Symptom**: after “Save & build”, comments in `config/pet.yaml` are gone.
**Cause**: `tools/apply-patch.js` re-serialises the whole file with js-yaml; comments are not part of the parsed result.
**Impact**: data is complete; only prose is lost.
**Fix**: hand-edit (the dev server rebuilds automatically) when comments matter, or switch to段-level text replacement (more logic, more ways to break).

## 7. The server is local-only

**Status**: `start.bat` → `tools/serve.py` binds `127.0.0.1` and writes only under `config/`.
**Impact**: cannot be deployed publicly; this is a deliberate boundary.
**Fix**: none. Use an SSH tunnel if you need remote access.

---

## Historical bugs (fixed, kept for reference)

- Undeclared globals silently killed handlers (`justDragged` / `lastScrollSeen` / `mdKey`)
- `dropTimer` was not cleared alongside `rollTimer`, so delayed actions interrupted later ones
- Dragging with a `hold` loop left the pet floating; split into `drag-up` / `drag-hold` / `drag-down`
- Brace matching while extracting a function inserted the bridge inside `showBubble`
- Kernel `start()` returned early, so modules registered later were never mounted
- Synthetic `PointerEvent`s masked the fact that `doPet` had been deleted
- A replace-style endpoint used as a delete-style test wiped all 12 rules at once
