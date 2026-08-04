import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

// React's act() only flushes synchronously when this flag is set.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- Mock FocusEngine's DEPENDENCIES (never FocusEngine itself, per RULE 2) ---
// A stateful provider so startFocus/stopEngine actually flip `playing` and
// re-render FocusEngine, the way the real AudioEngine's syncUI() does. Without
// this, the play()'s setElapsed(0) (0 -> 0) bails out and the button never flips.
vi.mock('../context/AudioEngine', async () => {
  const React = await import('react');
  const Ctx = React.createContext(null);
  function AudioEngineProvider({ children }) {
    const [running, setRunning] = React.useState(false);
    const api = React.useMemo(() => ({
      startFocus() { setRunning(true); },
      stopEngine() { setRunning(false); },
      isRunning() { return running; },
      getAnalyser() { return null; },
      setVolume() {},
      getElapsed() { return 0; },
    }), [running]);
    return React.createElement(Ctx.Provider, { value: api }, children);
  }
  function useAudioEngine() { return React.useContext(Ctx); }
  return { AudioEngineProvider, useAudioEngine };
});
vi.mock('../context/CognitiveContext', () => ({
  useCognitive: () => ({ startSession() {}, endSession() {} }),
}));
vi.mock('../lib/useReducedMotion', () => ({ useReducedMotion: () => false }));

const { default: FocusEngine } = await import('./FocusEngine');
const { AudioEngineProvider } = await import('../context/AudioEngine');

// Minimal render helper (no @testing-library dependency).
function render(node) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

// jsdom's canvas has no backing 2D context; the Visualizer reads several methods.
// A Proxy returning no-op functions covers them all.
function muteCanvas() {
  const noop2d = new Proxy({}, { get: () => () => {} });
  return () => noop2d;
}

// querySelector -> HTMLElement for .click(); the not-null reality is asserted.
function byAria(container, label) {
  return /** @type {HTMLElement} */ (container.querySelector(`[aria-label="${label}"]`));
}

describe('FocusEngine — elapsed timer lifecycle (F2)', () => {
  let live;
  let realSI, realCI, realRAF, realCAF, realGetContext;

  beforeEach(() => {
    realSI = global.setInterval;
    realCI = global.clearInterval;
    realRAF = global.requestAnimationFrame;
    realCAF = global.cancelAnimationFrame;
    realGetContext = HTMLCanvasElement.prototype.getContext;

    // Track how many intervals the component created are still live.
    live = new Set();
    global.setInterval = (fn, ms) => { const id = realSI(fn, ms); live.add(id); return id; };
    global.clearInterval = (id) => { live.delete(id); realCI(id); };
    // Keep the Visualizer's rAF loop from actually ticking in the test.
    global.requestAnimationFrame = () => 0;
    global.cancelAnimationFrame = () => {};
    HTMLCanvasElement.prototype.getContext = /** @type {any} */ (muteCanvas());
  });

  afterEach(() => {
    for (const id of live) realCI(id); // clear anything still outstanding
    live.clear();
    global.setInterval = realSI;
    global.clearInterval = realCI;
    global.requestAnimationFrame = realRAF;
    global.cancelAnimationFrame = realCAF;
    HTMLCanvasElement.prototype.getContext = realGetContext;
  });

  it('clears its 1s elapsed interval on stop — no orphaned interval per cycle', () => {
    const { container, root } = render(
      createElement(AudioEngineProvider, null, createElement(FocusEngine))
    );

    // Play: flips the engine on; the button becomes "Stop".
    act(() => byAria(container, 'Play focus audio').click());
    const stopBtn = byAria(container, 'Stop focus audio');
    expect(stopBtn, 'playing should be true after Play').not.toBeNull();

    // Stop: tears the engine down; the button becomes "Play" again.
    act(() => stopBtn.click());
    expect(byAria(container, 'Play focus audio'), 'playing should be false after Stop').not.toBeNull();

    // After a full play -> stop cycle, NO interval the component created may still
    // be live. The bug left the play()-created interval orphaned (cleared only on
    // unmount), ticking setElapsed every second for the lifetime of the tab.
    expect([...live]).toHaveLength(0);

    act(() => root.unmount());
  });
});
