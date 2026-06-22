# Night-shift status — focus-engine Phase 2

Branch base: the Phase 0–1 "modernize" HEAD (`48da263`). Safety check passed:
`src/lib/audioContext.js` exists, so the worktree base is correct.

**All four steps (A, B, C, D) completed and committed**, each behind all gates
(lint 0 errors / test all pass / build ok, plus typecheck from Step D on).
Nothing was pushed or merged.

| Commit | Step |
|---|---|
| `4eb282e` | 2A: upgrade to React 19 / Router 7 / Vite 8 |
| `a20c678` | 2B: PWA (installable + offline) |
| `bcb6c43` | 2C: accessibility + prefers-reduced-motion |
| `27cc069` | 2D: type-checking |

---

## ⚠️ Ran headless — runtime behaviour NOT browser-verified

Everything below passed the static gates (lint, typecheck, unit tests, production
build). But this ran with **no browser**, so the following must be checked
manually by a human before trusting the release:

1. **Audio still plays** on a user gesture in every module — Focus Engine
   soundscape, NSDR ambient + spoken narration, Bilateral tones, Ultradian
   end-of-phase chime. (React 19 StrictMode double-invokes effects in dev; the
   shared `AudioContext` is module-level and never closed, so this *should* be
   fine, but it was not exercised.)
2. **PWA installs and works offline** — load once online, then go offline /
   reload and confirm the app + fonts + routes load from the service worker, and
   that the install prompt / "Add to Home Screen" works.
3. **Reduced motion actually freezes the animations** — toggle the OS "Reduce
   motion" setting and confirm the breathing circle, NSDR pulse, BLS tracking
   dot, Focus visualiser, and Ultradian ring stop moving while audio + timing
   continue.

---

## Step A — React 19 / Router 7 / Vite 8 (`4eb282e`)

**Files:** `package.json`, `package-lock.json`.

- `react`/`react-dom` `^18 → ^19.2.7`, `react-router-dom` `^6 → ^7.18.0`,
  `vite` `^5 → ^8.0.16`, `@vitejs/plugin-react` `^4 → ^6.0.2`.
- The app's Router API (`BrowserRouter`/`Routes`/`Route`/`useNavigate`/
  `useLocation`) is unchanged in v7. The old `v7_startTransition` /
  `v7_relativeSplatPath` **future-flag warnings are gone for free**: in Router 7
  those behaviours are the default, so no flags are needed (the warnings only
  existed in v6 as opt-in prompts).
- `<React.StrictMode>` retained in `src/main.jsx`.
- **ESLint left at `^9`** — `eslint-plugin-react@7.37.5` still does not declare
  ESLint 10 support, so bumping was skipped to keep lint green (as the step
  permitted).

## Step B — PWA (`a20c678`)

**Files:** `vite.config.js` (rewritten with `VitePWA`), `index.html`
(apple-touch-icon + apple web-app meta), `src/main.jsx` (SW registration),
`package.json` (`vite-plugin-pwa` dep + `icons` script), `scripts/gen-icons.mjs`
(new), `public/icon.svg` + `public/*.png` (new), `eslint.config.js` (Node-globals
block for `scripts/` + `*.config.js`).

- `vite-plugin-pwa@1.3.0`, `registerType: 'autoUpdate'`. Manifest exactly as
  specified: name **Cognitive Toolkit**, short_name **Cognitive**, theme_color
  & background_color **#0a0a0f**, display **standalone**, start_url **/**.
- Icons are the app's ◎ focus glyph (light ring + accent `#f06040` dot) on a
  `#0a0a0f` field: `pwa-192x192.png`, `pwa-512x512.png`, a 512 `maskable`, and a
  180 `apple-touch-icon`. They're generated from `public/icon.svg` by
  `scripts/gen-icons.mjs` (a dependency-free hand-rolled PNG encoder; run
  `npm run icons`). Committed as real PNGs.
- **CSP-safe SW registration:** the site CSP is `script-src 'self'` with no
  `unsafe-inline`, which would block the plugin's default *inline* registration
  script. So `injectRegister: false` and the SW is registered from the app
  bundle via `import { registerSW } from 'virtual:pwa-register'` in
  `src/main.jsx`.
- Workbox precaches all built assets (`js,css,html,svg,png,woff,woff2`) with
  `navigateFallback: '/'` for offline SPA routing.
- **Verified the build emits the PWA artifacts into `dist/`:**
  `dist/manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js`
  (57 precache entries), plus the icons. The built `index.html` references only
  the bundled module script + the injected `<link rel="manifest">` (no inline
  script → CSP compliant).

## Step C — Accessibility + prefers-reduced-motion (`bcb6c43`)

**Files:** `src/lib/useReducedMotion.js` (new), `src/components/TabBar.jsx`,
`src/components/NowPlaying.jsx`, `src/modules/FocusEngine.jsx`,
`src/modules/BreathworkStudio.jsx`, `src/modules/NsdrProtocol.jsx`,
`src/modules/UltradianTimer.jsx`, `src/modules/BilateralStimulation.jsx`.

- `useReducedMotion()` = `matchMedia('(prefers-reduced-motion: reduce)')` via
  `useSyncExternalStore` (live — re-renders if the user toggles the OS setting
  mid-session). Each module freezes **only the visual motion**, keeping
  functional timing + audio:
  - **BreathworkStudio** breathing circle → held at a neutral size (phase label
    + progress ring still update, so inhale/hold/exhale guidance is intact).
  - **NsdrProtocol** `RestCircle` → steady size, pulse interval not started.
  - **BilateralStimulation** tracking dot → pinned to centre; the L/R indicator
    and (in audio modes) the alternating tone carry the rhythm. The on-screen
    guidance text adapts when the dot is frozen.
  - **FocusEngine** visualiser → renders a single static frame; the rAF loop is
    skipped. Audio unaffected.
  - **UltradianTimer** ring → snaps per tick instead of the smooth 1 s sweep
    (numeric countdown is the primary cue anyway).
- aria-labels added: **TabBar** buttons (`aria-label` + `aria-current="page"` on
  the active tab, `aria-label="Primary"` on the nav), **NowPlaying** open/stop,
  **FocusEngine** play/stop, **BreathworkStudio** start/stop, **UltradianTimer**
  stop, **BilateralStimulation** mode/speed/tone (each with `aria-pressed`) and
  start/stop, **NSDR** begin/end and the ambient toggle (`role="switch"` +
  `aria-checked`). DualNBack's response buttons already had aria — left as-is.
- Non-color cue note: the BLS `PanIndicator` already pairs colour with a
  font-weight change, so the active L/R side is not colour-only — left as-is.

## Step D — Type-checking (`27cc069`)

**Files:** `jsconfig.json` (new), `src/vite-env.d.ts` (new), `package.json` +
`package-lock.json` (devDeps + `typecheck` script), `src/context/AudioEngine.jsx`
(JSDoc typedefs + typed ref), `src/context/CognitiveContext.jsx` (store typedefs).

- Took the **low-risk path — no `.jsx → .tsx` renames.** `jsconfig.json` with
  `allowJs` + `checkJs`, `react-jsx`, bundler resolution, `skipLibCheck`, and
  **`strict: false`** (deliberate — keeps the inline-style-heavy UI clean while
  still catching real type errors; with strictNullChecks off the optional store
  fields don't cause cascading noise).
- devDeps: `typescript@6.0.3`, `@types/react@19`, `@types/react-dom@19`,
  `@types/node`.
- `src/vite-env.d.ts`: references `vite/client` (CSS side-effect imports like
  `@fontsource/...css`, `import.meta.env`) and `vite-plugin-pwa/client`
  (`virtual:pwa-register`), plus a `Window` augmentation for Safari's
  `webkitAudioContext`.
- JSDoc `@typedef`s added for the store (`State`, `Session`, `Streak`,
  `Settings` in CognitiveContext) and the audio config/graph/engine shapes in
  AudioEngine; the engines `useRef` is typed so member access is checked.
- New script `npm run typecheck` (`tsc --noEmit -p jsconfig.json`) → **0 errors.**

---

## Exact final gate output

```
########## LINT ##########
✖ 31 problems (0 errors, 31 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.

########## TYPECHECK ##########
> tsc --noEmit -p jsconfig.json
(no output — 0 errors)

########## TEST ##########
 Test Files  1 passed (1)
      Tests  22 passed (22)

########## BUILD ##########
✓ built in 223ms
PWA v1.3.0
mode      generateSW
precache  57 entries (749.77 KiB)
files generated
  dist/sw.js
  dist/workbox-2fbc6a65.js
```

`dist/` after build contains: `manifest.webmanifest`, `sw.js`,
`workbox-2fbc6a65.js`, `pwa-192x192.png`, `pwa-512x512.png`,
`maskable-512x512.png`, `apple-touch-icon.png` — **manifest + service worker
confirmed present.**

### The 31 lint warnings (all pre-existing, 0 errors)
These are the Phase-1 "ratchet-down backlog" surfaced as warnings by design
(`react-hooks/exhaustive-deps`, `set-state-in-effect`, `refs`, the React
Compiler diagnostics, and `react-refresh/only-export-components`). Phase 2 did
not add any new error-level lint and did not attempt to burn down this backlog
(out of scope). `rules-of-hooks` stays an error and is clean.

---

## What remains / risks

- **Runtime verification (see the headless warning above)** — the single most
  important follow-up. Audio, offline/install, and reduced-motion all need a
  real browser pass.
- **Lint warning backlog (31)** — untouched on purpose; a future cleanup pass
  could ratchet these down.
- **ESLint stays at v9** — revisit a v10 bump once `eslint-plugin-react`
  declares support.
- **`strict: false` in jsconfig** — intentional for a smooth first integration.
  A future pass could enable `strictNullChecks` incrementally for stronger
  guarantees (expect to fix a number of `?.`/null-guard sites).
- **Icon aesthetics** — the committed PNGs are a clean procedural ◎ glyph; if a
  designed icon is preferred, replace `public/icon.svg` and re-run
  `npm run icons`.
- `npm audit` reports a low-severity advisory in the dev/build dependency tree
  (not shipped to users); not addressed here to avoid forced major bumps.

No push, no merge — branch left clean at `27cc069` for human review.
