# Interaction protocol (design draft)

> How the pet is authorised to act, and how the user talks to it.
> **Status: draft, not implemented.** Target: next major version.
> For what ships today see [STATUS.en.md](STATUS.en.md); this file is planning only.

---

## 1. Scope

| Direction | Content | Covered here |
| --- | --- | --- |
| Pet → site | Ask to perform an authorised action | ✅ |
| Site → pet | Send a directive (say this, play that) | ✅ contract only |
| User → pet | Text / voice input | ✅ |
| Model integration, accounts | — | ❌ out of scope |

---

## 2. Four principles

1. **The pet never gets more power than a single click.** It can only operate elements that actually exist, are visible, and are enabled.
2. **The site declares capabilities, the user confirms each time, default is deny.**
3. **The pet never supplies a URL.** It names a semantic target; the address is read from the real DOM element.
4. **No config, no change.** Without an `actions` section, behaviour falls back to printing the link in the bubble.

---

## 3. Capability declaration (site side)

A new `actions` section in `config/pet.yaml`:

```yaml
actions:
  version: 1
  defaultConsent: ask          # ask | always | never
  items:
    - id: open-post
      label: Open article
      selector: 'a[data-pet-target="post"]'
      resolve: href            # href | data | click
      sideEffect: false
      consent: ask
      cooldownMs: 4000

    - id: open-search
      label: Open search
      selector: '#search-button'
      resolve: click
      sideEffect: false
      consent: always          # read-only and low risk, may skip the prompt
```

| Field | Meaning |
| --- | --- |
| `id` | Capability id, referenced by rules and lines |
| `label` | Shown to the user in the confirm bubble (write it in the site's language) |
| `selector` | Points at the site's own UI |
| `resolve` | `href` reads the address, `data` reads `data-pet-url`, `click` clicks the element |
| `sideEffect` | Must be `true` for submits or deletes |
| `consent` | `ask` / `always` / `never`; forced to `ask` when `sideEffect` is true |
| `cooldownMs` | Per-capability cooldown |

**Three checks before executing** (all required):

1. The element exists and `offsetParent !== null` (visible)
2. Not `disabled`, not `aria-disabled`
3. For `resolve: href`, the address must share `location.origin`

**PJAX / navigation**: after a page switch the old elements are gone. The adapter re-resolves on
`pjax:complete` and `popstate`, never caching a resolution across pages; if nothing matches after the
switch it is treated as "not found".

---

## 4. Request protocol

### 4.1 Events

| Event | Payload | Meaning |
| --- | --- | --- |
| `action.request` | `{ requestId, id, args, level }` | The pet asks |
| `action.confirm` | `{ requestId, id, label }` | A user decision is needed |
| `action.grant` | `{ requestId, scope }` | User allowed; `scope` is `once`/`session`/`always` |
| `action.deny` | `{ requestId, reason }` | Refused, or a check failed |
| `action.done` | `{ requestId, ok, error }` | Execution result |
| `action.revoke` | `{ id, scope }` | Permission withdrawn |

### 4.2 Sequence

```
rule matches
  → pet emits action.request { id:'open-post', args:{ target:'article: xxx' } }
  → adapter resolves the target → finds the element → validates
       ├─ fail → action.deny { reason:'not-found' } → pet says "couldn't find it"
       └─ ok   → action.confirm
  → user taps "take me" → action.grant { scope:'once' }
  → adapter executes → action.done { ok:true }
  → pet says "there we go"
```

### 4.3 Constraints

- Only **one** pending request at a time; a new one supersedes the old (`deny: superseded`).
- `ambient` requests **only hint**, never execute; they must be raised to `direct`.
- `hold` belongs to dragging and is not part of this protocol.
- Every request, denial and execution goes into the 200-entry ring log.

---

## 5. User consent

| Scope | Stored in | Lifetime | Revocable |
| --- | --- | --- | --- |
| `once` | nowhere | single use | — |
| `session` | memory | current tab | lost on refresh |
| `always` | `localStorage: pet-consent` | long-lived | clearable in settings |

Additional rules:

- `sideEffect: true` capabilities **can never** be `always`; they always ask.
- A site may set `defaultConsent: never`; then nothing is remembered (compliance scenarios).
- After a refusal the same capability is not asked again in that session.

---

## 6. Input channels

### 6.1 Contract

```js
PetInput.registerProvider('voice', {
    available: () => Promise<boolean>,
    start:     (opts) => Promise<{ text, confidence, lang }>,
    cancel:    () => void
});
```

`text` is built in (the chat box). `voice` is supplied by a default implementation or by the site. The pet only calls the contract.

### 6.2 Who owns what

| Layer | Owner | Why |
| --- | --- | --- |
| Capture (mic, permission, recording UI) | Pet | Front-end interaction |
| Transcription (STT) | Site / host | Keys, cost, privacy liability |
| Understanding (intent parsing) | Mediator | Consumes text, source-agnostic |

### 6.3 Default implementation

The browser's Web Speech API. When unavailable (Firefox, some Safari), `available()` resolves `false` and the mic button is not rendered.

A site may override it with its own `/api/stt` — **keys never reach the front end**.

**Recognition language**: taken from `navigator.language` (e.g. `zh-CN` / `en-US`), **not** from the UI
language. A Chinese UI on an English system still transcribes English — accent comes from the user's OS,
not the site. Error prompts stay in the UI language.

### 6.4 Privacy

- Ask for the microphone only after the user taps the button; state plainly that audio is recognised by the browser and not uploaded to the site.
- No always-on listening, no wake word.
- Cancellable at any moment.
- Audio is never stored or logged.

### 6.5 Voice does not bypass rules

Voice only turns sound into text. Everything after that is the same pipeline as typing. Voice can never trigger an action directly.

---

## 7. Degradation matrix

| Situation | Behaviour |
| --- | --- |
| No `actions` config | Fall back to printing links |
| Selector matches nothing | `deny: not-found`, pet says so |
| Element disabled / hidden | `deny: not-available` |
| Cross-origin address | `deny: not-same-origin`, no execution |
| User refuses | `deny: user`, not asked again this session |
| Cooldown active | `deny: cooling`, silent |
| Voice unsupported | Mic button hidden |
| Transcription failed | Bubble shows "didn't catch that, say again?" |

---

## 8. Audit

All of it lands in the kernel ring log and is exportable via `PetDebug.log()`:

```
12:00:01 request  open-post   direct
12:00:01 confirm  open-post   user
12:00:02 grant    open-post   once
12:00:02 done     open-post   ok
```

Denials are logged too, so "why did nothing happen" is answerable.

---

## 9. Test plan

| Type | Case |
| --- | --- |
| Unit | selector resolution, same-origin check, cooldown, consent storage |
| Unit | `sideEffect` forces `ask`; `always` is rejected |
| E2E | confirm button → navigates |
| E2E | user refuses → no navigation, no repeat prompt |
| E2E | element missing → bubble explains |
| E2E | no `actions` config → identical to today |

---

## 10. Roadmap

| Version | Content |
| --- | --- |
| Next major, step 1 | Read-only navigation + confirm bubble + same-origin checks + audit |
| Next major, step 2 | Voice input (Web Speech, provider replaceable) |
| Later | Site → pet directives, multi-capability orchestration |

---

## 11. Open questions

1. Do `label` fields need an English variant (`label.en`)?
2. Keyboard path (Tab to the confirm button) — recommended for accessibility.
3. Where does "revoke always" live: the bubble or the settings page?

## 12. Decision log

| Date | Decision |
| --- | --- |
| 2026-10-26 | Re-resolve target elements after PJAX / navigation; never cache across pages |
| 2026-10-26 | Speech recognition language follows `navigator.language`, not the UI language |
