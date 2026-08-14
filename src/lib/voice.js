// Premium voice playback. Plays pre-rendered ElevenLabs MP3s (committed under
// public/voices/, see scripts/gen-voices.mjs) through the shared AudioContext,
// and transparently falls back to the browser's SpeechSynthesis when the assets
// are absent or fail to load. Multiple voices are rendered; the caller passes the
// selected voiceId. The PWA runtime-caches each voice on first use for offline.

import { getAudioContext } from './audioContext';

let manifestPromise = null;
const bufferCache = new Map(); // url -> Promise<AudioBuffer>
let currentSource = null;       // in-flight NSDR voice source, so abort can stop it

export function loadVoiceManifest() {
  if (!manifestPromise) {
    // Same cache-poisoning rule as getBuffer below, applied to the manifest.
    // `.catch(() => null)` used to turn a network blip into a CACHED null, so one
    // transient failure silently disabled premium voices for the whole page
    // session: every later call replayed the memoised null and every module fell
    // back to SpeechSynthesis, even once the network recovered.
    //
    // A 4xx is a real answer — the manifest was never built — so that null is
    // memoised as before. A rejected fetch or a 5xx is the server failing to
    // answer, which is not information, so the entry is evicted and the next
    // caller retries.
    //
    // This never rejects, deliberately: getVoices() feeds `.then(setPremiumVoices)`
    // in DualNBack and NsdrProtocol with no rejection handler, so throwing here
    // would turn a missing manifest into an unhandled rejection and leave the
    // picker empty forever instead of falling back cleanly.
    const pending = (async () => {
      try {
        const r = await fetch('/voices/manifest.json');
        if (r.ok) return await r.json();
        if (r.status < 500) return null;          // definitive: no manifest built
      } catch { /* network failure — not an answer */ }
      if (manifestPromise === pending) manifestPromise = null;   // let the next call retry
      return null;
    })();
    manifestPromise = pending;
  }
  return manifestPromise;
}

// The pre-rendered voices available for the in-app pickers ([] when none built).
export async function getVoices() {
  const m = await loadVoiceManifest();
  return m?.voices || [];
}

function getBuffer(url) {
  if (!bufferCache.has(url)) {
    const pending = (async () => {
      const ctx = getAudioContext();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`voice fetch ${res.status}`);
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    })();
    // Cache the in-flight promise so concurrent callers share one fetch, but
    // evict it if it rejects. Keeping a rejected promise here meant a single
    // transient failure (an offline blip, a 5xx from the CDN) poisoned this URL
    // for the whole page session: every later play replayed the cached rejection
    // and silently dropped to SpeechSynthesis, even once the network recovered.
    pending.catch(() => {
      // Only evict our own entry — a later attempt may already have replaced it.
      if (bufferCache.get(url) === pending) bufferCache.delete(url);
    });
    bufferCache.set(url, pending);
  }
  return bufferCache.get(url);
}

// Play a decoded buffer through the shared context; resolves when it ends.
function playBuffer(buffer, volume, track) {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    // Only one tracked (NSDR) narration source may play at a time — stop any
    // previous one first so a restart / voice change can never overlap two voices.
    if (track && currentSource) {
      try { currentSource.stop(); } catch { /* already stopped */ }
      currentSource = null;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = Math.min(1, Math.max(0, volume));
    src.connect(g).connect(ctx.destination);
    src.onended = () => {
      try { g.disconnect(); } catch { /* noop */ }
      if (track && currentSource === src) currentSource = null;
      resolve();
    };
    if (track) currentSource = src;
    src.start();
  });
}

// Stop any in-flight pre-rendered NSDR voice (called on session stop/abort/preview).
export function stopCurrentVoice() {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }
}

/**
 * Speak one NSDR segment in `voiceId`. Plays the pre-rendered MP3 if available,
 * else calls `fallback(text, voiceVol)` (SpeechSynthesis). Resolves when done.
 */
export async function playNsdrSegment(voiceId, key, text, voiceVol, fallback) {
  const m = await loadVoiceManifest();
  const file = m?.nsdr?.[voiceId]?.[key];
  if (file) {
    try {
      const buf = await getBuffer(file);
      await playBuffer(buf, voiceVol, true);
      return;
    } catch { /* fall through to TTS */ }
  }
  await fallback(text, voiceVol);
}

/**
 * Speak one N-Back letter in `voiceId` (fire-and-forget, low latency), else
 * `fallback(letter)`.
 */
export async function speakLetterPremium(voiceId, letter, fallback) {
  const m = await loadVoiceManifest();
  const file = m?.letters?.[voiceId]?.[letter];
  if (file) {
    try {
      const buf = await getBuffer(file);
      playBuffer(buf, 0.9, false);
      return;
    } catch { /* fall through */ }
  }
  fallback(letter);
}

// Warm a voice's letter buffers ahead of gameplay (inside the start gesture).
export async function preloadLetters(voiceId) {
  const m = await loadVoiceManifest();
  const map = m?.letters?.[voiceId];
  if (!map) return;
  await Promise.all(Object.values(map).map(f => getBuffer(f).catch(() => {})));
}

// Preview a voice for the picker: play its first body-scan line (or fallback).
export async function previewNsdrVoice(voiceId, voiceVol, fallback) {
  stopCurrentVoice();
  const m = await loadVoiceManifest();
  const file = m?.nsdr?.[voiceId]?.['0'];
  if (file) {
    try {
      const buf = await getBuffer(file);
      await playBuffer(buf, voiceVol, true);
      return;
    } catch { /* fall through */ }
  }
  if (fallback) fallback();
}
