# Cognitive Toolkit (focus-engine)

A client-only React PWA of audio-modulation and cognitive-training tools for
focus, calm, and deep rest. Soundscapes are synthesized live in the browser
with the Web Audio API; spoken narration plays from pre-rendered audio shipped
with the app — there is no backend and no runtime API calls. Sessions and
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
- Pre-rendered **ElevenLabs** narration (MP3s committed under `public/voices/`) with a **SpeechSynthesis** fallback for NSDR and N-Back letters
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

## Voice pre-rendering (optional)

The narration MP3s under `public/voices/` are committed, so no API key is
needed to run, build, or deploy the app. To re-render or add voices, copy
`.env.example` to `.env`, set `ELEVENLABS_API_KEY`, and run `npm run voices`
(see `scripts/gen-voices.mjs` for options). `.env` is gitignored — never
commit a key.

## Notes

- No personal data is collected or transmitted. State lives in `localStorage`
  under the key `cognitive_toolkit` and is migrated forward on load.
- Audio requires a user gesture to start (browser autoplay policy).

## License

MIT — see [LICENSE](LICENSE).
