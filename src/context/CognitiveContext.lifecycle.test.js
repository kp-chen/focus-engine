import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CognitiveProvider, STORAGE_KEY } from './CognitiveContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CognitiveProvider — loadState runs once (F8)', () => {
  let getItemSpy;

  beforeEach(() => {
    localStorage.clear();
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
  });
  afterEach(() => {
    getItemSpy.mockRestore();
  });

  it('reads localStorage once via the lazy initializer, not on every render', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Mount, then re-render several times. Each root.render re-runs the provider
    // function body, so a loadState() in the body would fire once per render.
    act(() => root.render(createElement(CognitiveProvider, null, createElement('div'))));
    act(() => root.render(createElement(CognitiveProvider, null, createElement('div'))));
    act(() => root.render(createElement(CognitiveProvider, null, createElement('div'))));
    act(() => root.render(createElement(CognitiveProvider, null, createElement('div'))));

    const reads = getItemSpy.mock.calls.filter(([k]) => k === STORAGE_KEY).length;
    // loadState() (getItem(STORAGE_KEY)) must run exactly once — the lazy init on
    // mount — not once per render.
    expect(reads).toBe(1);

    act(() => root.unmount());
  });
});
