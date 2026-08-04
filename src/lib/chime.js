import { getAudioContext } from './audioContext';

// A short sine "chime" marking work/rest phase boundaries on the shared
// AudioContext. The gain is disconnected in osc.onended so it isn't left
// connected to the shared destination until GC — otherwise each chime leaks one
// graph node. The oscillator itself goes silent on stop(); the still-connected
// GainNode is the leak. The shared context is intentionally left open (no
// per-chime context churn, which would hit the hardware-context cap).
export function chime() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => { try { gain.disconnect(); } catch {} };
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch {}
}
