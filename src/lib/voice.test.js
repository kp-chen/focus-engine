import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Behavioural coverage for src/lib/voice.js — the premium (pre-rendered MP3)
// voice layer.
//
// Only voice.js's *dependencies* are mocked: `fetch` (network) and
// `./audioContext` (audio hardware). voice.js itself is always the real module.
//
// voice.js keeps three pieces of module-level state — the memoised manifest
// promise, the URL→AudioBuffer cache, and the single tracked source — so every
// test re-imports it fresh through `loadVoice()` (vi.resetModules()).

// --- fake shared AudioContext -----------------------------------------------

// vi.mock factories are hoisted above imports, so the live context lives in a
// hoisted box the factory can read at call time.
const shared = vi.hoisted(() => ({ ctx: null }));

vi.mock('./audioContext', () => ({
  getAudioContext: () => shared.ctx,
}));

/**
 * A minimal AudioContext good enough for playBuffer(): it records every buffer
 * source and gain node it hands out so tests can inspect wiring, gain values
 * and stop() calls, and fire `onended` by hand (playback never ends on its own).
 */
function makeFakeContext() {
  const sources = [];
  const gains = [];
  return {
    destination: { name: 'destination' },
    decodeAudioData: vi.fn(async (arr) => ({ decodedFrom: arr })),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null,
        onended: null,
        connect: vi.fn((dest) => dest), // connect() returns the destination node
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(src);
      return src;
    }),
    createGain: vi.fn(() => {
      const g = {
        gain: { value: 'unset' },
        connect: vi.fn((dest) => dest),
        disconnect: vi.fn(),
      };
      gains.push(g);
      return g;
    }),
    sources,
    gains,
  };
}

// --- fetch plumbing ----------------------------------------------------------

const MANIFEST_URL = '/voices/manifest.json';

const MANIFEST = {
  voices: [
    { id: 'calm', label: 'Calm' },
    { id: 'warm', label: 'Warm' },
  ],
  nsdr: {
    calm: { 0: '/voices/calm/nsdr/00.mp3?v=aaa', 1: '/voices/calm/nsdr/01.mp3?v=bbb' },
  },
  letters: {
    calm: { C: '/voices/calm/letters/C.mp3?v=ccc', H: '/voices/calm/letters/H.mp3?v=ddd' },
  },
};

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function audioResponse({ ok = true, status = 200 } = {}) {
  return { ok, status, arrayBuffer: async () => new ArrayBuffer(16) };
}

let fetchMock;

/** Serve the given manifest at MANIFEST_URL and healthy audio everywhere else. */
function serveManifest(manifest) {
  fetchMock.mockImplementation(async (url) =>
    url === MANIFEST_URL ? jsonResponse(manifest) : audioResponse(),
  );
}

async function loadVoice() {
  vi.resetModules();
  return import('./voice');
}

/** Yield microtasks until `n` buffer sources exist (all mocks are promise-based). */
async function untilSources(n) {
  for (let i = 0; i < 500; i++) {
    if (shared.ctx.sources.length >= n) return;
    await Promise.resolve();
  }
  throw new Error(`timed out waiting for ${n} buffer source(s)`);
}

/** Let every pending microtask chain settle. */
async function settle() {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

/** End playback on a source the way the Web Audio API would. */
function end(src) {
  src.onended();
}

beforeEach(() => {
  shared.ctx = makeFakeContext();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  serveManifest(MANIFEST);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- 1. loadVoiceManifest ----------------------------------------------------

describe('1. loadVoiceManifest', () => {
  it('resolves to null (no throw) when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const voice = await loadVoice();

    await expect(voice.loadVoiceManifest()).resolves.toBeNull();
  });

  it('resolves to null (no throw) on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST, { ok: false, status: 404 }));
    const voice = await loadVoice();

    await expect(voice.loadVoiceManifest()).resolves.toBeNull();
  });

  it('parses and returns the manifest on a 200', async () => {
    const voice = await loadVoice();

    await expect(voice.loadVoiceManifest()).resolves.toEqual(MANIFEST);
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL);
  });

  it('fetches the manifest only once across repeated calls', async () => {
    const voice = await loadVoice();

    const a = await voice.loadVoiceManifest();
    const b = await voice.loadVoiceManifest();
    const c = await voice.loadVoiceManifest();

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(fetchMock.mock.calls.filter(([u]) => u === MANIFEST_URL)).toHaveLength(1);
  });

  it('fetches the manifest only once across different exported functions', async () => {
    const voice = await loadVoice();

    // All of these take the fallback path, so none of them await playback.
    await voice.getVoices();
    await voice.playNsdrSegment('nope', '0', 'text', 0.5, vi.fn(async () => {}));
    await voice.speakLetterPremium('nope', 'C', vi.fn());
    await voice.preloadLetters('nope');
    await voice.previewNsdrVoice('nope', 0.5, vi.fn());
    await voice.loadVoiceManifest();

    expect(fetchMock.mock.calls.filter(([u]) => u === MANIFEST_URL)).toHaveLength(1);
  });

  it('does NOT memoise a network failure — the next call retries', async () => {
    // This test used to assert the opposite ("memoises a failed manifest fetch
    // too"), which described the code faithfully and was still wrong: one
    // offline blip cached a null forever, so premium voices stayed dead for the
    // whole page session even after the network came back. A failed fetch is not
    // an answer, so it must not be cached.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const voice = await loadVoice();

    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);       // retried, not replayed
  });

  it('recovers once the network comes back', async () => {
    // The symptom that matters, end to end: fail once, then succeed, and the
    // manifest must actually load rather than replaying the cached null.
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const voice = await loadVoice();
    expect(await voice.loadVoiceManifest()).toBeNull();

    fetchMock.mockResolvedValue(jsonResponse(MANIFEST));
    expect(await voice.loadVoiceManifest()).toEqual(MANIFEST);
  });

  it('does NOT memoise a 5xx — the server failing is not an answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST, { ok: false, status: 503 }));
    const voice = await loadVoice();

    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('DOES memoise a 404 — "no manifest was built" is a real answer', async () => {
    // The negative control for the eviction: without this, "evict on failure"
    // could silently become "never cache anything", refetching a known-absent
    // manifest on every single call.
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST, { ok: false, status: 404 }));
    const voice = await loadVoice();

    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(await voice.loadVoiceManifest()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);       // cached, correctly
  });
});

// --- 2. getVoices ------------------------------------------------------------

describe('2. getVoices', () => {
  it('returns [] when the manifest is null (fetch failed)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const voice = await loadVoice();

    await expect(voice.getVoices()).resolves.toEqual([]);
  });

  it('returns [] when the manifest is null (non-OK response)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST, { ok: false, status: 500 }));
    const voice = await loadVoice();

    await expect(voice.getVoices()).resolves.toEqual([]);
  });

  it('returns [] when the manifest has no voices key', async () => {
    serveManifest({ nsdr: {}, letters: {} });
    const voice = await loadVoice();

    await expect(voice.getVoices()).resolves.toEqual([]);
  });

  it('returns [] when voices is an empty array', async () => {
    serveManifest({ voices: [] });
    const voice = await loadVoice();

    await expect(voice.getVoices()).resolves.toEqual([]);
  });

  it('returns the built voices when the manifest has them', async () => {
    const voice = await loadVoice();

    await expect(voice.getVoices()).resolves.toEqual(MANIFEST.voices);
  });
});

// --- 3. playNsdrSegment fallbacks -------------------------------------------

describe('3. playNsdrSegment', () => {
  it('falls back when the voice file is missing from the manifest', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await voice.playNsdrSegment('missing-voice', '0', 'body scan', 0.6, fallback);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
    // Nothing was fetched or played for a file that does not exist.
    expect(fetchMock.mock.calls.filter(([u]) => u !== MANIFEST_URL)).toHaveLength(0);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back when the segment key is missing for a known voice', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await voice.playNsdrSegment('calm', '99', 'body scan', 0.6, fallback);

    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back when the whole manifest is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);

    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
  });

  it('falls back (without throwing) when the buffer fetch is non-OK', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === MANIFEST_URL ? jsonResponse(MANIFEST) : audioResponse({ ok: false, status: 404 }),
    );
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await expect(
      voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback),
    ).resolves.toBeUndefined();

    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back when the buffer fetch rejects outright', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === MANIFEST_URL) return jsonResponse(MANIFEST);
      throw new TypeError('Failed to fetch');
    });
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);

    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
  });

  it('falls back when decodeAudioData rejects', async () => {
    shared.ctx.decodeAudioData.mockRejectedValue(new Error('EncodingError'));
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    await voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);

    expect(fallback).toHaveBeenCalledWith('body scan', 0.6);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('plays the pre-rendered file and does NOT fall back when it is available', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const done = voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);
    await untilSources(1);

    const [src] = shared.ctx.sources;
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST.nsdr.calm[0]);
    expect(src.buffer).toEqual({ decodedFrom: expect.any(ArrayBuffer) });
    expect(src.start).toHaveBeenCalledTimes(1);
    expect(shared.ctx.gains[0].gain.value).toBe(0.6);
    expect(fallback).not.toHaveBeenCalled();

    // The promise stays pending until the source ends.
    let settled = false;
    done.then(() => { settled = true; });
    await settle();
    expect(settled).toBe(false);

    end(src);
    await expect(done).resolves.toBeUndefined();
    expect(fallback).not.toHaveBeenCalled();
    expect(shared.ctx.gains[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached buffer for a segment played twice', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const first = voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);
    await untilSources(1);
    end(shared.ctx.sources[0]);
    await first;

    const second = voice.playNsdrSegment('calm', '0', 'body scan', 0.6, fallback);
    await untilSources(2);
    end(shared.ctx.sources[1]);
    await second;

    const audioFetches = fetchMock.mock.calls.filter(([u]) => u === MANIFEST.nsdr.calm[0]);
    expect(audioFetches).toHaveLength(1);
    expect(fallback).not.toHaveBeenCalled();
  });
});

// --- 4. speakLetterPremium fallbacks ----------------------------------------

describe('4. speakLetterPremium', () => {
  it('falls back when the letter file is missing from the manifest', async () => {
    const fallback = vi.fn();
    const voice = await loadVoice();

    await voice.speakLetterPremium('missing-voice', 'C', fallback);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith('C');
    expect(fetchMock.mock.calls.filter(([u]) => u !== MANIFEST_URL)).toHaveLength(0);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back when the letter is absent for a known voice', async () => {
    const fallback = vi.fn();
    const voice = await loadVoice();

    await voice.speakLetterPremium('calm', 'Z', fallback);

    expect(fallback).toHaveBeenCalledWith('Z');
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back (without throwing) when the buffer fetch/decode fails', async () => {
    shared.ctx.decodeAudioData.mockRejectedValue(new Error('EncodingError'));
    const fallback = vi.fn();
    const voice = await loadVoice();

    await expect(voice.speakLetterPremium('calm', 'C', fallback)).resolves.toBeUndefined();

    expect(fallback).toHaveBeenCalledWith('C');
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('falls back when the buffer fetch is non-OK', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === MANIFEST_URL ? jsonResponse(MANIFEST) : audioResponse({ ok: false, status: 403 }),
    );
    const fallback = vi.fn();
    const voice = await loadVoice();

    await voice.speakLetterPremium('calm', 'C', fallback);

    expect(fallback).toHaveBeenCalledWith('C');
  });

  it('plays the pre-rendered letter at 0.9 and does NOT fall back', async () => {
    const fallback = vi.fn();
    const voice = await loadVoice();

    await voice.speakLetterPremium('calm', 'C', fallback);
    await untilSources(1);

    expect(fetchMock).toHaveBeenCalledWith(MANIFEST.letters.calm.C);
    expect(shared.ctx.sources[0].start).toHaveBeenCalledTimes(1);
    expect(shared.ctx.gains[0].gain.value).toBe(0.9);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('does not track letters, so consecutive letters overlap instead of cutting each other off', async () => {
    const fallback = vi.fn();
    const voice = await loadVoice();

    await voice.speakLetterPremium('calm', 'C', fallback);
    await untilSources(1);
    await voice.speakLetterPremium('calm', 'H', fallback);
    await untilSources(2);

    expect(shared.ctx.sources[0].stop).not.toHaveBeenCalled();
    expect(shared.ctx.sources[1].stop).not.toHaveBeenCalled();
    // …and an untracked letter must not become the target of stopCurrentVoice().
    voice.stopCurrentVoice();
    expect(shared.ctx.sources[1].stop).not.toHaveBeenCalled();
  });
});

// --- 5. tracked playback / stopCurrentVoice ---------------------------------

describe('5. tracked playback', () => {
  it('stops the first tracked source when a second one starts', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const first = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    await untilSources(1);
    const second = voice.playNsdrSegment('calm', '1', 'seg 1', 0.5, fallback);
    await untilSources(2);

    const [a, b] = shared.ctx.sources;
    expect(a.stop).toHaveBeenCalledTimes(1);
    expect(b.stop).not.toHaveBeenCalled();
    expect(b.start).toHaveBeenCalledTimes(1);

    end(a);
    end(b);
    await Promise.all([first, second]);
  });

  it('stopCurrentVoice stops the in-flight source, and a second call is a safe no-op', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const done = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    await untilSources(1);
    const [src] = shared.ctx.sources;

    voice.stopCurrentVoice();
    expect(src.stop).toHaveBeenCalledTimes(1);

    expect(() => voice.stopCurrentVoice()).not.toThrow();
    expect(src.stop).toHaveBeenCalledTimes(1); // not stopped twice

    end(src);
    await done;
  });

  it('stopCurrentVoice is safe when nothing is playing', async () => {
    const voice = await loadVoice();

    expect(() => voice.stopCurrentVoice()).not.toThrow();
    expect(() => voice.stopCurrentVoice()).not.toThrow();
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('swallows a stop() that throws because the source already ended', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const done = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    await untilSources(1);
    const [src] = shared.ctx.sources;
    src.stop.mockImplementation(() => {
      throw new DOMException('InvalidStateError');
    });

    expect(() => voice.stopCurrentVoice()).not.toThrow();

    end(src);
    await done;
  });

  it('forgets a tracked source once it ends, so a later stop is a no-op', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const done = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    await untilSources(1);
    const [src] = shared.ctx.sources;
    end(src);
    await done;

    voice.stopCurrentVoice();
    expect(src.stop).not.toHaveBeenCalled();
  });

  it('previewNsdrVoice stops whatever tracked voice is already playing', async () => {
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    const playing = voice.playNsdrSegment('calm', '1', 'seg 1', 0.5, fallback);
    await untilSources(1);
    const [first] = shared.ctx.sources;

    const preview = voice.previewNsdrVoice('calm', 0.7, vi.fn());
    expect(first.stop).toHaveBeenCalledTimes(1); // stopped synchronously, before any await

    await untilSources(2);
    expect(shared.ctx.gains[1].gain.value).toBe(0.7);

    end(first);
    end(shared.ctx.sources[1]);
    await Promise.all([playing, preview]);
  });

  it('previewNsdrVoice calls its fallback when the voice has no rendered segment 0', async () => {
    const previewFallback = vi.fn();
    const voice = await loadVoice();

    await voice.previewNsdrVoice('missing-voice', 0.7, previewFallback);

    expect(previewFallback).toHaveBeenCalledTimes(1);
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });
});

// --- 6. volume clamping in playBuffer ---------------------------------------

describe('6. volume clamping', () => {
  /** Play one tracked segment at `vol` and return the gain that was applied. */
  async function gainFor(voice, vol) {
    const before = shared.ctx.sources.length;
    const done = voice.playNsdrSegment('calm', '0', 'seg 0', vol, vi.fn(async () => {}));
    await untilSources(before + 1);
    const src = shared.ctx.sources[before];
    const g = shared.ctx.gains[before];
    end(src);
    await done;
    return g.gain.value;
  }

  it('clamps a volume below 0 up to 0', async () => {
    const voice = await loadVoice();
    expect(await gainFor(voice, -0.5)).toBe(0);
  });

  it('clamps a large negative volume up to 0', async () => {
    const voice = await loadVoice();
    expect(await gainFor(voice, -100)).toBe(0);
  });

  it('clamps a volume above 1 down to 1', async () => {
    const voice = await loadVoice();
    expect(await gainFor(voice, 2.5)).toBe(1);
  });

  it('passes an in-range volume through unchanged', async () => {
    const voice = await loadVoice();
    expect(await gainFor(voice, 0.35)).toBe(0.35);
  });

  it('keeps the boundary values 0 and 1 exactly', async () => {
    const voice = await loadVoice();
    expect(await gainFor(voice, 0)).toBe(0);
    expect(await gainFor(voice, 1)).toBe(1);
  });

  it('wires the source through the gain node into the destination', async () => {
    const voice = await loadVoice();
    const done = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, vi.fn(async () => {}));
    await untilSources(1);

    const [src] = shared.ctx.sources;
    const [g] = shared.ctx.gains;
    expect(src.connect).toHaveBeenCalledWith(g);
    expect(g.connect).toHaveBeenCalledWith(shared.ctx.destination);

    end(src);
    await done;
  });
});

// --- preloadLetters ----------------------------------------------------------

describe('preloadLetters', () => {
  it('warms every letter buffer for the voice', async () => {
    const voice = await loadVoice();

    await voice.preloadLetters('calm');

    expect(fetchMock).toHaveBeenCalledWith(MANIFEST.letters.calm.C);
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST.letters.calm.H);
    // Warming decodes but must not start playback.
    expect(shared.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('resolves (never rejects) when a letter fails to load', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === MANIFEST_URL ? jsonResponse(MANIFEST) : audioResponse({ ok: false, status: 500 }),
    );
    const voice = await loadVoice();

    await expect(voice.preloadLetters('calm')).resolves.toBeUndefined();
  });

  it('is a no-op for a voice with no rendered letters', async () => {
    const voice = await loadVoice();

    await expect(voice.preloadLetters('missing-voice')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.filter(([u]) => u !== MANIFEST_URL)).toHaveLength(0);
  });
});

// --- documented current behaviour that looks like a bug ----------------------

describe('buffer cache recovery after a failed load', () => {
  // Regression guard. getBuffer() caches the in-flight promise so concurrent
  // callers share one fetch — but it used to keep that promise even when it
  // REJECTED, so a single transient failure (an offline blip, a 5xx from the
  // CDN) poisoned the URL for the whole page session: every later play replayed
  // the cached rejection and silently dropped to SpeechSynthesis, even after the
  // network recovered. The rejected entry is now evicted.
  it('re-fetches after a failed load once the network recovers', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (url) => {
      if (url === MANIFEST_URL) return jsonResponse(MANIFEST);
      attempts += 1;
      return attempts === 1 ? audioResponse({ ok: false, status: 503 }) : audioResponse();
    });
    const fallback = vi.fn(async () => {});
    const voice = await loadVoice();

    // First play fails and correctly falls back to SpeechSynthesis.
    await voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(1);

    // Network healthy again: the segment must re-fetch and play the real MP3
    // rather than replay the cached rejection.
    const second = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, fallback);
    await untilSources(1);
    end(shared.ctx.sources[0]);
    await second;

    expect(attempts).toBe(2);                       // it really did re-fetch
    expect(fallback).toHaveBeenCalledTimes(1);      // and did NOT fall back again
    expect(shared.ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('still shares a single in-flight fetch between concurrent callers', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (url) => {
      if (url === MANIFEST_URL) return jsonResponse(MANIFEST);
      attempts += 1;
      return audioResponse();
    });
    const voice = await loadVoice();

    // Two plays of the same segment started together must not double-fetch.
    const a = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, vi.fn(async () => {}));
    const b = voice.speakLetterPremium('calm', 'C', vi.fn());
    await untilSources(1);
    void b;

    expect(attempts).toBe(2); // one per distinct URL, not per call
    end(shared.ctx.sources[0]);
    await a;
  });
});

describe('known rough edges (asserted as CURRENT behaviour, not endorsed)', () => {

  // Observation (benign in the browser): when a second tracked source pre-empts
  // the first, playBuffer resolves the first promise only via its `onended`
  // handler. Real AudioBufferSourceNode.stop() does fire `onended`, so the
  // awaiting playNsdrSegment resolves — but nothing in voice.js guarantees it.
  it('a pre-empted segment resolves only once its onended fires', async () => {
    const voice = await loadVoice();

    const first = voice.playNsdrSegment('calm', '0', 'seg 0', 0.5, vi.fn(async () => {}));
    await untilSources(1);
    const second = voice.playNsdrSegment('calm', '1', 'seg 1', 0.5, vi.fn(async () => {}));
    await untilSources(2);

    let firstSettled = false;
    first.then(() => { firstSettled = true; });
    await settle();
    expect(firstSettled).toBe(false); // still pending despite having been stopped

    end(shared.ctx.sources[0]);
    await expect(first).resolves.toBeUndefined();

    end(shared.ctx.sources[1]);
    await second;
  });
});
