import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { DEFAULT_NSDR_VOICE, DEFAULT_NBACK_VOICE } from '../lib/voiceContent';

const CognitiveContext = createContext(null);

/**
 * Per-module daily-use streak.
 * @typedef {Object} Streak
 * @property {number} current   Consecutive-day count.
 * @property {number} best      Best streak ever reached.
 * @property {string|null} lastDate  Date string of the last logged day.
 */

/**
 * A completed module session.
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} module
 * @property {number} startedAt  Epoch ms.
 * @property {number} endedAt    Epoch ms.
 * @property {number} duration   ms.
 * @property {Object} data       Module-specific payload.
 */

/**
 * @typedef {Object} Settings
 * @property {number} volume
 * @property {boolean} haptics
 * @property {string} [nsdrVoice]   ElevenLabs voice id for NSDR narration
 * @property {string} [nbackVoice]  ElevenLabs voice id for N-Back letters
 * @property {number} [hrvRate]     HRV pacer breaths/min
 * @property {number} [hrvRatio]    HRV inhale fraction of the cycle (0.4–0.5)
 * @property {boolean} [hrvAudioCue] HRV breathing tone on/off
 * @property {boolean} [hrvTapScore] HRV tap-along steadiness on/off
 */

/**
 * The persisted application state (localStorage under STORAGE_KEY).
 * @typedef {Object} State
 * @property {Session[]} sessions
 * @property {Record<string, Streak>} streaks
 * @property {Settings} settings
 * @property {{module: string, startedAt: number}|null} activeSession
 * @property {number} [_v]  Schema version stamped on load.
 */

// Storage helpers
export const STORAGE_KEY = 'cognitive_toolkit';
const SCHEMA_VERSION = 3;

/** @returns {State|null} */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return null;
    // Deep-merge AND per-field normalize the saved payload over the current
    // defaults, so state written by an older schema — or hand-edited / partially
    // corrupt — can never crash a newer build. This retires the "black screen"
    // class of bug entirely: not only must every module key exist, every value
    // the Dashboard reads (streak numbers, session shape, activeSession) must be
    // well-formed. Unknown junk keys are dropped.
    const streaks = {};
    for (const key of Object.keys(defaultStreaks)) {
      const sv = saved.streaks?.[key];
      streaks[key] = sv && typeof sv === 'object'
        ? {
            current: Number(sv.current) || 0,
            best: Number(sv.best) || 0,
            lastDate: typeof sv.lastDate === 'string' ? sv.lastDate : null,
          }
        : { ...defaultStreaks[key] };
    }
    const sessions = Array.isArray(saved.sessions)
      ? saved.sessions.filter(s => s && typeof s === 'object' && typeof s.startedAt === 'number')
      : [];
    const as = saved.activeSession;
    const activeSession = as && typeof as === 'object'
      && typeof as.startedAt === 'number' && typeof as.module === 'string'
      ? as
      : null;
    return {
      ...defaultState,
      ...saved,
      sessions,
      streaks,
      settings: { ...defaultState.settings, ...(saved.settings || {}) },
      activeSession,
      _v: SCHEMA_VERSION,
    };
  } catch (e) {
    console.warn('Failed to load saved state, starting fresh:', e);
    return null;
  }
}

/** @param {State} state */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('Storage save failed:', e); }
}

export const defaultStreaks = {
  focus: { current: 0, best: 0, lastDate: null },
  breathe: { current: 0, best: 0, lastDate: null },
  nback: { current: 0, best: 0, lastDate: null },
  nsdr: { current: 0, best: 0, lastDate: null },
  timer: { current: 0, best: 0, lastDate: null },
  bilateral: { current: 0, best: 0, lastDate: null },
  hrv: { current: 0, best: 0, lastDate: null },
};

// Initial state
/** @type {State} */
export const defaultState = {
  sessions: [],
  streaks: { ...defaultStreaks },
  settings: {
    volume: 0.7,
    haptics: true,
    nsdrVoice: DEFAULT_NSDR_VOICE,
    nbackVoice: DEFAULT_NBACK_VOICE,
    hrvRate: 6.0,
    hrvRatio: 0.4,
    hrvAudioCue: true,
    hrvTapScore: false,
  },
  activeSession: null, // Current running session { module, startedAt }
};

// Reducer
/**
 * @param {State} state
 * @param {{type: string, module?: string, data?: Object, settings?: Partial<Settings>}} action
 * @returns {State}
 */
export function reducer(state, action) {
  switch (action.type) {
    case 'START_SESSION': {
      return {
        ...state,
        activeSession: {
          module: action.module,
          startedAt: Date.now(),
        },
      };
    }
    case 'END_SESSION': {
      if (!state.activeSession) return state;
      const session = {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        module: state.activeSession.module,
        startedAt: state.activeSession.startedAt,
        endedAt: Date.now(),
        duration: Date.now() - state.activeSession.startedAt,
        data: action.data || {},
      };
      const today = new Date().toDateString();
      const moduleStreak = { ...state.streaks[session.module] };
      const lastDate = moduleStreak.lastDate;
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastDate === today) {
        // Already logged today, no change
      } else if (lastDate === yesterday) {
        moduleStreak.current += 1;
        moduleStreak.best = Math.max(moduleStreak.best, moduleStreak.current);
        moduleStreak.lastDate = today;
      } else {
        moduleStreak.current = 1;
        moduleStreak.best = Math.max(moduleStreak.best, 1);
        moduleStreak.lastDate = today;
      }

      return {
        ...state,
        activeSession: null,
        sessions: [...state.sessions.slice(-499), session], // Keep last 500
        streaks: { ...state.streaks, [session.module]: moduleStreak },
      };
    }
    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings } };
    }
    case 'EXPORT_DATA': {
      // Side-effect handled in provider
      return state;
    }
    case 'CLEAR_DATA': {
      return { ...defaultState };
    }
    default:
      return state;
  }
}

export function CognitiveProvider({ children }) {
  // Lazy initializer: loadState() runs once on mount, not on every provider
  // render (it does a synchronous localStorage.getItem + JSON.parse of the whole
  // store). useReducer ignores the init function after mount, so the result is
  // no longer recomputed and discarded each render.
  const [state, dispatch] = useReducer(reducer, null, () => loadState() || defaultState);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const startSession = useCallback((module) => {
    dispatch({ type: 'START_SESSION', module });
  }, []);

  const endSession = useCallback((data) => {
    dispatch({ type: 'END_SESSION', data });
  }, []);

  const updateSettings = useCallback((settings) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings });
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognitive-toolkit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const getModuleSessions = useCallback((module, days = 30) => {
    const cutoff = Date.now() - days * 86400000;
    return state.sessions.filter(s => s.module === module && s.startedAt > cutoff);
  }, [state.sessions]);

  const getTodayTotal = useCallback((module) => {
    const today = new Date().toDateString();
    return state.sessions
      .filter(s => s.module === module && new Date(s.startedAt).toDateString() === today)
      .reduce((sum, s) => sum + s.duration, 0);
  }, [state.sessions]);

  const value = {
    state,
    dispatch,
    startSession,
    endSession,
    updateSettings,
    exportData,
    getModuleSessions,
    getTodayTotal,
  };

  return (
    <CognitiveContext.Provider value={value}>
      {children}
    </CognitiveContext.Provider>
  );
}

export function useCognitive() {
  const ctx = useContext(CognitiveContext);
  if (!ctx) throw new Error('useCognitive must be used within CognitiveProvider');
  return ctx;
}
