import { describe, it, expect, beforeEach, vi } from 'vitest';

// Regression coverage for the shared AudioContext lifecycle.
//
// The bug these pin: iOS Safari moves a context to "interrupted" (phone call,
// Siri, backgrounding, screen lock) — a state that is NOT "suspended". The
// module used to check only "suspended", so after an interruption it handed
// every module a silently dead context and audio stayed dead until a full
// page reload.
//
// The module keeps a singleton in module scope, so each test re-imports it
// fresh via vi.resetModules().

/** Build a fake AudioContext whose state we control. */
function makeFakeContextClass(state) {
  const instances = [];
  class FakeAudioContext {
    constructor() {
      this.state = state;
      this.resume = vi.fn(() => {
        this.state = 'running';
        return Promise.resolve();
      });
      instances.push(this);
    }
  }
  return { FakeAudioContext, instances };
}

async function loadModuleWith(state) {
  const { FakeAudioContext, instances } = makeFakeContextClass(state);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.resetModules();
  const mod = await import('./audioContext');
  return { mod, instances };
}

describe('getAudioContext', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('resumes a context left in the iOS "interrupted" state', async () => {
    const { mod, instances } = await loadModuleWith('interrupted');

    const ctx = mod.getAudioContext();

    expect(instances).toHaveLength(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context', async () => {
    const { mod } = await loadModuleWith('suspended');

    const ctx = mod.getAudioContext();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('leaves a running context alone', async () => {
    const { mod } = await loadModuleWith('running');

    const ctx = mod.getAudioContext();

    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('reuses the same context across calls instead of creating new ones', async () => {
    const { mod, instances } = await loadModuleWith('running');

    const a = mod.getAudioContext();
    const b = mod.getAudioContext();

    expect(a).toBe(b);
    expect(instances).toHaveLength(1); // never hits the hardware-context cap
  });

  it('replaces a closed context with a fresh one', async () => {
    const { mod, instances } = await loadModuleWith('running');

    const first = mod.getAudioContext();
    first.state = 'closed';
    const second = mod.getAudioContext();

    expect(second).not.toBe(first);
    expect(instances).toHaveLength(2);
  });

  it('swallows a resume() rejection outside a user gesture', async () => {
    const { mod } = await loadModuleWith('interrupted');

    const ctx = mod.getAudioContext();
    ctx.resume.mockRejectedValueOnce(new Error('not allowed'));

    // A second call re-attempts the resume; the rejection must not escape.
    expect(() => mod.getAudioContext()).not.toThrow();
  });
});
