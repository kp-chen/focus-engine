import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- Mock dependencies (never the module under test, per RULE 2) ---
const cognitive = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('../context/CognitiveContext', () => ({ useCognitive: () => cognitive }));
vi.mock('../lib/useReducedMotion', () => ({ useReducedMotion: () => false }));

const { default: BreathworkStudio } = await import('./BreathworkStudio');

function render(node) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

function byAria(container, label) {
  return /** @type {HTMLElement} */ (container.querySelector(`[aria-label="${label}"]`));
}

describe('BreathworkStudio — session lifecycle (F3)', () => {
  let realRAF, realCAF;

  beforeEach(() => {
    realRAF = global.requestAnimationFrame;
    realCAF = global.cancelAnimationFrame;
    // Keep the breathing rAF loop from actually ticking during the test.
    global.requestAnimationFrame = () => 0;
    global.cancelAnimationFrame = () => {};
    cognitive.startSession.mockClear();
    cognitive.endSession.mockClear();
  });
  afterEach(() => {
    global.requestAnimationFrame = realRAF;
    global.cancelAnimationFrame = realCAF;
  });

  it('records the session when unmounted mid-session (navigation away)', () => {
    const { container, root } = render(createElement(BreathworkStudio));

    act(() => byAria(container, 'Start breathing session').click());
    expect(cognitive.startSession).toHaveBeenCalledWith('breathe');

    // Navigate away before the session finishes — the session must still be logged.
    act(() => root.unmount());
    expect(cognitive.endSession).toHaveBeenCalledTimes(1);
  });

  it('records a session that runs to natural completion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T09:00:00'));
    // Drive the rAF loop manually so we can fire one tick at the completion time.
    let rafCb = null;
    global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

    const { container } = render(createElement(BreathworkStudio));
    act(() => byAria(container, 'Start breathing session').click());
    expect(cognitive.startSession).toHaveBeenCalledWith('breathe');

    // Advance well past the default 300s target, then fire one tick.
    vi.setSystemTime(new Date('2026-08-04T09:06:00'));
    act(() => { rafCb && rafCb(); });

    expect(cognitive.endSession).toHaveBeenCalledTimes(1);
    expect(cognitive.endSession.mock.calls[0][0]).toMatchObject({ pattern: 'cyclic' });

    vi.useRealTimers();
  });
});
