import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- Mock dependencies (never the module under test, per RULE 2) ---
const cognitive = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('../context/CognitiveContext', () => ({ useCognitive: () => cognitive }));
vi.mock('../context/AudioEngine', () => ({ useAudioEngine: () => ({ isRunning: () => false }) }));
vi.mock('../lib/useReducedMotion', () => ({ useReducedMotion: () => false }));

// startWork warms the shared AudioContext; chime() builds a short osc graph. The
// unmount test never reaches a phase boundary, so a minimal fake context suffices.
function fakeAudioContext() {
  const node = { connect: () => node, disconnect() {}, start() {}, stop() {}, frequency: { value: 0 }, gain: { value: 0, exponentialRampToValueAtTime() {} } };
  return { currentTime: 0, destination: {}, createOscillator: () => ({ ...node }), createGain: () => ({ ...node }) };
}
vi.mock('../lib/audioContext', () => ({ getAudioContext: () => fakeAudioContext() }));

const { default: UltradianTimer } = await import('./UltradianTimer');

function render(node) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

function buttonByText(container, text) {
  return /** @type {HTMLElement} */ (
    [...container.querySelectorAll('button')].find(b => (b.textContent || '').includes(text))
  );
}

describe('UltradianTimer — session lifecycle (F3)', () => {
  let realSI, realCI;

  beforeEach(() => {
    realSI = global.setInterval;
    realCI = global.clearInterval;
    // Don't let the 250ms tick fire during the test.
    global.setInterval = /** @type {any} */ (() => 0);
    global.clearInterval = () => {};
    cognitive.startSession.mockClear();
    cognitive.endSession.mockClear();
  });
  afterEach(() => {
    global.setInterval = realSI;
    global.clearInterval = realCI;
  });

  it('records the work block when unmounted mid-session', () => {
    const { container, root } = render(createElement(UltradianTimer));

    act(() => buttonByText(container, 'Start ').click());
    expect(cognitive.startSession).toHaveBeenCalledWith('timer');

    // Navigate away mid work block — the partial session must still be logged.
    act(() => root.unmount());
    expect(cognitive.endSession).toHaveBeenCalledTimes(1);
    expect(cognitive.endSession.mock.calls[0][0]).toMatchObject({ phase: 'work', aborted: true });
  });
});
