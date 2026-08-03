import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { getAudioContext } from '../lib/audioContext';
import { useReducedMotion } from '../lib/useReducedMotion';
import { MODULE_COLORS } from '../theme';

const COLOR = '#d4537e'; // pink from our palette — calming but distinct

const MODES = [
  { id: 'auditory', label: 'Audio', icon: '♫', desc: 'Alternating left/right tones' },
  { id: 'visual', label: 'Visual', icon: '●', desc: 'Tracking dot moves side to side' },
  { id: 'both', label: 'Both', icon: '◉', desc: 'Audio + visual combined' },
];

const SPEEDS = [
  { label: 'Slow', value: 1.6, bpm: '~38 BPM' },
  { label: 'Medium', value: 1.0, bpm: '~60 BPM' },
  { label: 'Fast', value: 0.6, bpm: '~100 BPM' },
];

const DURATIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

const TONES = [
  { label: 'Soft', freq: 396, type: 'sine' },
  { label: 'Mid', freq: 528, type: 'sine' },
  { label: 'Bright', freq: 639, type: 'triangle' },
];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function haptic(ms = 15) {
  try { navigator?.vibrate?.(ms); } catch {}
}

// Audio engine for bilateral tones. Uses the shared AudioContext; teardown stops
// the oscillator and disconnects the envelope rather than closing the context.
function createBilateralEngine(freq, type) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.value = 0.35;

  const panner = ctx.createStereoPanner();
  panner.pan.value = -1; // start left

  // Gentle envelope to avoid clicks
  const envelope = ctx.createGain();
  envelope.gain.value = 0;

  osc.connect(gain).connect(panner).connect(envelope).connect(ctx.destination);
  osc.start();

  return { ctx, osc, gain, panner, envelope };
}

// Visual tracking dot
function TrackingDot({ position, isActive, color, reduced }) {
  // position: 0 = left, 1 = right. Under reduced motion the dot is pinned to the
  // centre and does not slide — the L/R pan indicator and (in audio modes) the
  // alternating tone carry the rhythm without the side-to-side eye movement.
  const x = reduced ? 50 : 10 + position * 80; // percentage

  return (
    <div style={{
      position: 'relative',
      height: 60,
      borderRadius: 12,
      background: '#0d0d14',
      overflow: 'hidden',
    }}>
      {/* Track line */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '10%', right: '10%',
        height: 2, marginTop: -1,
        background: '#1e1e26',
        borderRadius: 1,
      }} />

      {/* Track endpoints */}
      <div style={{
        position: 'absolute', top: '50%', left: '10%',
        width: 6, height: 6, marginTop: -3, marginLeft: -3,
        borderRadius: '50%', background: '#252530',
      }} />
      <div style={{
        position: 'absolute', top: '50%', right: '10%',
        width: 6, height: 6, marginTop: -3, marginRight: -3,
        borderRadius: '50%', background: '#252530',
      }} />

      {/* Moving dot */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${x}%`,
        width: isActive ? 18 : 12,
        height: isActive ? 18 : 12,
        marginTop: isActive ? -9 : -6,
        marginLeft: isActive ? -9 : -6,
        borderRadius: '50%',
        background: isActive ? color : '#333',
        boxShadow: isActive ? `0 0 16px ${color}60, 0 0 32px ${color}20` : 'none',
        transition: reduced
          ? 'width 0.3s, height 0.3s, background 0.3s'
          : `left ${isActive ? '0.08s' : '0.5s'} linear, width 0.3s, height 0.3s, background 0.3s`,
      }} />
    </div>
  );
}

// Side indicator for current pan direction
function PanIndicator({ side, isActive }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '0 12px',
      fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{
        color: isActive && side === 'left' ? COLOR : '#333',
        fontWeight: isActive && side === 'left' ? 600 : 400,
        transition: 'color 0.15s',
      }}>L</span>
      <span style={{
        color: isActive && side === 'right' ? COLOR : '#333',
        fontWeight: isActive && side === 'right' ? 600 : 400,
        transition: 'color 0.15s',
      }}>R</span>
    </div>
  );
}

export default function BilateralStimulation() {
  const { startSession, endSession } = useCognitive();
  const reduced = useReducedMotion();

  const [mode, setMode] = useState(MODES[2]); // default: both
  const [speed, setSpeed] = useState(SPEEDS[1]); // default: medium
  const [duration, setDuration] = useState(300); // default: 5 min
  const [tone, setTone] = useState(TONES[0]); // default: soft
  const [volume, setVolume] = useState(0.35);
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dotPosition, setDotPosition] = useState(0); // 0-1
  const [panSide, setPanSide] = useState('left');
  const [cycleCount, setCycleCount] = useState(0);

  const engineRef = useRef(null);
  const timerRef = useRef(null);
  const animRef = useRef(null);
  const startTimeRef = useRef(0);
  const activeRef = useRef(false);
  // Live mirrors of the two values that change during a session. stopAll() is
  // captured by the rAF / interval closures at click time (see start()), so
  // reading `isActive`, `elapsed` or `cycleCount` from React state inside it
  // would see their click-time values on the natural-completion path — the
  // session was dropped entirely, and would have logged 0s / 0 cycles.
  const elapsedRef = useRef(0);
  const cyclesRef = useRef(0);

  const useAudio = mode.id === 'auditory' || mode.id === 'both';
  const useVisual = mode.id === 'visual' || mode.id === 'both';

  const stopAll = useCallback(() => {
    // Snapshot the live session state from refs BEFORE tearing anything down.
    const wasActive = activeRef.current;
    const finalElapsed = elapsedRef.current;
    const finalCycles = cyclesRef.current;

    activeRef.current = false;
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);

    if (engineRef.current) {
      const { osc, envelope } = engineRef.current;
      envelope.gain.value = 0;
      try { osc.stop(); } catch {}
      try { envelope.disconnect(); } catch {} // sever from the shared destination
      engineRef.current = null;
    }

    if (wasActive) {
      endSession({ mode: mode.id, speed: speed.value, elapsed: finalElapsed, cycles: finalCycles, tone: tone.label });
    }

    setIsActive(false);
    setDotPosition(0);
    setPanSide('left');
    // Deliberately depends only on values that are fixed for a session. Keeping
    // isActive/elapsed/cycleCount out means the closure the rAF and interval
    // captured stays correct for the whole run.
  }, [endSession, mode.id, speed.value, tone.label]);

  const start = useCallback(() => {
    stopAll();
    activeRef.current = true;
    startTimeRef.current = Date.now();
    setIsActive(true);
    setElapsed(0);
    elapsedRef.current = 0;
    setCycleCount(0);
    cyclesRef.current = 0;
    startSession('bilateral');

    // Create audio engine if needed
    let engine = null;
    if (useAudio) {
      engine = createBilateralEngine(tone.freq, tone.type);
      engine.gain.gain.value = volume;
      engine.envelope.gain.value = 1;
      engineRef.current = engine;
    }

    // Animation loop
    let cycles = 0;
    const animate = () => {
      if (!activeRef.current) return;
      const now = Date.now();
      const totalElapsed = (now - startTimeRef.current) / 1000;

      // Check duration
      if (totalElapsed >= duration) {
        stopAll();
        return;
      }

      elapsedRef.current = Math.floor(totalElapsed);
      setElapsed(elapsedRef.current);

      // Calculate position in cycle (0 → 1 → 0 → 1...)
      const cycleTime = speed.value; // seconds per full L→R sweep
      const t = (totalElapsed % (cycleTime * 2)) / (cycleTime * 2); // 0-1 for full L→R→L
      const pos = t < 0.5 ? t * 2 : 2 - t * 2; // triangle wave 0→1→0

      // Count cycles
      const newCycles = Math.floor(totalElapsed / cycleTime);
      if (newCycles > cycles) {
        cycles = newCycles;
        cyclesRef.current = cycles;
        setCycleCount(cycles);
        // Haptic on each side change
        if (useVisual) haptic(10);
      }

      // Update visual
      if (useVisual) {
        setDotPosition(pos);
      }

      // Update audio panning
      if (engine) {
        const panValue = (pos * 2) - 1; // -1 to 1
        engine.panner.pan.value = panValue;

        // Gentle volume pulse at extremes for tactile feel
        const edgeFactor = 1 - Math.abs(Math.abs(panValue) - 1) * 0.3;
        engine.gain.gain.value = volume * edgeFactor;
      }

      setPanSide(pos < 0.5 ? 'left' : 'right');
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - startTimeRef.current) / 1000);
      elapsedRef.current = el;
      setElapsed(el);
      if (el >= duration) stopAll();
    }, 1000);
  }, [useAudio, useVisual, tone, volume, speed, duration, stopAll, startSession]);

  // Live volume update
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gain.gain.value = volume;
    }
  }, [volume]);

  // Cleanup — stop the note and disconnect, but leave the shared context open.
  useEffect(() => () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    if (engineRef.current) {
      try { engineRef.current.osc.stop(); } catch {}
      try { engineRef.current.envelope.disconnect(); } catch {}
    }
  }, []);

  const remaining = Math.max(0, duration - elapsed);
  const progress = duration > 0 ? elapsed / duration : 0;

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Bilateral Stimulation</h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          EMDR-inspired alternating stimulation
        </p>
      </div>

      {/* Setup */}
      {!isActive && (
        <>
          {/* Mode */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m)}
                  aria-label={`${m.label} mode`} aria-pressed={mode.id === m.id} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, textAlign: 'center',
                  border: `1px solid ${mode.id === m.id ? COLOR + '50' : '#1e1e26'}`,
                  background: mode.id === m.id ? COLOR + '10' : '#111116',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4, color: mode.id === m.id ? COLOR : '#555' }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: mode.id === m.id ? '#e8e8ec' : '#666' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Speed</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SPEEDS.map(s => (
                <button key={s.label} onClick={() => setSpeed(s)}
                  aria-label={`${s.label} speed`} aria-pressed={speed.label === s.label} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                  border: `1px solid ${speed.label === s.label ? COLOR + '50' : '#1e1e26'}`,
                  background: speed.label === s.label ? COLOR + '10' : '#111116',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: speed.label === s.label ? '#e8e8ec' : '#666' }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{s.bpm}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone (only if audio mode) */}
          {(mode.id === 'auditory' || mode.id === 'both') && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Tone</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TONES.map(t => (
                  <button key={t.label} onClick={() => setTone(t)}
                    aria-label={`${t.label} tone`} aria-pressed={tone.label === t.label} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    border: `1px solid ${tone.label === t.label ? COLOR + '50' : '#1e1e26'}`,
                    background: tone.label === t.label ? COLOR + '10' : '#111116',
                    color: tone.label === t.label ? '#e8e8ec' : '#555',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  }}>{t.label} <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", opacity: 0.6 }}>{t.freq}Hz</span></button>
                ))}
              </div>
            </div>
          )}

          {/* Duration */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Duration</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1px solid ${duration === d.value ? COLOR + '50' : '#1e1e26'}`,
                  background: duration === d.value ? COLOR + '10' : '#111116',
                  color: duration === d.value ? '#e8e8ec' : '#555',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* Volume (audio modes) */}
          {(mode.id === 'auditory' || mode.id === 'both') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Volume</span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#666' }}>{Math.round(volume * 100)}%</span>
              </div>
              <input type="range" min="0.05" max="0.6" step="0.05" value={volume} onChange={e => setVolume(+e.target.value)}
                style={{ width: '100%', accentColor: COLOR }} />
            </div>
          )}

          <button onClick={start} aria-label="Begin bilateral stimulation" style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            border: 'none', color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 24px ${COLOR}30`,
          }}>Begin Stimulation</button>
        </>
      )}

      {/* Active session */}
      {isActive && (
        <div style={{
          background: '#111116', borderRadius: 16, padding: 24,
          border: '1px solid #1e1e26',
          boxShadow: `0 0 60px ${COLOR}08`,
        }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 3, borderRadius: 2, background: '#1a1a22' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: COLOR,
                width: `${progress * 100}%`, transition: 'width 1s linear',
              }} />
            </div>
          </div>

          {/* Visual tracking (if enabled) */}
          {useVisual && (
            <div style={{ marginBottom: 16 }}>
              <TrackingDot position={dotPosition} isActive={true} color={COLOR} reduced={reduced} />
            </div>
          )}

          {/* Pan indicator */}
          <PanIndicator side={panSide} isActive={isActive} />

          {/* Stats row */}
          <div style={{
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            marginTop: 20, padding: '16px 0', borderTop: '1px solid #1e1e26',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Elapsed</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{formatTime(elapsed)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Remaining</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: COLOR }}>{formatTime(remaining)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cycles</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{cycleCount}</div>
            </div>
          </div>

          {/* Guidance text */}
          <div style={{
            textAlign: 'center', padding: '14px 16px', marginTop: 12,
            background: '#0d0d14', borderRadius: 10,
            fontSize: 13, color: '#777', lineHeight: 1.5, fontStyle: 'italic',
          }}>
            {useVisual && !reduced
              ? 'Follow the dot with your eyes while letting your mind process freely'
              : useAudio
                ? 'Close your eyes and notice the tone alternating between ears'
                : 'Let your gaze track the L / R indicator below while your mind processes freely'}
          </div>

          {/* Volume slider during session */}
          {useAudio && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Volume</span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#666' }}>{Math.round(volume * 100)}%</span>
              </div>
              <input type="range" min="0.05" max="0.6" step="0.05" value={volume} onChange={e => setVolume(+e.target.value)}
                style={{ width: '100%', accentColor: COLOR }} />
            </div>
          )}

          {/* Stop */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <button onClick={stopAll} aria-label="End bilateral stimulation session" style={{
              padding: '12px 40px', borderRadius: 12,
              background: '#1a1a22', border: '1px solid #252530',
              color: '#888', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>End Session</button>
          </div>
        </div>
      )}

      {/* Science card */}
      {!isActive && (
        <div style={{
          background: '#111116', borderRadius: 12, padding: 16, marginTop: 20,
          border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
          <span style={{ color: '#888' }}>
            Bilateral stimulation alternates sensory input between left and right hemispheres. In EMDR therapy, this is used alongside guided recall to help reprocess distressing memories. The standalone stimulation may help reduce physiological arousal and promote a calm, present state.
          </span>
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>Evidence: </span>
            EMDR is a WHO-recommended treatment for PTSD, and a meta-analysis found its bilateral eye-movement component has a significant additive effect on processing distressing memories (d ≈ 0.41 in therapy and 0.74 in lab studies).{' '}
            <a href="https://doi.org/10.1016/j.jbtep.2012.11.001" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>
              Lee & Cuijpers (2013) →
            </a>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#555', fontStyle: 'italic' }}>
            Evidence for standalone bilateral stimulation, outside full EMDR therapy, remains limited.
          </div>
        </div>
      )}
    </div>
  );
}
