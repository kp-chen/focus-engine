import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';

const COLOR = MODULE_COLORS.timer;

const PRESETS = [
  { label: '25 / 5', work: 25, rest: 5, desc: 'Classic Pomodoro' },
  { label: '50 / 10', work: 50, rest: 10, desc: 'Deep work' },
  { label: '90 / 20', work: 90, rest: 20, desc: 'Ultradian cycle' },
];

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function haptic(ms = 40) {
  try { navigator?.vibrate?.(ms); } catch {}
}

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

function CircleTimer({ progress, phase, color, timeStr }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#1a1a22" strokeWidth="4" />
        <circle cx="110" cy="110" r={radius} fill="none"
          stroke={phase === 'work' ? color : '#40c090'}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 110 110)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: '#e8e8ec', letterSpacing: '-0.02em',
        }}>
          {timeStr}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', marginTop: 4,
          color: phase === 'work' ? color : '#40c090',
        }}>
          {phase === 'work' ? 'Focus' : 'Rest'}
        </div>
      </div>
    </div>
  );
}

function FocusRating({ onRate }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{
      background: '#111116', borderRadius: 14, padding: 20,
      border: '1px solid #1e1e26', textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 14 }}>
        How focused were you?
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setSelected(n)} style={{
            width: 44, height: 44, borderRadius: 12,
            border: `1.5px solid ${selected === n ? COLOR + '60' : '#252530'}`,
            background: selected === n ? COLOR + '15' : '#1a1a22',
            color: selected === n ? '#e8e8ec' : '#666',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.15s',
          }}>
            {n}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', padding: '0 4px', marginBottom: 14 }}>
        <span>Distracted</span><span>Deep flow</span>
      </div>
      <button onClick={() => onRate(selected || 3)} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        background: selected ? `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)` : '#1a1a22',
        border: selected ? 'none' : '1px solid #252530',
        color: selected ? '#fff' : '#666', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        boxShadow: selected ? `0 4px 16px ${COLOR}20` : 'none',
      }}>
        {selected ? 'Start Rest' : 'Skip Rating'}
      </button>
    </div>
  );
}

export default function UltradianTimer() {
  const { startSession, endSession } = useCognitive();
  const { isRunning: isFocusRunning } = useAudioEngine();

  const [preset, setPreset] = useState(PRESETS[2]); // Default to 90/20
  const [phase, setPhase] = useState('idle'); // idle | work | rating | rest | done
  const [remaining, setRemaining] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [totalWorkTime, setTotalWorkTime] = useState(0);
  const [ratings, setRatings] = useState([]);

  const timerRef = useRef(null);
  const endTimeRef = useRef(0);
  const phaseRef = useRef('idle');

  const focusRunning = isFocusRunning('focus');

  const tick = useCallback(() => {
    const now = Date.now();
    const rem = Math.max(0, (endTimeRef.current - now) / 1000);
    setRemaining(rem);

    if (rem <= 0) {
      clearInterval(timerRef.current);
      haptic(100);
      chime();

      if (phaseRef.current === 'work') {
        setPhase('rating');
        phaseRef.current = 'rating';
      } else if (phaseRef.current === 'rest') {
        setPhase('idle');
        phaseRef.current = 'idle';
        setCycleCount(c => c + 1);
        endSession({ phase: 'rest', duration: preset.rest * 60 });
      }
    }
  }, [preset, endSession]);

  const startWork = useCallback(() => {
    phaseRef.current = 'work';
    setPhase('work');
    setRemaining(preset.work * 60);
    endTimeRef.current = Date.now() + preset.work * 60 * 1000;
    startSession('timer');
    timerRef.current = setInterval(tick, 250);
  }, [preset, tick, startSession]);

  const handleRating = useCallback((rating) => {
    setRatings(r => [...r, rating]);
    setTotalWorkTime(t => t + preset.work * 60);
    endSession({ phase: 'work', duration: preset.work * 60, focusRating: rating });

    // Start rest phase
    phaseRef.current = 'rest';
    setPhase('rest');
    setRemaining(preset.rest * 60);
    endTimeRef.current = Date.now() + preset.rest * 60 * 1000;
    startSession('timer');
    timerRef.current = setInterval(tick, 250);
  }, [preset, tick, endSession, startSession]);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (phaseRef.current === 'work' || phaseRef.current === 'rest') {
      endSession({ phase: phaseRef.current, aborted: true });
    }
    phaseRef.current = 'idle';
    setPhase('idle');
    setRemaining(0);
  }, [endSession]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const totalDuration = phase === 'work' ? preset.work * 60 : preset.rest * 60;
  const progress = totalDuration > 0 ? 1 - (remaining / totalDuration) : 0;
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Ultradian Timer</h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Work/rest cycles aligned to natural rhythms
        </p>
      </div>

      {/* Preset selector */}
      {phase === 'idle' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Cycle preset
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setPreset(p)} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, textAlign: 'center',
                  border: `1px solid ${preset.label === p.label ? COLOR + '50' : '#1e1e26'}`,
                  background: preset.label === p.label ? COLOR + '10' : '#111116',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: preset.label === p.label ? '#e8e8ec' : '#888', fontFamily: "'JetBrains Mono', monospace" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Focus Engine synergy hint */}
          {focusRunning && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: MODULE_COLORS.focus + '10',
              border: `1px solid ${MODULE_COLORS.focus}25`,
              fontSize: 12, color: '#888', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: MODULE_COLORS.focus }}>◎</span>
              Focus Engine is running — audio will continue during your work blocks
            </div>
          )}

          {/* Session stats */}
          {cycleCount > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20,
            }}>
              <div style={{ background: '#111116', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid #1e1e26' }}>
                <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Cycles</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{cycleCount}</div>
              </div>
              <div style={{ background: '#111116', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid #1e1e26' }}>
                <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Work time</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{Math.round(totalWorkTime / 60)}m</div>
              </div>
              <div style={{ background: '#111116', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid #1e1e26' }}>
                <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Avg focus</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLOR }}>{avgRating}</div>
              </div>
            </div>
          )}

          <button onClick={startWork} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            border: 'none', color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 24px ${COLOR}30`,
          }}>
            Start {preset.work}-Min Work Block
          </button>
        </>
      )}

      {/* Timer display */}
      {(phase === 'work' || phase === 'rest') && (
        <div style={{
          background: '#111116', borderRadius: 16, padding: 24,
          border: '1px solid #1e1e26',
          boxShadow: `0 0 60px ${phase === 'work' ? COLOR : '#40c090'}08`,
        }}>
          <CircleTimer
            progress={progress}
            phase={phase}
            color={COLOR}
            timeStr={formatTime(remaining)}
          />

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 13, color: '#666' }}>
              {phase === 'work'
                ? `Focus block ${cycleCount + 1} · ${preset.work} min`
                : `Rest · ${preset.rest} min`
              }
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <button onClick={stopTimer} style={{
              padding: '10px 32px', borderRadius: 10,
              background: '#1a1a22', border: '1px solid #252530',
              color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Focus rating */}
      {phase === 'rating' && (
        <FocusRating onRate={handleRating} />
      )}

      {/* Science card */}
      {phase === 'idle' && (
        <div style={{
          background: '#111116', borderRadius: 12, padding: 16, marginTop: 20,
          border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
          <span style={{ color: '#888' }}>
            Humans cycle through ~90-minute periods of higher and lower alertness (Basic Rest-Activity Cycle). Aligning work blocks with these ultradian rhythms, followed by deliberate rest, may sustain cognitive performance better than pushing through fatigue.
          </span>
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>Evidence: </span>
            Kleitman's BRAC model (1963). Focus ratings over time help you discover your personal optimal cycle length.{' '}
            <a href="https://pubmed.ncbi.nlm.nih.gov/14078944/" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>
              Kleitman (1963) →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
