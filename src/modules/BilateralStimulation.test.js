import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- Mock dependencies (never the module under test, per RULE 2) ---
const cognitive = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('../context/CognitiveContext', () => ({ useCognitive: () => cognitive }));
vi.mock('../lib/useReducedMotion', () => ({ useReducedMotion: () => false }));

// createBilateralEngine builds an osc -> gain -> panner -> envelope -> destination
// graph. A node whose connect() returns another such node lets the chain build.
function fakeNode() {
  return {
    connect: () => fakeNode(), disconnect() {}, start() {}, stop() {},
    frequency: { value: 0 }, gain: { value: 0 }, pan: { value: 0 },
  };
}
vi.mock('../lib/audioContext', () => ({
  getAudioContext: () => ({
    currentTime: 0, destination: {},
    createOscillator: fakeNode, createGain: fakeNode, createStereoPanner: fakeNode,
  }),
}));

const { default: BilateralStimulation } = await import('./BilateralStimulation');

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

describe('BilateralStimulation — session lifecycle (F3)', () => {
  let realRAF, realCAF, realSI, realCI;

  beforeEach(() => {
    realRAF = global.requestAnimationFrame;
    realCAF = global.cancelAnimationFrame;
    realSI = global.setInterval;
    realCI = global.clearInterval;
    // Keep the rAF animation + 1s elapsed timer from actually ticking.
    global.requestAnimationFrame = () => 0;
    global.cancelAnimationFrame = () => {};
    global.setInterval = /** @type {any} */ (() => 0);
    global.clearInterval = () => {};
    cognitive.startSession.mockClear();
    cognitive.endSession.mockClear();
  });
  afterEach(() => {
    global.requestAnimationFrame = realRAF;
    global.cancelAnimationFrame = realCAF;
    global.setInterval = realSI;
    global.clearInterval = realCI;
  });

  it('records the session when unmounted mid-session (navigation away)', () => {
    const { container, root } = render(createElement(BilateralStimulation));

    act(() => byAria(container, 'Begin bilateral stimulation').click());
    expect(cognitive.startSession).toHaveBeenCalledWith('bilateral');

    // Navigate away before it finishes — the session must still be logged.
    act(() => root.unmount());
    expect(cognitive.endSession).toHaveBeenCalledTimes(1);
  });

  it('records the session on a manual End Session (regression guard for stopAll)', () => {
    const { container } = render(createElement(BilateralStimulation));

    act(() => byAria(container, 'Begin bilateral stimulation').click());
    act(() => byAria(container, 'End bilateral stimulation session').click());

    expect(cognitive.endSession).toHaveBeenCalledTimes(1);
  });
});
