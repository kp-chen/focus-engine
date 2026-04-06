import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { MODULE_COLORS } from '../theme';

// Breathing patterns: each phase has { label, duration (ms), action: 'inhale'|'exhale'|'hold' }
const PATTERNS = {
  cyclic: {
    id: 'cyclic',
    label: 'Cyclic Sighing',
    desc: 'Double inhale through nose, long exhale through mouth',
    science: 'Balban et al. (2023), Cell Reports Medicine — superior to mindfulness meditation for mood and anxiety reduction over 28 days (n=108 RCT)',
    phases: [
      { label: 'Inhale', duration: 2500, action: 'inhale' },
      { label: 'Inhale', duration: 1500, action: 'inhale' },
      { label: 'Exhale', duration: 6000, action: 'exhale' },
    ],
  },
  box: {
    id: 'box',
    label: 'Box Breathing',
    desc: 'Equal inhale, hold, exhale, hold — used by Navy SEALs',
    science: 'Ma et al. (2017), Frontiers in Psychology — diaphragmatic breathing reduces cortisol and improves sustained attention. US military adoption based on autonomic downregulation evidence.',
    phases: [
      { label: 'Inhale', duration: 4000, action: 'inhale' },
      { label: 'Hold', duration: 4000, action: 'hold' },
      { label: 'Exhale', duration: 4000, action: 'exhale' },
      { label: 'Hold', duration: 4000, action: 'hold' },
    ],
  },
  relaxing: {
    id: 'relaxing',
    label: '4-7-8 Relaxing',
    desc: 'Extended exhale activates parasympathetic response',
    science: 'Weil (2015) — based on pranayama tradition. Extended exhalation increases vagal tone and shifts autonomic balance toward rest-and-digest.',
    phases: [
      { label: 'Inhale', duration: 4000, action: 'inhale' },
      { label: 'Hold', duration: 7000, action: 'hold' },
      { label: 'Exhale', duration: 8000, action: 'exhale' },
    ],
  },
};

const PATTERN_LIST = Object.values(PATTERNS);

const DURATIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

function haptic(ms = 30) {
  try { navigator?.vibrate?.(ms); } catch {}
}

// Animated breathing circle component
function BreathCircle({ phase, progress, action, color, isActive }) {
  // Scale: inhale expands, exhale contracts, hold stays
  const baseSize = 0.45;
  const maxSize = 1.0;

  let scale;
  if (!isActive) {
    scale = baseSize;
  } else if (action === 'inhale') {
    scale = baseSize + (maxSize - baseSize) * progress;
  } else if (action === 'exhale') {
    scale = maxSize - (maxSize - baseSize) * progress;
  } else {
    // hold — maintain current size with subtle pulse
    scale = phase?.label === 'Hold' && phase === PATTERNS.box.phases[1]
      ? maxSize + Math.sin(progress * Math.PI * 2) * 0.02
      : (action === 'hold' ? (progress < 0.01 ? maxSize : baseSize + (maxSize - baseSize) * (1 - progress * 0.02)) : maxSize);
    // Simplify: hold after inhale = big, hold after exhale = small
    scale = maxSize + Math.sin(progress * Math.PI * 4) * 0.015;
  }

  return (
    <div style={{
      position: 'relative',
      width: 220,
      height: 220,
      margin: '0 auto',
    }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute',
        inset: -20,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        transform: `scale(${scale})`,
        transition: isActive ? 'none' : 'transform 0.8s ease',
      }} />

      {/* Ring track */}
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx="110" cy="110" r="100" fill="none" stroke="#1e1e26" strokeWidth="2" />
        {isActive && (
          <circle
            cx="110" cy="110" r="100"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 100}`}
            strokeDashoffset={`${2 * Math.PI * 100 * (1 - progress)}`}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        )}
      </svg>

      {/* Inner circle */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 140,
        height: 140,
        marginTop: -70,
        marginLeft: -70,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${color}20, ${color}08)`,
        border: `1.5px solid ${color}30`,
        transform: `scale(${scale})`,
        transition: isActive ? 'transform 0.15s ease-out' : 'transform 0.8s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: isActive ? '#e8e8ec' : '#555',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {isActive ? (phase?.label || 'Ready') : 'Ready'}
        </div>
      </div>
    </div>
  );
}

// Phase indicator dots
function PhaseIndicator({ phases, currentIndex, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
      {phases.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i === currentIndex ? color : '#2a2a36',
            transition: 'background 0.3s',
            boxShadow: i === currentIndex ? `0 0 8px ${color}60` : 'none',
          }} />
          <span style={{
            fontSize: 10,
            color: i === currentIndex ? '#888' : '#444',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'color 0.3s',
          }}>
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function BreathworkStudio() {
  const { startSession, endSession } = useCognitive();
  const color = MODULE_COLORS.breathe;

  const [patternId, setPatternId] = useState('cyclic');
  const [targetDuration, setTargetDuration] = useState(300);
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  const pattern = PATTERNS[patternId];
  const currentPhase = pattern.phases[currentPhaseIndex];

  const rafRef = useRef(null);
  const phaseStartRef = useRef(0);
  const sessionStartRef = useRef(0);
  const phaseIndexRef = useRef(0);
  const cycleRef = useRef(0);
  const activeRef = useRef(false);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    const now = Date.now();
    const totalElapsed = (now - sessionStartRef.current) / 1000;
    setElapsed(totalElapsed);

    // Check if session complete
    if (totalElapsed >= targetDuration) {
      stopSession();
      return;
    }

    const pat = PATTERNS[patternId];
    const phaseElapsed = now - phaseStartRef.current;
    const phaseDuration = pat.phases[phaseIndexRef.current].duration;
    const progress = Math.min(phaseElapsed / phaseDuration, 1);
    setPhaseProgress(progress);

    if (phaseElapsed >= phaseDuration) {
      // Advance to next phase
      let nextIndex = phaseIndexRef.current + 1;
      if (nextIndex >= pat.phases.length) {
        nextIndex = 0;
        cycleRef.current += 1;
        setCycleCount(cycleRef.current);
      }
      phaseIndexRef.current = nextIndex;
      phaseStartRef.current = now;
      setCurrentPhaseIndex(nextIndex);
      haptic(nextIndex === 0 ? 60 : 20);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [patternId, targetDuration]);

  const startBreathing = useCallback(() => {
    activeRef.current = true;
    sessionStartRef.current = Date.now();
    phaseStartRef.current = Date.now();
    phaseIndexRef.current = 0;
    cycleRef.current = 0;
    setIsActive(true);
    setElapsed(0);
    setCurrentPhaseIndex(0);
    setPhaseProgress(0);
    setCycleCount(0);
    startSession('breathe');
    haptic(50);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, startSession]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (isActive || activeRef.current) {
      endSession({
        pattern: patternId,
        cycles: cycleRef.current,
        targetDuration,
        actualDuration: elapsed,
      });
    }
    setIsActive(false);
  }, [endSession, patternId, targetDuration, elapsed, isActive]);

  const toggle = useCallback(() => {
    isActive ? stopSession() : startBreathing();
  }, [isActive, stopSession, startBreathing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Reset state when pattern changes while not active
  useEffect(() => {
    if (!isActive) {
      setCurrentPhaseIndex(0);
      setPhaseProgress(0);
      setCycleCount(0);
      setElapsed(0);
    }
  }, [patternId]);

  const remaining = Math.max(0, targetDuration - elapsed);

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${color}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Breathwork Studio
        </h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Guided breathing for autonomic regulation
        </p>
      </div>

      {/* Pattern selector */}
      {!isActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {PATTERN_LIST.map(p => (
            <button key={p.id} onClick={() => setPatternId(p.id)} style={{
              padding: '12px 16px', borderRadius: 12, textAlign: 'left',
              border: `1px solid ${patternId === p.id ? color + '50' : '#1e1e26'}`,
              background: patternId === p.id ? color + '08' : '#111116',
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: patternId === p.id ? '#e8e8ec' : '#888',
                }}>
                  {p.label}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  color: patternId === p.id ? color : '#444',
                }}>
                  {p.phases.map(ph => ph.duration / 1000).join('-')}s
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.4 }}>
                {p.desc}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Duration selector */}
      {!isActive && (
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 11, fontWeight: 600, color: '#555',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'block', marginBottom: 8,
          }}>
            Duration
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setTargetDuration(d.value)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                border: `1px solid ${targetDuration === d.value ? color + '50' : '#1e1e26'}`,
                background: targetDuration === d.value ? color + '10' : '#111116',
                color: targetDuration === d.value ? '#e8e8ec' : '#555',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breathing circle */}
      <div style={{
        background: '#111116', borderRadius: 16, padding: '28px 20px 20px',
        border: '1px solid #1e1e26', marginBottom: 20,
        boxShadow: isActive ? `0 0 80px ${color}08` : 'none',
      }}>
        <BreathCircle
          phase={currentPhase}
          progress={phaseProgress}
          action={currentPhase?.action}
          color={color}
          isActive={isActive}
        />

        <PhaseIndicator
          phases={pattern.phases}
          currentIndex={isActive ? currentPhaseIndex : -1}
          color={color}
        />

        {/* Timer + stats row */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          marginTop: 20, padding: '12px 0',
          borderTop: '1px solid #1e1e26',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Elapsed</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>
              {formatTime(elapsed)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: isActive ? color : '#888' }}>
              {formatTime(remaining)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cycles</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>
              {cycleCount}
            </div>
          </div>
        </div>

        {/* Play/Stop button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button onClick={toggle} style={{
            width: isActive ? 140 : 160,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: isActive
              ? '#222'
              : `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isActive ? 'none' : `0 4px 24px ${color}30`,
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>{isActive ? '▪' : '▶'}</span>
            {isActive ? 'Stop' : 'Start Breathing'}
          </button>
        </div>
      </div>

      {/* Science card */}
      <div style={{
        background: '#111116', borderRadius: 12, padding: 16,
        border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
        <span style={{ color: '#888' }}>{pattern.desc}.</span>{' '}
        {pattern.id === 'cyclic' && (
          <>Extended exhalation activates the parasympathetic nervous system via vagal efferents. The double inhale maximally inflates lung alveoli, optimising CO₂ offloading on the long exhale.</>
        )}
        {pattern.id === 'box' && (
          <>Equal-phase breathing stabilises autonomic balance. The breath holds build CO₂ tolerance and train interoceptive awareness — the ability to sense internal bodily states.</>
        )}
        {pattern.id === 'relaxing' && (
          <>The 1:1.75:2 ratio strongly biases the autonomic nervous system toward parasympathetic dominance. Extended exhalation lengthens the cardiac vagal response, reducing heart rate and promoting calm.</>
        )}
        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11, color: '#555' }}>
          <span style={{ color: color, fontWeight: 600 }}>Evidence:</span>{' '}{pattern.science}
        </div>
      </div>
    </div>
  );
}
