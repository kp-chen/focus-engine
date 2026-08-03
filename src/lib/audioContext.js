// A single AudioContext shared across every module. Creating a new context per
// play/stop (the old behaviour) hits the browser's hardware-context cap after a
// handful of cycles and throws; reusing one context avoids that entirely.
//
// getAudioContext() must be called from within a user gesture (a Play/Start
// click handler) the first time, so the context starts in the "running" state
// rather than "suspended" — this is what fixes silent audio on iOS Safari.

let sharedCtx = null;

// States a shared context can sit in while still being revivable by resume().
// "interrupted" is the iOS one: Safari parks the context there on a phone call,
// Siri, backgrounding or screen lock. It is NOT "suspended", so checking only
// for "suspended" handed every module a silently dead context that stayed dead
// until a full page reload. It is specified in the Web Audio Editor's Draft
// (not yet in the published Recommendation), so treat it as advisory — browsers
// without it simply never report it.
const REVIVABLE_STATES = ['suspended', 'interrupted'];

export function getAudioContext() {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new Ctx();
  }
  if (REVIVABLE_STATES.includes(sharedCtx.state)) {
    sharedCtx.resume().catch(() => { /* resume may reject outside a gesture */ });
  }
  return sharedCtx;
}
