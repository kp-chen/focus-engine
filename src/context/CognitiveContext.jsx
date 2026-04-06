import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const CognitiveContext = createContext(null);

// Storage helpers
const STORAGE_KEY = 'cognitive_toolkit';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('Storage save failed:', e); }
}

// Initial state
const defaultState = {
  sessions: [],        // Array of { id, module, startedAt, endedAt, duration, data }
  streaks: {           // Per-module streak tracking
    focus: { current: 0, best: 0, lastDate: null },
    breathe: { current: 0, best: 0, lastDate: null },
    nback: { current: 0, best: 0, lastDate: null },
    nsdr: { current: 0, best: 0, lastDate: null },
    timer: { current: 0, best: 0, lastDate: null },
    bilateral: { current: 0, best: 0, lastDate: null },
  },
  settings: {
    volume: 0.7,
    haptics: true,
  },
  activeSession: null, // Current running session { module, startedAt }
};

// Reducer
function reducer(state, action) {
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
  const saved = loadState();
  const [state, dispatch] = useReducer(reducer, saved || defaultState);

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
