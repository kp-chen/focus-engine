import { useSyncExternalStore } from 'react';

// Tracks the user's OS-level "reduce motion" preference. This is a focus/calm
// app, so several modules run continuous animations (breathing scale, pulsing
// circles, a tracking dot, an audio visualiser, a countdown ring) that can be
// uncomfortable for motion-sensitive users. Modules read this hook to FREEZE the
// purely-visual motion while keeping all functional timing and audio intact.
//
// useSyncExternalStore keeps the value live: if the user toggles the OS setting
// mid-session, components re-render. getServerSnapshot returns false (the app is
// client-only, but this keeps the hook safe under any future prerender).
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
