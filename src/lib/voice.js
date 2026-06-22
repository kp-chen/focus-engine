// Premium voice playback. Plays pre-rendered ElevenLabs MP3s (committed under
// public/voices/, see scripts/gen-voices.mjs) through the shared AudioContext,
// and transparently falls back to the browser's SpeechSynthesis when the assets
// are absent or fail to load. The pre-rendered audio is precached by the PWA, so
// the premium voice also works offline.

import { getAudioContext } from './audioContext';

let manifestPromise = null;
const bufferCache = new Map(); // url -> Promise<AudioBuffer>
let currentSource = null;       // in-flight NSDR voice source, so abort can stop it

export function loadVoiceManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('/voices/manifest.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return manifestPromise;
}

function getBuffer(url) {
  if (!bufferCache.has(url)) {
    bufferCache.set(url, (async () => {
      const ctx = getAudioContext();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`voice fetch ${res.status}`);
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    })());
  }
  return bufferCache.get(url);
}

// Play a decoded buffer through the shared context; resolves when it ends.
function playBuffer(buffer, volume, track) {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
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

// Stop any in-flight pre-rendered NSDR voice (called on session stop/abort).
export function stopCurrentVoice() {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }
}

/**
 * Speak one NSDR segment. Plays the pre-rendered MP3 for `key` if available,
 * otherwise calls `fallback(text, voiceVol)` (SpeechSynthesis). Resolves when the
 * segment finishes so the caller can then pause.
 */
export async function playNsdrSegment(key, text, voiceVol, fallback) {
  const manifest = await loadVoiceManifest();
  const file = manifest?.nsdr?.[key];
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
 * Speak one N-Back letter. Plays the pre-rendered MP3 if available (fire and
 * forget, for low latency), otherwise calls `fallback(letter)`.
 */
export async function speakLetterPremium(letter, fallback) {
  const manifest = await loadVoiceManifest();
  const file = manifest?.letters?.[letter];
  if (file) {
    try {
      const buf = await getBuffer(file);
      playBuffer(buf, 0.9, false);
      return;
    } catch { /* fall through */ }
  }
  fallback(letter);
}

// Warm the manifest + decode the letter buffers ahead of gameplay so the first
// trial has no decode latency. Safe no-op when there are no pre-rendered voices.
export async function preloadLetters() {
  const manifest = await loadVoiceManifest();
  if (!manifest?.letters) return;
  await Promise.all(Object.values(manifest.letters).map(f => getBuffer(f).catch(() => {})));
}
