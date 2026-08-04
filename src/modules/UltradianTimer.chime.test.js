import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chime()'s only dependency — the shared AudioContext (RULE 2: mock
// dependencies, never the module under test).
const fake = vi.hoisted(() => ({ ctx: null, osc: null, gain: null }));
vi.mock('../lib/audioContext', () => ({ getAudioContext: () => fake.ctx }));

const { chime } = await import('../lib/chime');

describe('UltradianTimer chime — disconnects its GainNode on end (F9)', () => {
  beforeEach(() => {
    fake.gain = {
      gain: { value: 0, exponentialRampToValueAtTime() {} },
      connect: () => ({}),
      disconnect: vi.fn(),
    };
    fake.osc = {
      frequency: { value: 0 },
      connect: () => fake.gain,
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
    fake.ctx = {
      currentTime: 100,
      destination: {},
      createOscillator: () => fake.osc,
      createGain: () => fake.gain,
    };
  });

  it('disconnects the gain node when the oscillator ends', () => {
    chime();
    // Without an onended handler the GainNode stays connected to the shared
    // destination after the note finishes (until GC), leaking one graph node
    // per work/rest chime. The oscillator itself goes silent on stop().
    expect(fake.osc.onended, 'osc.onended must be wired').toBeInstanceOf(Function);
    fake.osc.onended();
    expect(fake.gain.disconnect).toHaveBeenCalledTimes(1);
  });
});
