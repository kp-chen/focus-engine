/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// vite/client provides the ambient module declarations for CSS side-effect
// imports (e.g. '@fontsource/dm-sans/400.css') and import.meta.env, and
// vite-plugin-pwa/client provides the 'virtual:pwa-register' module.

// Safari exposes the AudioContext constructor under a webkit prefix; the shared
// audio context falls back to it (src/lib/audioContext.js).
interface Window {
  webkitAudioContext?: typeof AudioContext;
}
