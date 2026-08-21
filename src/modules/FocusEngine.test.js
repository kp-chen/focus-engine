import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- Mock dependencies (never the module under test, per RULE 2) ---
const cognitive = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('../context/CognitiveContext', () => ({ useCognitive: () => cognitive }));
// Reduced motion keeps the visualizer on a single static frame (no rAF loop).
vi.mock('../lib/useReducedMotion', () => ({ useReducedMotion: () => true }));

// A minimal stand-in for the shared audio engine: startFocus/stopEngine flip the
// running flag that isRunning() reports, like the real provider does.
const audio = vi.hoisted(() => {
  const state = { running: false };
  return {
    state,
    startFocus: () => { state.running = true; },
    stopEngine: () => { state.running = false; },
    isRunning: () => state.running,
    getAnalyser: () => null,
    setVolume: () => {},
    getElapsed: () => 0,
  };
});
vi.mock('../context/AudioEngine', () => ({ useAudioEngine: () => audio }));

const { default: FocusEngine } = await import('./FocusEngine');

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

describe('FocusEngine — elapsed timer lifecycle (F2)', () => {
  let realSI, realCI, realGetContext, live, nextId;

  beforeEach(() => {
    audio.state.running = false;
    live = new Set();
    nextId = 1;
    realSI = global.setInterval;
    realCI = global.clearInterval;
    // Track intervals instead of letting them tick.
    global.setInterval = /** @type {any} */ (() => {
      const id = nextId++;
      live.add(id);
      return id;
    });
    global.clearInterval = /** @type {any} */ ((id) => { live.delete(id); });
    realGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = /** @type {any} */ (() => ({
      scale() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      stroke() {}, fill() {}, roundRect() {},
    }));
  });
  afterEach(() => {
    global.setInterval = realSI;
    global.clearInterval = realCI;
    HTMLCanvasElement.prototype.getContext = realGetContext;
  });

  it('leaves no interval running after repeated play/stop cycles', () => {
    const { container, root } = render(createElement(FocusEngine));

    for (let i = 0; i < 3; i++) {
      act(() => byAria(container, 'Play focus audio').click());
      // The real provider re-renders consumers when an engine starts/stops.
      act(() => { root.render(createElement(FocusEngine)); });
      expect(live.size).toBe(1);

      act(() => byAria(container, 'Stop focus audio').click());
      act(() => { root.render(createElement(FocusEngine)); });
      expect(live.size).toBe(0);
    }

    act(() => root.unmount());
    expect(live.size).toBe(0);
  });
});
