import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useReducedMotion } from '../lib/useReducedMotion';
import { getAudioContext } from '../lib/audioContext';
import { MODULE_COLORS } from '../theme';

const COLOR = MODULE_COLORS.hrv;

// Resonance-frequency breathing: ~6 breaths/min (0.1 Hz) is where slow breathing
// maximises heart-rate variability. The pacer IS the evidence-based intervention;
// this module deliberately MEASURES nothing (see the honesty notes in the UI).
const RATE_PRESETS = [
  { label: '5.0', value: 5.0 },
  { label: '5.5', value: 5.5 },
  { label: '6.0', value: 6.0 },
  { label: '6.5', value: 6.5 },
];

const RATIOS = [
  { label: 'Even', value: 0.5, desc: 'Equal in / out' },
  { label: 'Longer exhale', value: 0.4, desc: 'More vagal tone' },
];

const DURATIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

function haptic(ms = 25) {
  try { navigator?.vibrate?.(ms); } catch {}
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Pacing-steadiness score from per-tap timing errors (each already clamped 0..1).
function scoreFrom(errs) {
  if (!errs.length) return null;
  return Math.round(100 * (1 - errs.reduce((a, b) => a + b, 0) / errs.length));
}

const DISCLAIMER = 'Guides resonance breathing — it does not measure your heart.';

// Breathing circle — expands on inhale, contracts on exhale; frozen (neutral) and
// pulse-free under reduced motion, with the phase label + ring still updating.
function BreathCircle({ phase, progress, isActive, reduced }) {
  const base = 0.5;
  const max = 1.0;
  let scale = base;
  if (reduced) scale = (base + max) / 2;
  else if (!isActive) scale = base;
  else if (phase === 'inhale') scale = base + (max - base) * progress;
  else scale = max - (max - base) * progress;

  const ringProgress = isActive ? progress : 0;

  return (
    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', inset: -20, borderRadius: '50%',
        background: `radial-gradient(circle, ${COLOR}15 0%, transparent 70%)`,
        transform: `scale(${scale})`,
        transition: isActive ? 'none' : 'transform 0.8s ease',
      }} />
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx="110" cy="110" r="100" fill="none" stroke="#1e1e26" strokeWidth="2" />
        {isActive && (
          <circle cx="110" cy="110" r="100" fill="none" stroke={COLOR} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 100}`}
            strokeDashoffset={`${2 * Math.PI * 100 * (1 - ringProgress)}`}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
        )}
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', width: 140, height: 140,
        marginTop: -70, marginLeft: -70, borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${COLOR}20, ${COLOR}08)`,
        border: `1.5px solid ${COLOR}30`,
        transform: `scale(${scale})`,
        transition: isActive ? 'transform 0.15s ease-out' : 'transform 0.8s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? '#e8e8ec' : '#555', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {isActive ? (phase === 'inhale' ? 'Breathe in' : 'Breathe out') : 'Ready'}
        </div>
      </div>
    </div>
  );
}

// Settings toggle row (module-scoped so it isn't recreated on every render).
function Toggle({ on, onClick, label, sublabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderRadius: 12, background: '#111116', border: '1px solid #1e1e26', marginBottom: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sublabel}</div>
      </div>
      <button onClick={onClick} role="switch" aria-checked={on} aria-label={label} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: on ? COLOR : '#252530', cursor: 'pointer', position: 'relative', flexShrink: 0,
      }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }} />
      </button>
    </div>
  );
}

export default function HrvBiofeedback() {
  const { startSession, endSession, state, updateSettings } = useCognitive();
  const reduced = useReducedMotion();

  const rate = state.settings.hrvRate ?? 6.0;
  const ratio = state.settings.hrvRatio ?? 0.4;
  const audioCue = state.settings.hrvAudioCue ?? true;
  const tapScore = state.settings.hrvTapScore ?? false;
  const volume = state.settings.volume ?? 0.7;

  const [targetDuration, setTargetDuration] = useState(300);
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [breaths, setBreaths] = useState(0);
  const [steadiness, setSteadiness] = useState(null); // null until the user taps
  const [summary, setSummary] = useState(null);

  const rafRef = useRef(null);
  const activeRef = useRef(false);
  const sessionStartRef = useRef(0);
  const breathRef = useRef(0);
  const tapErrorsRef = useRef([]);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const wakeLockRef = useRef(null);
  const visHandlerRef = useRef(null);
  // Session params are snapshotted into refs at start, so the running rAF loop and
  // the recorded payload never read stale state or a mid-session settings change.
  const cycleRef = useRef({ cycleMs: 10000, inhaleMs: 4000 });
  const targetRef = useRef(targetDuration);

  const teardownAudio = useCallback(() => {
    const osc = oscRef.current, gain = gainRef.current;
    oscRef.current = null;
    gainRef.current = null;
    if (!osc) return;
    const ctx = getAudioContext();
    try {
      if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      // Scheduled stop on the audio clock + disconnect in onended — no wall-clock
      // setTimeout that could fire after unmount.
      osc.onended = () => { try { gain && gain.disconnect(); } catch {} };
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      try { osc.stop(); } catch {}
      try { gain && gain.disconnect(); } catch {}
    }
  }, []);

  const acquireWake = useCallback(() => {
    const req = () => {
      if (navigator.wakeLock && activeRef.current) {
        navigator.wakeLock.request('screen').then(l => { wakeLockRef.current = l; }).catch(() => {});
      }
    };
    req();
    // Browsers (esp. iOS) drop the wake lock when the tab is hidden; re-acquire on return.
    const onVis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', onVis);
    visHandlerRef.current = onVis;
  }, []);

  const releaseWake = useCallback(() => {
    try { wakeLockRef.current && wakeLockRef.current.release(); } catch {}
    wakeLockRef.current = null;
    if (visHandlerRef.current) {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
      visHandlerRef.current = null;
    }
  }, []);

  // Record the active session from refs (the source of truth). Stable identity, so
  // it can be called from a frozen rAF closure or the unmount path without staleness.
  const endActive = useCallback(() => {
    const { cycleMs, inhaleMs } = cycleRef.current;
    const payload = {
      rate: Math.round((60000 / cycleMs) * 10) / 10,
      ratio: Math.round((inhaleMs / cycleMs) * 100) / 100,
      breaths: breathRef.current,
      targetDuration: targetRef.current,
      actualDuration: Math.round((Date.now() - sessionStartRef.current) / 1000),
      steadiness: scoreFrom(tapErrorsRef.current),
    };
    endSession(payload);
    return payload;
  }, [endSession]);

  const stopSession = useCallback((completed = false) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    teardownAudio();
    releaseWake();
    const payload = endActive();
    setSummary({ ...payload, completed });
    setIsActive(false);
  }, [endActive, teardownAudio, releaseWake]);

  // Latest endActive for the unmount path (records the session without setState).
  const endActiveRef = useRef(null);
  useEffect(() => { endActiveRef.current = endActive; }, [endActive]);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    const ctx = getAudioContext();
    const now = Date.now();
    const total = (now - sessionStartRef.current) / 1000;
    setElapsed(total);
    if (total >= targetRef.current) { stopSession(true); return; }

    const { cycleMs, inhaleMs } = cycleRef.current;
    const tInCycle = (now - sessionStartRef.current) % cycleMs;
    const inInhale = tInCycle < inhaleMs;
    const ph = inInhale ? 'inhale' : 'exhale';
    const prog = inInhale ? tInCycle / inhaleMs : (tInCycle - inhaleMs) / (cycleMs - inhaleMs);
    setPhase(ph);
    setPhaseProgress(prog);

    const b = Math.floor((now - sessionStartRef.current) / cycleMs);
    if (b !== breathRef.current) {
      breathRef.current = b;
      setBreaths(b);
      haptic(20);
    }

    // Soft tone: glides up on the in-breath, down on the out-breath.
    if (oscRef.current) {
      const lo = 174.61, hi = 261.63; // F3 -> C4
      const freq = inInhale ? lo + (hi - lo) * prog : hi - (hi - lo) * prog;
      try { oscRef.current.frequency.setValueAtTime(freq, ctx.currentTime); } catch {}
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [stopSession]);

  const start = useCallback(() => {
    const cycleMs = 60000 / rate;
    cycleRef.current = { cycleMs, inhaleMs: cycleMs * ratio };
    targetRef.current = targetDuration;
    activeRef.current = true;
    sessionStartRef.current = Date.now();
    breathRef.current = 0;
    tapErrorsRef.current = [];
    setIsActive(true);
    setSummary(null);
    setElapsed(0);
    setPhase('inhale');
    setPhaseProgress(0);
    setBreaths(0);
    setSteadiness(null);

    // Warm + build the breath tone inside this gesture so iOS lets it play.
    if (audioCue && volume > 0) {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 174.61;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(Math.min(0.5, volume) * 0.12, ctx.currentTime, 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
    }

    acquireWake();
    startSession('hrv');
    haptic(50);
    rafRef.current = requestAnimationFrame(tick);
  }, [rate, ratio, audioCue, volume, targetDuration, tick, startSession, acquireWake]);

  // Tap-along: the user taps at the top of each in-breath. Steadiness = how close
  // the taps land to the inhale→exhale turn. It measures pacing, NOT the heart.
  const handleTap = useCallback(() => {
    if (!activeRef.current) return;
    const { cycleMs, inhaleMs } = cycleRef.current;
    const tInCycle = (Date.now() - sessionStartRef.current) % cycleMs;
    const diff = Math.abs(tInCycle - inhaleMs);
    const circular = Math.min(diff, cycleMs - diff);
    const err = Math.min(circular / (cycleMs / 2), 1); // 0 = perfect, 1 = worst
    tapErrorsRef.current.push(err);
    setSteadiness(scoreFrom(tapErrorsRef.current));
    haptic(15);
  }, []);

  // Cleanup on unmount — including mid-session navigation away: record the session
  // (so it isn't lost and the dangling activeSession is cleared) and tear down.
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    teardownAudio();
    releaseWake();
    if (activeRef.current) {
      activeRef.current = false;
      endActiveRef.current && endActiveRef.current();
    }
  }, [teardownAudio, releaseWake]);

  const remaining = Math.max(0, targetDuration - elapsed);
  const setupVisible = !isActive && !summary;

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>HRV Biofeedback</h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Resonance-frequency breathing pacer
        </p>
      </div>

      {setupVisible && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Breathing rate (breaths / min)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {RATE_PRESETS.map(r => (
                <button key={r.value} onClick={() => updateSettings({ hrvRate: r.value })} aria-pressed={rate === r.value} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  border: `1px solid ${rate === r.value ? COLOR + '50' : '#1e1e26'}`,
                  background: rate === r.value ? COLOR + '10' : '#111116',
                  color: rate === r.value ? '#e8e8ec' : '#666', fontSize: 15, fontWeight: 700,
                }}>{r.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>~6 breaths/min (0.1 Hz) is the typical resonance rate. Pick what feels easiest to sustain.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Rhythm</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {RATIOS.map(r => (
                <button key={r.value} onClick={() => updateSettings({ hrvRatio: r.value })} aria-pressed={ratio === r.value} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  border: `1px solid ${ratio === r.value ? COLOR + '50' : '#1e1e26'}`,
                  background: ratio === r.value ? COLOR + '10' : '#111116',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ratio === r.value ? '#e8e8ec' : '#666' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Duration</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setTargetDuration(d.value)} aria-pressed={targetDuration === d.value} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  border: `1px solid ${targetDuration === d.value ? COLOR + '50' : '#1e1e26'}`,
                  background: targetDuration === d.value ? COLOR + '10' : '#111116',
                  color: targetDuration === d.value ? '#e8e8ec' : '#555', fontSize: 13, fontWeight: 600,
                }}>{d.label}</button>
              ))}
            </div>
          </div>

          <Toggle on={audioCue} onClick={() => updateSettings({ hrvAudioCue: !audioCue })}
            label="Breathing tone" sublabel="Soft tone rises on inhale, falls on exhale" />
          <Toggle on={tapScore} onClick={() => updateSettings({ hrvTapScore: !tapScore })}
            label="Tap-along steadiness" sublabel="Tap at the top of each in-breath to score your pacing" />

          <button onClick={start} aria-label="Begin HRV session" style={{
            width: '100%', padding: '16px', borderRadius: 14, marginTop: 8,
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", boxShadow: `0 4px 24px ${COLOR}30`,
          }}>Begin</button>
        </>
      )}

      {isActive && (
        <div style={{ background: '#111116', borderRadius: 16, padding: '24px 20px', border: '1px solid #1e1e26', boxShadow: `0 0 80px ${COLOR}08` }}>
          <BreathCircle phase={phase} progress={phaseProgress} isActive={isActive} reduced={reduced} />

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: 24, padding: '12px 0', borderTop: '1px solid #1e1e26' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Remaining</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: COLOR }}>{formatTime(remaining)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Breaths</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{breaths}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Rate</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{rate}</div>
            </div>
          </div>

          {tapScore && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button onClick={handleTap} aria-label="Tap at the top of the in-breath" style={{
                width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                background: '#1a1a22', border: `1px solid ${COLOR}30`, color: '#ccc', fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              }}>Tap at the top of each in-breath</button>
              {steadiness !== null && (
                <>
                  <div style={{ height: 6, borderRadius: 3, background: '#1a1a22', marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${steadiness}%`, background: COLOR, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                    Pacing steadiness {steadiness}% — reflects how steadily you followed the pacer, <strong>not</strong> a heart-rate measurement.
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <button onClick={() => stopSession(false)} aria-label="End session" style={{
              padding: '12px 40px', borderRadius: 12, background: '#1a1a22', border: '1px solid #252530',
              color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>End Session</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: '#444', fontStyle: 'italic' }}>{DISCLAIMER}</div>
        </div>
      )}

      {summary && (
        <div style={{ background: '#111116', borderRadius: 16, padding: 24, border: '1px solid #1e1e26', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>♡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8ec', marginBottom: 16 }}>
            {summary.completed ? 'Session complete' : 'Session ended'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: summary.steadiness !== null ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{ background: '#0d0d14', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Time</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{formatTime(summary.actualDuration)}</div>
            </div>
            <div style={{ background: '#0d0d14', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Breaths</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{summary.breaths}</div>
            </div>
            {summary.steadiness !== null && (
              <div style={{ background: '#0d0d14', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Steadiness</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{summary.steadiness}%</div>
              </div>
            )}
          </div>
          <button onClick={() => setSummary(null)} style={{
            width: '100%', padding: '14px', borderRadius: 12, background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}>Done</button>
          <div style={{ marginTop: 12, fontSize: 10, color: '#444', fontStyle: 'italic' }}>{DISCLAIMER}</div>
        </div>
      )}

      {setupVisible && (
        <div style={{ background: '#111116', borderRadius: 12, padding: 16, marginTop: 20, border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
          <span style={{ color: '#888' }}>
            Breathing at your resonance frequency (~6 breaths/min) maximises heart-rate variability and parasympathetic (vagal) tone. This module guides that breathing; the slow, exhale-weighted pace is the active ingredient.
          </span>
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>Evidence: </span>
            A randomized trial found HRV-biofeedback (guided slow breathing) improved cardiovascular responses to mental stress.{' '}
            <a href="https://doi.org/10.1001/jamanetworkopen.2025.38416" target="_blank" rel="noopener noreferrer" style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>JAMA Netw Open (2025) →</a>
          </div>
          <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            Slow breathing raises HRV and parasympathetic tone.{' '}
            <a href="https://doi.org/10.3389/fnhum.2018.00353" target="_blank" rel="noopener noreferrer" style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>Zaccaro et al. (2018) →</a>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#444', fontStyle: 'italic' }}>
            This pacer guides resonance-frequency breathing. It does not measure your heart rate or HRV.
          </div>
        </div>
      )}
    </div>
  );
}
