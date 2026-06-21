# Cognitive Toolkit (focus-engine)

A client-only React PWA of audio-modulation and cognitive-training tools for
focus, calm, and deep rest. All audio is synthesized live in the browser with
the Web Audio API — there is no backend and no media to download. Sessions and
streaks persist locally via `localStorage`; data never leaves the device and can
be exported as JSON.

Live: https://focus-engine-two.vercel.app

## Modules

| Route | Module | What it does |
|---|---|---|
| `/` | Dashboard | Streaks, recent sessions, settings, data export/clear |
| `/focus` | Focus Engine | AM-modulated focus soundscapes (noise / warm pad / binaural) |
| `/breathe` | Breathwork Studio | Guided breathing patterns (box, 4-7-8, …) with animation |
| `/nback` | Dual N-Back | Working-memory training game |
| `/nsdr` | NSDR Protocol | Non-sleep deep rest with spoken body-scan narration |
| `/timer` | Ultradian Timer | Work/rest focus cycles with chimes |
| `/bilateral` | Bilateral Stimulation | EMDR-style alternating audio/visual stimulation |

Each module links the research it is based on.

## Tech stack

- **React** + **Vite** SPA, code-split per route
- **Web Audio API** for all sound (procedural noise, oscillator graphs, convolution reverb, binaural beats)
- **SpeechSynthesis** for NSDR narration
- `useReducer` + `localStorage` for a versioned local store
- Self-hosted fonts (`@fontsource`), deployed on **Vercel**

## Scripts

```bash
npm install
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # ESLint (flat config)
npm test          # Vitest unit tests
```

## Notes

- No personal data is collected or transmitted. State lives in `localStorage`
  under the key `cognitive_toolkit` and is migrated forward on load.
- Audio requires a user gesture to start (browser autoplay policy).
