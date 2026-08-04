import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  reducer,
  loadState,
  defaultState,
  defaultStreaks,
  STORAGE_KEY,
} from './CognitiveContext';

// Run a full START → END cycle for a module, the way the UI does.
function play(state, module, data = {}) {
  const started = reducer(state, { type: 'START_SESSION', module });
  return reducer(started, { type: 'END_SESSION', data });
}

describe('reducer — sessions & streaks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('START_SESSION records the active session', () => {
    const s = reducer(defaultState, { type: 'START_SESSION', module: 'focus' });
    expect(s.activeSession).toMatchObject({ module: 'focus' });
    expect(typeof s.activeSession.startedAt).toBe('number');
  });

  it('END_SESSION with no active session is a no-op', () => {
    const s = reducer(defaultState, { type: 'END_SESSION', data: {} });
    expect(s).toBe(defaultState);
  });

  it('first ever session sets the streak to 1/best 1', () => {
    const s = play(defaultState, 'focus');
    expect(s.sessions).toHaveLength(1);
    expect(s.streaks.focus).toMatchObject({ current: 1, best: 1 });
    expect(s.activeSession).toBeNull();
  });

  it('a consecutive-day session increments the streak', () => {
    let s = play(defaultState, 'focus');
    vi.setSystemTime(new Date('2026-06-22T09:00:00')); // next day
    s = play(s, 'focus');
    expect(s.streaks.focus.current).toBe(2);
    expect(s.streaks.focus.best).toBe(2);
  });

  it('a second session the same day does not double-count', () => {
    let s = play(defaultState, 'focus');
    vi.setSystemTime(new Date('2026-06-21T18:00:00')); // same day, later
    s = play(s, 'focus');
    expect(s.streaks.focus.current).toBe(1);
    expect(s.sessions).toHaveLength(2); // session still logged
  });

  it('a gap of more than a day resets the streak but keeps best', () => {
    let s = play(defaultState, 'focus');
    vi.setSystemTime(new Date('2026-06-22T10:00:00'));
    s = play(s, 'focus'); // current 2
    vi.setSystemTime(new Date('2026-06-25T10:00:00')); // 3-day gap
    s = play(s, 'focus');
    expect(s.streaks.focus.current).toBe(1);
    expect(s.streaks.focus.best).toBe(2);
  });

  it('streaks are tracked per module independently', () => {
    let s = play(defaultState, 'focus');
    s = play(s, 'nback');
    expect(s.streaks.focus.current).toBe(1);
    expect(s.streaks.nback.current).toBe(1);
    expect(s.streaks.breathe.current).toBe(0);
  });

  it('caps the session history at 500 entries', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, module: 'focus', duration: 0 }));
    const s = play({ ...defaultState, sessions: many }, 'focus');
    expect(s.sessions).toHaveLength(500);
    expect(s.sessions[s.sessions.length - 1].module).toBe('focus');
  });
});

describe('reducer — settings & data', () => {
  it('UPDATE_SETTINGS merges without dropping existing keys', () => {
    const s = reducer(defaultState, { type: 'UPDATE_SETTINGS', settings: { volume: 0.2 } });
    expect(s.settings.volume).toBe(0.2);
    expect(s.settings.haptics).toBe(true); // preserved
  });

  it('CLEAR_DATA returns a clean default state', () => {
    const dirty = play(defaultState, 'focus');
    const s = reducer(dirty, { type: 'CLEAR_DATA' });
    expect(s.sessions).toHaveLength(0);
    expect(s.streaks.focus.current).toBe(0);
  });
});

describe('loadState — forward-compatible persistence (black-screen regression)', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadState()).toBeNull();
  });

  it('returns null (not a throw) on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadState()).toBeNull();
  });

  it('back-fills a payload that predates the streaks map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: [], settings: { volume: 0.5 } }));
    const s = loadState();
    // Every known module must have a streak — this is the exact shape whose
    // absence produced the "black screen" crash on the dashboard.
    expect(Object.keys(s.streaks).sort()).toEqual(Object.keys(defaultStreaks).sort());
    expect(s.settings.volume).toBe(0.5);
    expect(s.settings.haptics).toBe(true); // default merged in
  });

  it('adds streaks for modules missing from an older payload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      streaks: { focus: { current: 3, best: 5, lastDate: '2026-06-20' } },
    }));
    const s = loadState();
    expect(s.streaks.focus.current).toBe(3); // preserved
    expect(s.streaks.bilateral).toEqual(defaultStreaks.bilateral); // added
  });

  it('coerces a non-array sessions field to an empty array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: null }));
    expect(Array.isArray(loadState().sessions)).toBe(true);
  });

  it('returns null for a non-object top-level payload', () => {
    localStorage.setItem(STORAGE_KEY, '42');
    expect(loadState()).toBeNull();
  });

  // The Dashboard reads streak.best / streak.current and runs Math.max over every
  // entry — a malformed entry must be coerced, never passed through, or it crashes.
  it('normalizes a partial per-module streak entry (missing best)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ streaks: { focus: { current: 3 } } }));
    const s = loadState();
    expect(s.streaks.focus).toEqual({ current: 3, best: 0, lastDate: null });
    // Math.max over best values must never produce NaN.
    expect(Number.isNaN(Math.max(...Object.values(s.streaks).map(x => x.best)))).toBe(false);
  });

  it('replaces a null or non-object streak entry with the default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ streaks: { focus: null, nback: 5 } }));
    const s = loadState();
    expect(s.streaks.focus).toEqual(defaultStreaks.focus);
    expect(s.streaks.nback).toEqual(defaultStreaks.nback);
  });

  it('drops unknown junk keys from the streaks map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ streaks: { junk: 'x' } }));
    expect(Object.keys(loadState().streaks).sort()).toEqual(Object.keys(defaultStreaks).sort());
  });

  it('filters malformed session elements (the heatmap dereferences startedAt)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: [null, 5, { module: 'focus' }, { startedAt: 123, module: 'focus', duration: 0 }],
    }));
    const s = loadState();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].startedAt).toBe(123);
  });

  it('nulls a malformed activeSession so the next END_SESSION cannot record NaN', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeSession: 'oops' }));
    expect(loadState().activeSession).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeSession: { module: 'focus' } }));
    expect(loadState().activeSession).toBeNull(); // missing startedAt
  });

  it('preserves a well-formed activeSession', () => {
    const as = { module: 'focus', startedAt: 1000 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeSession: as }));
    expect(loadState().activeSession).toEqual(as);
  });

  it('drops unknown top-level keys — only the known schema is kept (F11)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: [{ id: 'x', module: 'focus', startedAt: 1, duration: 0 }],
      streaks: { focus: { current: 2, best: 3, lastDate: '2026-08-01' } },
      settings: { volume: 0.5 },
      activeSession: { module: 'focus', startedAt: 10 },
      junkTopLevel: 'should be dropped',
      anotherJunk: 42,
    }));
    const s = loadState();
    // Known fields survive and stay normalized...
    expect(s.sessions).toHaveLength(1);
    expect(s.streaks.focus.current).toBe(2);
    expect(s.settings.volume).toBe(0.5);
    expect(s.activeSession.module).toBe('focus');
    // ...but unknown top-level keys must not pass through onto state (and get
    // re-saved), or the "unknown junk keys are dropped" contract is false.
    expect(Object.keys(s).sort()).toEqual(
      ['_v', 'activeSession', 'sessions', 'settings', 'streaks']
    );
  });
});
