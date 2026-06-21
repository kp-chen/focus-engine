// A single AudioContext shared across every module. Creating a new context per
// play/stop (the old behaviour) hits the browser's hardware-context cap after a
// handful of cycles and throws; reusing one context avoids that entirely.
//
// getAudioContext() must be called from within a user gesture (a Play/Start
// click handler) the first time, so the context starts in the "running" state
// rather than "suspended" — this is what fixes silent audio on iOS Safari.

let sharedCtx = null;

export function getAudioContext() {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => { /* resume may reject outside a gesture */ });
  }
  return sharedCtx;
}
