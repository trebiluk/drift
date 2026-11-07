# Drift 2.0: full recode design

**For:** Debugzy (relay + build) and Diego (Mr. Kulibert) · **Lane:** design doc only, no code
**Read at:** `trebiluk/drift` main `62af513` ("Drift 1.12.4", 2026-10-10). History fetched to 400 commits; the Sep reference `3e48cfe` is dated 2026-09-18 in git (Diego says Sep 19, likely a timezone edge).
**Version numbers:** this doc uses stage numbers (S0–S21) only. Debugzy assigns chip versions. Suggested rule: one pre-release letter per Build paste, a fix paste takes the next letter, never reuse one.

Anything I could not verify is marked **unknown**. Section 14 collects them.

---

## 1. Verdict in six lines

1. **Keep** the pure flight math, the pull-steer input and its tests, the 9-language copy tables, and the `KulibertWho` alias idea. They are small, pure and already good.
2. **Drop** TanStack Start, Nitro, better-auth, pglite, the P2P multiplayer, the live-traffic server function, the Grok PWA plugin, and 46 of the 54 listed dependencies (only 8 are imported by Drift code: r3f, TanStack router and start, lucide, react, tailwind, three, zustand; `drei` is listed but never imported). None of it serves a calm flight toy.
3. **Go static:** a plain Vite SPA, `three` directly (no r3f), React for DOM UI only.
4. **Ship the floor first:** a Canvas 2D "still" renderer that needs no WebGL, playable by stage S4, before any 3D.
5. **Lock the cloud look with numbers** (stage S0) before writing cloud code. Five cuts have failed because "good" was never measurable.
6. **Run loop is fixed-step and seeded**, so a Chromebook at 30 fps and a phone at 60 fps score the same for the same inputs.

---

## 2. What I read (verified)

| Area | Files | Lines |
|---|---|---|
| Sim / input | `flight.ts` 151, `pull.ts` 29, `input.ts` 238, `input.test.ts` 30, `runtime.ts` 186, `device.ts` 14, `who.ts` 29 | ~680 |
| Render | `World.tsx` 916, `ReefField` 413, `SpaceField` 254, `WarpField` 222, `Airplanes` 537, `TrafficMap` 229, `shaders.ts` 408, `textures.ts` 510 | ~3,500 |
| UI / i18n / state | `Overlay.tsx` 991, `LangRoot` 138, `DriftExperience` 136, `copy.ts` 768, `hud.ts` (store), `audio.ts` 196 | ~3,200 |
| Shell | `__root.tsx`, 2 routes, `lib/auth/*`, `lib/app-data/*`, `lib/multiplayer/*`, `scripts/*` (Grok platform) | not Drift code |

Also read: both crew docs, `package.json`, README, and the Sep 18 `World.tsx` and `shaders.ts` for the reference look.

---

## 3. Keep / change / drop

### Keep (port nearly as-is)

| Piece | Why | Change on the way in |
|---|---|---|
| `flight.ts` (`stepCraft`, bounds, constants) | Pure, no DOM or three. The calm feel lives here. | `layerName` returns English strings that are then looked up by string. Return an **id** instead. Add a fixed-step `advance()`. |
| `pull.ts` + `input.test.ts` | Pure, tested, the "pull the craft" control Diego likes. | Port verbatim; add key-map and capture tests. |
| `copy.ts` tables (en, simple, uk, ru, es, ar, fa-AF, rw, ti) | 72 keys, all 8 real languages complete (checked by script). RTL helpers (`dirOf`) work. | See gaps below. |
| `who.ts` | Reads a verified alias from the Hub, never typed here. Right shape for the adapter. | Wrap in the adapter (§8). |
| Test hook `window.__controlsTest` | Lets a tester drive the craft. **Unknown** whether StudentTester uses it. | Keep the idea; rename once Debugzy confirms. |
| Procedural audio (wind, rumble, haze/void/tide) | Synth = no license problem. | Add visible captions. |
| Reduced-motion handling, safe-area CSS, `role=slider` + `aria-valuetext`, `radiogroup` patterns | Good a11y bones. | Re-implement in the new UI. |

### Gaps found in what we keep

- **Simple has 14 of 72 keys.** The other 58 silently fall back to English. Needs a full Simple table, tested.
- **`whatsBody` has no date** in any language. Constraint 7 wants a dated line.
- **No explicit focus styles** anywhere in `src/styles.css` or `src/components/drift/` (searched `focus-visible`, `focus:`). Whether browser defaults show against bright clouds: **unknown**, so assume the bar is not met.
- **Two version places edited by hand** (`__root.tsx`, `Overlay.tsx`). Easy to drift apart.
- **Missing keys fall back silently** (`TABLES[lang]?.[key] || EN[key]`), which hides gaps. 2.0 fails a test instead.
- **Three languages need a native reader** (`NEEDS_NATIVE`: fa-AF, rw, ti). Review status **unknown**.

### Drop

| Piece | Reason |
|---|---|
| TanStack Start / router / Nitro | SSR is the likely source of React #418 (see §4). Nothing in Drift needs a server. |
| `getLiveTraffic` + `TrafficMap` + `Airplanes` (~970 lines) | Server function calling `api.adsb.lol`; a static classroom copy can't run it, and school-network reachability is **unknown**. Default already off. Revisit only if Diego asks. |
| `lib/auth`, `lib/app-data`, `lib/db`, better-auth, pglite, kysely, jose, pg | `AuthProvider` wraps the root but no Drift component reads it. Hub sign-in is the real identity path. |
| `lib/multiplayer/p2p.ts` + `/api/rtc` | Unused by Drift components; needs a server. |
| `scripts/grok-pwa-*` and `public/__grok` | Source of the `extensions.js` "Created with Grok" badge and the outside request. Own manifest and icons instead. |
| `components/ui/button.tsx`, Radix set, `drei`, recharts, react-day-picker, cmdk, vaul, sonner, etc. | Not imported by Drift screens (checked by script: 8 of 54 dependencies are imported). |
| Legacy migration flags in `hud.ts` (`drift-wind-off`, `drift-map-off`, `drift-planes-off`) | One-time forced resets that now just add noise. Replaced by one migration (§7). |
| `createCloudTexture`, `createCloudAtlas` and other dead exports in `textures.ts` | Only `createPuffAtlas` is used by 1.12.4. |
| `/shared/*.js` loaded by appending script tags | Keep the *capability*, not the loader. The adapter loads them with a timeout (§8). |

### Redesign (don't port)

- `Overlay.tsx` (991 lines, about 11 components in one file) and `World.tsx` (916 lines): reuse their patterns, not their structure.
- `runtime.ts` (a global mutable object) + `hud.ts` (zustand) + 8 localStorage keys = three sources of truth. 2.0 has one state module and one storage module.

---

## 4. Why the known problems keep happening (evidence)

| Problem | What the source shows | Confidence |
|---|---|---|
| **Clouds fail every cut** | The Sep 18 good look = a 128×128 shader **cloud-sea plane** (`SEA_FRAG`) + **96/140 instanced puffs** placed with `Math.random()`. 1.12.4 has **no sea plane** and builds about **46 puffs (39 on phone)** in 3 layers; the `count` constants (96/140) are dead code (`buildPuffs(_count…)` ignores them). So "too few clouds on phone" is by construction. | Verified in source |
| **No reproducible reference** | Sep 18 uses `Math.random()`, so no two loads match. A "good look" cannot be compared. | Verified |
| **Phone: empty upright sky** | Camera uses a fixed **vertical** FOV (72 base, 68–84 in flight). At 412×915 that is only about **36° horizontal**, a narrow slot of sky. A hard horizon band is plausible from the ground-haze term (`uGroundHaze`) not scaling with the view. | FOV math verified; band cause **unknown** |
| **Perf drops (−48% at 412, −43% at 1366 on 1.11.6)** | Numbers are from Debugzy; I did not reproduce them. In code: MSAA on for non-touch, DPR up to 1.5, large transparent billboards (overdraw), and `QualityRig` can only lower DPR and drop the farthest puff layer. It cannot reduce shader cost. On a non-touch desktop or Chromebook it also **starts at the top tier** (touch devices start one step down). Root cause needs profiling: **unknown**. | Partly verified |
| **Reef shader fails** | The bare identifier `patch` (reserved in GLSL ES 3.00) **was** in `REEF_FRAG` at `3e48cfe` and is **already renamed `patchN` in 1.12.3 and 1.12.4**. A scan of 1.12.4's reef fragment shader for other reserved words found none. So the "fails on every build" report does not match 1.12.4 source. Either it is stale, or the failure is something else. I did not compile the shader. | Source verified; live cause **unknown** |
| **No-GPU crash** | `<Canvas>` is created with no capability check and no error boundary. | Verified |
| **React #418** | Likely cause: the root renders `<html>` attributes from client-only state, and the store reads `matchMedia` at creation (true on the client, false on the server). Not reproduced. | Hypothesis, **unknown** |
| **Grok badge / outside request** | `scripts/grok-pwa-shared.mjs` injects `https://grok.com/grok-app-builder/extensions.js` into every door. | Verified |
| **Phone HUD** | Tiny upright HUD and sideways STEER below the fold are from Diego's phone; layout is `top`-anchored cockpit plates with a fixed `top` offset (CSS at `styles.css` ~L180). Exact cause **unknown**. | Partly verified |
| **Sounds unlicensed** | Five mp3s (2.9 MB, `focus.mp3` alone 1.7 MB). No license, credit or source file anywhere in the repo (searched `licen|credit|attribution|freesound|cc0|cc-by`). Provenance **unknown**. | Verified: no record |
| **External fonts** | Non-classroom builds load Google Fonts (a visitor IP goes to Google). Classroom builds load `/fonts/room.css` from the Hub. Glyph coverage for Dari, Tigrinya (Ethiopic) is **unknown**. | Verified for the load; coverage unknown |

Process lesson: five cuts changed the cloud code each time with no fixed picture and no number to pass. S0 fixes that.

---

## 5. Architecture

### 5.1 Decisions

| Question | Decision | Why | Rejected |
|---|---|---|---|
| **Engine** | **Plain `three`**, tree-shaken, behind a small `Renderer` interface. | Own the render loop: fixed step, adaptive resolution, easy to profile, no reconciler, no SSR path. r3f was not the cause of the perf or look problems, but it hides the knobs we need to fix them. | Keep r3f (works, but adds the reconciler and hydration coupling); raw WebGL2 (too much code for the benefit). |
| **Fallback** | **Canvas 2D "still" renderer** implementing the same `Renderer` interface. | No-WebGL machines, lost contexts, and the very weakest Chromebooks. It is also the first thing we build, so the game is playable early. | A static "your device can't run Drift" page. |
| **Shell** | **Static Vite SPA**, one `index.html`, `base: './'` (matches the existing `/drift/` classroom convention). No server, no SSR, no Nitro. | Removes #418 by design, removes every server dependency, deploys by copying `dist/` into `apps-kulibert/public/drift/`. | Keep TanStack Start. |
| **UI** | **React 19 for DOM chrome only** (Start, HUD, Settings, Results, Credits). The canvas is outside React. | Known to Debugzy/Build; the settings forms and radiogroups port cleanly. Bundle cost is **unknown** until measured; fallback is Preact via alias. | Vanilla DOM (more code to get right for 9 languages + RTL). |
| **State** | One small store module (typed, `useSyncExternalStore`). Sim state lives outside React. | One source of truth. | zustand + `runtime` + localStorage. |
| **Language** | TypeScript, `node --test --experimental-strip-types` for pure modules (existing pattern), Playwright (already a devDependency) for visual and network gates. | Reuses what the repo already runs. | — |

### 5.2 Layout (new tree `drift-next/`, promoted at cutover)

```
drift-next/
  index.html            static shell; sky-colour background (no white flash)
  CHANGELOG.md
  CREDITS.json          single source for the Credits screen + license test
  src/
    version.ts          reads package.json version (one source)
    main.tsx            boot: probe → pick renderer → mount UI
    sim/                PURE (no DOM, no three): craft, world, course, run, score, rng
    input/              keys, pull, gamepad → Actions
    render/
      types.ts          Renderer interface, Pose, Tier
      probe.ts          capability detection → starting tier
      quality.ts        tier table + governor
      gl/               three renderer: sky, clouds, space, reef, glider, rings
      canvas2d/         still renderer: sky, parallax clouds, glider, rings
    ui/                 React: Start, Hud, Pause, Settings, Results, Credits
    i18n/               copy tables + t() + whatsNew
    store/              state, storage, prefs, best
    adapters/           hub.ts (thin), standalone.ts
    contest/            lazy chunk, zero imports from core
  scripts/              look-lock, net-check
```

Rule: `sim/` and `input/` import nothing from `render/`, `ui/`, `contest/` or the DOM (input uses DOM events only in its attach function). That is what makes them testable with plain `node --test`.

### 5.3 Boot order and failure handling

1. Paint the static shell (sky colour, version chip, "Loading" text). Never white.
2. `probe()` → starting tier (§6). No WebGL → `still`.
3. Try the GL renderer inside try/catch. Any throw → `still` + a one-line text note. **Never a blank page or an uncaught error.**
4. `webglcontextlost`: pause the run, show "Picture paused, restoring", wait for `restored`. A second loss in a session → `still` for the rest of it.
5. Hub adapter loads in parallel with a 2-second timeout. Failure means standalone, silently.

---

## 6. Quality tiers (the Chromebook floor)

Four tiers. Numbers are **starting values to tune on the real class device**, which I do not have (**unknown** model, RAM, GPU).

| Tier | Renderer | Render scale / DPR | AA | Clouds | Extras | Target |
|---|---|---|---|---|---|---|
| `full` | GL | ≤1.5 desktop, ≤1.25 phone | on | cloud-sea plane + ~140 puffs | farmland, god rays, shadows | 60 |
| `balanced` | GL | ≤1.0 | off | sea plane (fewer octaves) + ~90 puffs | simple fields, baked shadow blobs | 60, accept 45 |
| `light` | GL | 0.75–1.0 | off | scrolling pre-baked sea texture + ~48 puffs, no per-pixel fbm | no god rays, no fields | steady 30 |
| `still` | Canvas 2D | 1.0 | n/a | 3 parallax sprite layers | text altitude + world labels | steady 30 |

**Starting tier (`probe.ts`):** no WebGL2 (or no WebGL) → `still`. ChromeOS (`CrOS` in UA), ≤4 cores, or `deviceMemory` ≤4 → `light`. Otherwise `balanced`. Never start on `full`.

**Governor (`quality.ts`), ratchet down fast, climb slowly:**
- Measure **p95 frame time over a rolling 1.5 s window**, not an average (an average hides stutter).
- Drop one tier when p95 exceeds the tier budget. Try a render-scale step (−0.1) before changing the look.
- Climb only after **10 s steady**, at most once per 30 s, and **never back into a tier that already failed this session** (no oscillation).
- `prefers-reduced-motion` or the student's "Low power" setting caps the tier at `light` and the frame rate at 30.
- No per-frame allocations in the render loop (scratch vectors, pooled arrays). GC hitches are the usual Chromebook stutter.
- `?debug=1` shows tier, fps p50/p95, draw calls and triangles as plain text. No PII.

**Fixed-step sim:** sim advances at a fixed rate with render interpolation, clamped so a long frame can't teleport the craft. Score depends on the sim, not the frame rate.

**Phone camera:** compute vertical FOV from aspect so horizontal FOV never falls below about 60° in portrait, and place the horizon near 55–62% of screen height. Horizon haze height scales with the view. Verified by golden shots at 412×915 and 915×412.

---

## 7. Run loop, score, storage

### 7.1 Modes

| Mode | What it is |
|---|---|
| **Calm** | Free flight, no score, no timer. The current Drift. Keeps the curriculum line "Calm break · not a grade." |
| **Chase** | A short, seeded run with a score. No fail state, no penalty. |

This reconciles two crew docs: Curriculum says "reject leaderboard shame" and "default no Wall score", and FeatureBot lists scoring as out of scope (TechWorks owns it). Debugzy now says the core is a high-score chase. Proposal: Chase is a **mode**, personal-best only by default, and Calm stays one tap away. **Question 2 asks Diego.**

### 7.2 Proposed chase: "Ring run" (Diego picks in Q1)

- **State machine:** Ready → Countdown (3-2-1 shown as big text, not sound) → Run → Landing → Results → Ready. Pause is allowed at any point in Run.
- **Course:** a seeded gentle path of soft hoops, 140–260 units apart, within the world's altitude band. Same seed = same course = fair across devices.
- **Score (all starting values):** 100 per ring; chain multiplier ×1 to ×3 for rings passed within 12 s of each other; up to 300 "smooth flight" bonus from low steering jerk; **no penalty for a miss**. The Results screen shows the breakdown, in words. This ties to the Tech curriculum (input → process → output).
- **Length:** 90 s default (Q4).
- **Not color-only:** a hoop is a shape plus a number; passed hoops shrink and show a check mark. An on-screen text line gives "Next ring: ahead, left, about 180 m", plus an edge arrow when off-screen.
- **No sound-only cue:** every ring pass shows a text toast ("Ring 3 of 12"). Sound is optional.
- **Visual limits:** hoops soft cream with a dark inner edge. No neon, no flashes. At most 12 hoops visible, instanced.

### 7.3 Storage

- **localStorage only.** No IndexedDB, no pglite, no cookies, no network.
- Two keys: `drift.prefs` and `drift.best`. Each holds JSON with a schema marker, wrapped in try/catch, with an in-memory fallback when storage is blocked.
- `drift.best` keeps the top 5 per mode: score, day (no time), seed. **No alias, name, email or IP.**
- **One-time migration** from the legacy keys (`drift-fx`, `drift-cruise`, `drift-muted`, `drift-night-manual`, `drift-reticle`, `drift-star-density`, `drift-traffic-region`), then ignore them. Drop the three force-reset flags.
- Alias is read from the Hub at the moment it is needed (contest submit); Drift never stores it.

---

## 8. Hub adapter (thin, because the Hub is being redesigned)

The core knows one interface. Everything Hub-specific sits behind it. The new Hub contract is **unknown**, so the adapter is **capability-based, not number-versioned**: the core asks "do you have X?", and anything missing is simply absent.

| Capability | Standalone | Today's shared scripts (`KulibertWho`, `KulibertPrefs`, `KulibertI18n`) | Redesigned Hub |
|---|---|---|---|
| `alias()` | none | verified alias or none | **unknown** |
| `lang()` / `onLang()` | URL `?lang=`, else browser | `KulibertPrefs.lang`, `kulibert-lang` event, same-origin `kp-lang` message | **unknown** |
| `markActivity(label)` | no-op | `KulibertWho.mark("drift", line)` only when signed in | **unknown** |
| `readAloud(text, lang)` | `speechSynthesis` (rw, ti have no voice) | `KulibertPrefs.say` | **unknown** |
| `contestConfig()` | `null` (contest off) | `null` until the Hub provides it | teacher-set, from Master Control later |
| `submitScore(entry)` | not available | not available | **unknown** |

Rules:
- **Standalone is the default and must be complete.** Hub or sign-in is never required to fly, score, or see a personal best.
- Shared scripts load from same origin only, each with a timeout, failure-safe. On a non-classroom host nothing extra is requested.
- `postMessage` handlers check `event.origin === location.origin` (the existing pattern) and ignore anything else.
- Keep the `?lang=`, `?theme=classic` and `?hub=` URL params working.
- The adapter is replaceable in one file. When the new session design lands, only `adapters/hub.ts` changes.

---

## 9. Contest module boundary (optional, off by default)

**Boundary:** `contest/` is a lazy-loaded chunk. The core has **zero imports** from it. It is loaded only when `adapter.contestConfig()?.enabled === true`. The teacher toggles it (Master Control later). Default: off.

**What the core emits (events, no contest knowledge):** `run:start {mode, seed}`, `run:end {mode, seed, score, breakdown, durationMs}`, `run:pause`, `run:resume`.

**What the contest module owns:** rules screen, class seed or daily seed, attempt limits, submit through `adapter.submitScore`, board display, cooldown, and any "contest on" banner. It is also the only place a board is ever shown.

**Config the teacher can set (proposed; Q6–Q8):** course (same seed for the class / fresh each run / daily), attempts (unlimited / 3 / 1), board (top 3 plus "you" / full list / hidden until the teacher reveals), window (open / timed).

**Privacy rules:**
- Aliases only. No names, emails or IPs stored anywhere by Drift. The Hub/server side is **unknown**; Drift must send only `{alias, score, seed, day}`.
- Board is "kind": top 3 and your own row, never a ranked list that puts the lowest score on display, unless the teacher chooses the full list.
- Trust-based. No anti-cheat in the first cut. A seeded course plus an on-device score is fine for a classroom; replay verification is a later option, not a requirement.
- Without a Hub server (today), contest shows "Ask your teacher to turn on Class Challenge" and nothing else. **No local-only fake boards.**

---

## 10. Inclusion bar (acceptance checklist, applies to every stage that touches UI)

**Keyboard:** full play with keyboard only (WASD/arrows steer, Q/E or +/− pace, Shift/Space boost, P or Esc pause). Visible focus ring on every control (≥2 px, ≥3:1 against its background, offset). Logical Tab order. No keyboard trap in dialogs; Esc closes.
**Touch / motor:** every target ≥44×44 CSS px with ≥8 px gap. Pull-to-steer plus an on-screen **steer pad** option for kids who can't drag, and a throttle with notches. No multi-finger gesture needed, no timed gesture. "Easy" auto-level kept. Boost can be hold or toggle.
**Contrast and low vision:** text ≥4.5:1, UI ≥3:1 (AA). HUD sits on a solid or scrimmed plate, never bare text on bright cloud. Text size S/M/L/XL. A high-contrast theme. Reticle options kept.
**D/HH:** no sound-only cue anywhere. Every sound event has a text or visual twin. Sound defaults off. Captions for any audio ("Wind sound on").
**Not by color alone:** states use shape, position or text as well (hoops, throttle level, night/day, ranks, errors). Verified by a greyscale screenshot pass.
**Flash and motion:** nothing flashes more than 3 times a second; no full-screen luminance step above about 15% within 200 ms; world and night changes ease over ≥1.2 s. No harsh neon. Page and canvas background are the sky colour from first paint (no white flash). Reduced motion removes camera bob and FOV pulse and slows transitions. Cap the sun-glow sprite brightness (currently 0.95 additive).
**Language:** 8 languages + Simple, RTL for ar and fa-AF (mirror the HUD, keep the canvas steer direction), `lang` and `dir` on `<html>`, fonts that cover Cyrillic, Arabic/Dari and Ethiopic. Western vs Arabic-Indic digits: **unknown preference**. Read aloud through the Hub where present. Native review needed for fa-AF, rw, ti.
**Every control has an icon AND a text label.** Icon-only buttons (like a bare ✕) get a visible text label or are removed.
**Escape hatches always visible in flight:** Pause, Home, Mute (FeatureBot need #3).

---

## 11. Licensing and credits (constraint 4)

- **Credits screen** generated from `CREDITS.json` (name, author, SPDX license, URL, what it's used for). A node test fails if a package in `package.json` `dependencies`, or a file under `public/`, has no entry.
- **Libraries (all permissive, attribution lines needed):** three (MIT), React (MIT), lucide icons (ISC; copy only the ~15 SVGs used, with the notice). Exact current license text to be confirmed at S1/S9 from the installed packages.
- **Sounds:** treat the five existing mp3s as **not cleared**. Replace with the synthesized soundscapes, or with CC0/own recordings logged in `CREDITS.json`. Remove the mp3s at S17.
- **Fonts:** OFL fonts (Noto families) self-hosted and subset, or the system stack. No Google Fonts request. Coverage and size are **unknown** until tested.
- **Shaders and textures:** all procedural, written in-house. Any adapted snippet (noise functions, for example) gets a source line in the file and an entry in `CREDITS.json`. The `hash`/`noise` functions in the current shaders look like a common public pattern; origin **unknown**, so check before porting.
- **No third-party request at runtime**, enforced by the `net-check` gate (§13).

---

## 12. Staged plan

**Every stage obeys:** one Build paste ≤6,000 characters, ≤3 changes, ≤5 files, and a check at **1366×768, 1024×768 and 412×915** (phone landscape 915×412 is added from S7). Every stage that ships bumps the chip (one source, S1 onward), adds a CHANGELOG entry, and from S8 adds a dated What's new line in all 9 language tables. Before S8 the build is on an unlisted preview door, not student-facing.

**Work in `drift-next/`**, leave the live tree untouched until S21. The preview door (proposed `apps.kulibert.net/drift-next/`, unlisted, no Hub tile) is for Diego to try on real devices; the door path and rewrite are **unknown** (Q9).

**Gates:** do not start S6 until S5 passes look-lock. Do not start S11 until S4 holds 30 fps on the throttled run.

### S0. Baseline and look lock *(old tree, tooling only, no chip change)*
- **Files:** `scripts/look-lock.mjs`, `scripts/poses.json`, `docs/crew/DRIFT-LOOK-LOCK.md`, `package.json` (script line).
- **Changes:** (1) Playwright script loads a build at fixed poses at the 3 viewports (+915×412), saves PNGs and a 10 s frame-time CSV. (2) Seed-stub `Math.random` via `addInitScript` so `3e48cfe` renders the same every time. (3) Write the cloud checks as numbers in the look-lock doc (§13).
- **Check:** run on `3e48cfe` and `62af513`; Diego picks which reference frames are "good". PNGs live outside this repo (commit `1b6b5b7` keeps phone screenshots out of the repo; `shared/drift/visual-eval/` is the named home, existence **unknown**).

### S1. Scaffold
- **Files:** `drift-next/package.json`, `tsconfig.json`, `index.html`, `src/main.tsx`, `CHANGELOG.md`.
- **Changes:** (1) Vite + TS + React 19 + three, `base './'`, builds clean. (2) Chip from `package.json`, one source, shown in the page and on `<html data-version>`. (3) `net-check` script: loads the page and fails on any cross-origin request.
- **Check:** page shows chip and EN line on sky-colour background at all 3 viewports, no scroll, no console errors, zero cross-origin requests.

### S2. Sim and input port
- **Files:** `src/sim/craft.ts`, `src/sim/craft.test.ts`, `src/input/pull.ts`, `src/input/pull.test.ts`, `package.json` (test script).
- **Changes:** (1) Port `flight.ts` pure; `layerName` → `layerId`. (2) Add fixed-step `advance(dt)` with dt clamp. (3) Port `pull.ts` and its 5 tests verbatim.
- **Check:** `npm test` green; boot screen still loads at 3 viewports.

### S3. Probe, tiers, debug readout
- **Files:** `src/render/types.ts`, `probe.ts`, `quality.ts`, `probe.test.ts`, `src/main.tsx`.
- **Changes:** (1) Capability probe in try/catch (WebGL2, WebGL1, none; CrOS, cores, memory). (2) Tier table and starting-tier rule from §6. (3) `?debug=1` text readout.
- **Check:** readout shows a tier at each viewport; `?q=still` and a no-GPU launch both land on `still` with no error.

### S4. The floor: still renderer and loop
- **Files:** `src/render/canvas2d/sky.ts`, `canvas2d/glider.ts`, `src/game/loop.ts`, `src/input/input.ts`, `src/main.tsx`.
- **Changes:** (1) Canvas 2D sky gradient, horizon, 3 parallax cloud layers driven by the sim. (2) Fixed-step loop, pauses when hidden, keyboard steer plus pull. (3) Altitude and world as plain text.
- **Check:** flyable by keyboard and by finger at all 3 viewports. Steady 30 fps on a 4× CPU-throttled run. Works with GPU disabled.

### S5. Cloud spike in three *(the gate)*
- **Files:** `src/render/gl/renderer.ts`, `gl/clouds.ts`, `gl/sky.ts`, `gl/shaders.ts`, `src/main.tsx`.
- **Changes:** (1) three renderer behind the interface; context loss → `still`. (2) Seeded cloud-sea plane and seeded puff field matching the locked reference. (3) Tiers change puff count, render scale and AA per §6; horizon and FOV rules for portrait.
- **Check:** look-lock numbers pass at all viewports (§13); p95 frame time within each tier's budget; no merged banks, shadows visible. **Diego signs off the frames.**

### S6. Input v2 and pause
- **Files:** `src/input/input.ts`, `input.test.ts`, `src/game/state.ts`, `src/ui/PauseSheet.tsx`, `src/main.tsx`.
- **Changes:** (1) Keys, pull, gamepad → `Actions`, no global mutable object. (2) Play/pause/ready state; P and Esc pause; focus-safe key handling. (3) Pause sheet with Resume and Home.
- **Check:** every flight action by keyboard alone; pause freezes the sim at all 3 viewports.

### S7. HUD dock and layouts
- **Files:** `src/ui/Hud.tsx`, `ui/hud.css`, `ui/icons.ts`, `ui/useLayout.ts`, `src/main.tsx`.
- **Changes:** (1) Steer pad + throttle + Pause/Home/Mute, ≥44 px, icon + text. (2) Portrait, landscape, and desktop layouts inside `100dvh` and safe-area; no scroll in flight; labels never rotated. (3) Visible focus ring and plate contrast.
- **Check:** at 412×915 and 915×412 the whole HUD is on screen with thumbs reaching steer and throttle; Tab reaches every control; greyscale pass.

### S8. i18n, RTL, dated What's new
- **Files:** `src/i18n/copy.ts`, `i18n/index.ts`, `i18n/i18n.test.ts`, `src/ui/LangRoot.tsx`, `src/main.tsx`.
- **Changes:** (1) Port the 9 tables; **full Simple table** (58 keys to add). (2) Test: every table has every key, no silent fallback, `whatsNew` dated in all 9. (3) RTL for ar and fa-AF; `lang`/`dir` on `<html>`.
- **Check:** switch all 9 at each viewport: no overflow or clipping; HUD mirrors in RTL; chip == package version == top changelog entry (test).

### S9. Start, Settings, Credits
- **Files:** `src/ui/Start.tsx`, `ui/Settings.tsx`, `ui/Credits.tsx`, `CREDITS.json`, `src/credits.test.ts`.
- **Changes:** (1) Start screen: Calm and Chase buttons, "Calm break · not a grade." chip, text size and contrast settings. (2) Settings dialog with focus trap and Esc. (3) Credits screen plus the license-coverage test.
- **Check:** all three screens usable by keyboard and touch at 3 viewports; credits test fails when an entry is removed.

### S10. Storage and prefs
- **Files:** `src/store/storage.ts`, `store/prefs.ts`, `store/storage.test.ts`, `src/ui/Settings.tsx`, `src/main.tsx`.
- **Changes:** (1) Safe localStorage with memory fallback. (2) One-time migration from legacy keys. (3) Settings read and write prefs.
- **Check:** with storage blocked the app still runs; legacy prefs carry over; reload keeps choices at 3 viewports.

### S11. Run loop and scoring (still renderer)
- **Files:** `src/sim/course.ts`, `sim/run.ts`, `sim/run.test.ts`, `src/ui/RunHud.tsx`, `render/canvas2d/rings.ts`.
- **Changes:** (1) Seeded course. (2) Run state machine and scoring (§7.2). (3) Hoops drawn, text pointer, toasts for passes.
- **Check:** same seed + same recorded inputs = same score at 30 fps and 60 fps (test); run playable at 3 viewports on `still`.

### S12. Results and personal best
- **Files:** `src/ui/Results.tsx`, `src/store/best.ts`, `store/best.test.ts`, `src/ui/Start.tsx`, `src/main.tsx`.
- **Changes:** (1) Results screen with the score breakdown in words. (2) Top 5 per mode on this device, no alias. (3) Calm/Chase switch from Start and Results.
- **Check:** finish a run, reload, best persists; Results readable at 3 viewports in RTL and LTR.

### S13. GL rings and glider
- **Files:** `src/render/gl/rings.ts`, `gl/glider.ts`, `gl/renderer.ts`, `src/main.tsx`, `docs/crew/DRIFT-LOOK-LOCK.md`.
- **Changes:** (1) Instanced hoops (≤12). (2) Glider always in view. (3) Re-run look-lock.
- **Check:** a full run on each GL tier at 3 viewports; look-lock still passes.

### S14. Space and warp
- **Files:** `src/render/gl/space.ts`, `gl/warp.ts`, `render/canvas2d/space.ts`, `src/sim/world.ts`, `src/main.tsx`.
- **Changes:** (1) Space world on GL and still. (2) Warp starfield on boost, limited by tier. (3) Fade into space over ≥1.2 s, no white flash.
- **Check:** climb to space at 3 viewports; no flash; layer text correct in all languages.

### S15. Night and motion audit
- **Files:** `src/render/gl/sky.ts`, `render/canvas2d/sky.ts`, `src/sim/world.ts`, `src/ui/Settings.tsx`, `scripts/look-lock.mjs`.
- **Changes:** (1) Night mode on both renderers. (2) Reduced-motion path (no bob, no FOV pulse, slower fades). (3) Flash audit: frame-diff check for luminance steps.
- **Check:** night and day toggle at 3 viewports; audit script passes the §10 flash limits.

### S16. Reef *(only if Diego keeps it, Q3)*
- **Files:** `src/render/gl/reef.ts`, `gl/shaders.ts`, `render/canvas2d/reef.ts`, `scripts/shader-compile.mjs`, `src/sim/world.ts`.
- **Changes:** (1) Port the reef with a compile-all-shaders test in headless Chrome (Playwright). (2) `still` reef. (3) Reserved-word check in the shader test.
- **Check:** reef loads at 3 viewports on GL and still; the shader-compile script is green.

### S17. Audio
- **Files:** `src/audio/synth.ts`, `audio/captions.ts`, `src/ui/Hud.tsx`, `CREDITS.json`, `public/` (remove mp3s).
- **Changes:** (1) Synth-only wind and tracks. (2) A caption line for every sound that is on. (3) Remove the five mp3s.
- **Check:** with sound off, every state is still understood from text; no unlicensed asset left in `public/`.

### S18. Hub adapter
- **Files:** `src/adapters/hub.ts`, `adapters/standalone.ts`, `adapters/hub.test.ts`, `src/i18n/index.ts`, `src/main.tsx`.
- **Changes:** (1) Capability interface (§8) with standalone default. (2) Shims for today's shared scripts with timeout and same-origin check. (3) Alias read for the future contest only.
- **Check:** works with no Hub, with a stubbed Hub, and with the shared scripts blocked, at 3 viewports; `net-check` still clean on a non-classroom host.

### S19. Contest module
- **Files:** `src/contest/index.ts`, `contest/Rules.tsx`, `contest/Board.tsx`, `contest/contest.test.ts`, `src/main.tsx`.
- **Changes:** (1) Lazy chunk loaded only when the adapter enables it. (2) Rules and board per Q6–Q8. (3) Core has no import from `contest/` (lint or test).
- **Check:** off by default and absent from the bundle graph; with a stubbed config the rules and board work at 3 viewports; no name, email or IP leaves the page.

### S20. Chromebook pass and hardening
- **Files:** `src/render/quality.ts`, `render/gl/renderer.ts`, `src/main.tsx`, `src/ui/ErrorSheet.tsx`, `docs/crew/DRIFT-PERF-REPORT.md`.
- **Changes:** (1) Tune tier budgets from the **real class Chromebook** run. (2) Error boundary and context-loss recovery verified. (3) Memory check over a 10-minute fly.
- **Check:** class device holds its budget at 1366×768; 1024 and 412 on the same build; forced context loss recovers.

### S21. Cutover
- **Files:** `README.md`, `CHANGELOG.md`, `CREDITS.json`, `package.json`, `docs/crew/DRIFT-2-DESIGN.md` (mark done).
- **Changes:** (1) Promote `drift-next/` to the repo root and delete the legacy tree. (2) Final inclusion audit against §10. (3) Debugzy copies `dist/` into `apps-kulibert/public/drift/`; chip and What's new verified live.
- **Check:** `/drift/` matches the preview door, no Grok badge, no third-party request, all 9 languages, at 3 viewports.

---

## 13. Test gates (what "pass" means)

| Gate | How | Pass |
|---|---|---|
| **Pure tests** | `node --test --experimental-strip-types` on `sim`, `input`, `i18n`, `store`, `credits`, `contest` | all green |
| **Look lock (clouds)** | Playwright at fixed seed and pose, 3 viewports + landscape, compared to the signed-off reference frames | Starting thresholds, to be set in S0 with Diego's frames: distinct cloud blobs in frame ≥ the reference count (no merged banks); cloud coverage within ±10% of the reference; shadow contrast ≥ the reference; **plus Diego's eyes**. Numbers are **unknown until S0**. |
| **Frame budget** | `?debug` p95 over a 60 s fly, CPU-throttled 4× as a proxy; real class Chromebook at S5 and S20 | within the tier's target (§6). The −48%/−43% regressions become a recorded baseline. |
| **Net check** | Playwright logs every request | zero cross-origin requests |
| **No GPU** | Launch Chromium with GPU disabled | lands on `still`, no console error, playable |
| **Version consistency** | test | chip == `package.json` == top CHANGELOG entry; no duplicate version in CHANGELOG |
| **Language** | test + screenshots | 9 tables complete; no overflow in RTL |
| **A11y spot-check** | keyboard-only run, greyscale shot, contrast check of HUD plates | §10 checklist |

StudentTester's existing checks: **unknown**. Fold them into S0 if Debugzy can share them.

---

## 14. Questions for Diego

Short, pick one each. **(Recommended)** is my default if you'd rather not decide.

1. **What is the chase?**
   A. Ring run: glide through soft hoops for 90 s **(Recommended)** · B. Altitude: climb as high as you can · C. Distance: glide as far as you can · D. Build A, test B/C later
2. **What does Start offer first?**
   A. Calm first, Chase second **(Recommended)** · B. Chase first, Calm second · C. Chase only
3. **Which worlds at launch?**
   A. Sky + Space + Night, Reef later **(Recommended)** · B. Sky + Space + Reef + Night · C. Sky + Night only first
4. **Run length?**
   A. 60 s · B. 90 s **(Recommended)** · C. 3 min · D. No timer, a Land button
5. **Who sees scores outside a contest?**
   A. Only me, on this device **(Recommended)** · B. Me plus a class best · C. No scores at all
6. **Contest course (when you turn it on)?**
   A. Same course for the whole class **(Recommended)** · B. Fresh course every run · C. A new course each day
7. **Contest attempts?**
   A. Unlimited **(Recommended)** · B. 3 · C. 1
8. **Contest board?**
   A. Top 3 plus my own row **(Recommended)** · B. Full list · C. Hidden until I reveal it
9. **How do you want to try stages?**
   A. Unlisted preview door `/drift-next/` **(Recommended)** · B. Replace `/drift/` every stage · C. Only at the end
10. **Slowest class device?** Tell Debugzy the Chromebook model and RAM (free text). This sets the `light` tier budget.
11. **Native readers for Dari (fa-AF), Kinyarwanda (rw), Tigrinya (ti)?**
    A. Yes, I have reviewers · B. Ship as-is, marked "unreviewed" · C. Show English for those three until reviewed

---

## 15. Unknowns register

| # | Unknown | Who can settle it |
|---|---|---|
| 1 | Whether 1.12.4 "layered cumulus" passed StudentTester | Debugzy / StudentTester |
| 2 | Why the Reef "fails on every build": source at 1.12.4 has no bare `patch`; live cause not reproduced | S16 shader-compile test |
| 3 | Cause of React #418 (hypothesis only) | disappears with the static SPA |
| 4 | Cause of the hard white horizon band and tiny/sideways HUD on Diego's phone | S5/S7 golden shots on the phone |
| 5 | Real perf numbers; I did not reproduce −48% / −43% | S0 baseline, S20 |
| 6 | Class Chromebook model, RAM, GPU | Diego (Q10) |
| 7 | Origin and license of the 5 mp3s | Diego / Debugzy; replaced at S17 either way |
| 8 | Origin of the shader `hash`/`noise` snippets | check at port time |
| 9 | Font coverage of the Hub's `/fonts/room.css` (Cyrillic, Arabic, Ethiopic) | test in S8/S9 |
| 10 | Review status of fa-AF, rw, ti translations | Diego (Q11) |
| 11 | Redesigned Hub/class-server contract (alias, prefs, contest, submit) | Hub design |
| 12 | Whether the preview door and rewrite rules exist | Debugzy (Q9) |
| 13 | Whether `shared/drift/visual-eval/` exists | Debugzy |
| 14 | Whether pglite/auth is used live | not by any Drift component; live server behavior unknown |
| 15 | React vs Preact bundle cost on the floor device | measure at S1/S20 |
| 16 | Digit style (Western vs Arabic-Indic) for ar and fa-AF | Diego |
| 17 | Whether `__controlsTest` is used by StudentTester | Debugzy |
| 18 | No GameMaster design doc for Drift exists (per Debugzy) | n/a |
| 19 | Whether `/drift/` classroom copy's traffic map works at all (static snapshot, server function) | moot: dropped |
