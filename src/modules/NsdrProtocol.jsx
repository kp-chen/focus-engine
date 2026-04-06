import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';

const COLOR = MODULE_COLORS.nsdr;

const DURATIONS = [
  { label: '10 min', value: 600 },
  { label: '20 min', value: 1200 },
  { label: '30 min', value: 1800 },
];

// Body scan script segments — generic, no personal context
const BODY_SCAN_SCRIPT = [
  { text: "Find a comfortable position, lying down or reclined. Allow your eyes to close gently.", pause: 6 },
  { text: "Take a deep breath in through your nose. And slowly exhale through your mouth.", pause: 8 },
  { text: "Again, breathe in deeply. Feel your chest and belly expand. And exhale completely, releasing all tension.", pause: 8 },
  { text: "Bring your awareness to the top of your head. Notice any sensations there. Simply observe without judgment.", pause: 7 },
  { text: "Now move your attention to your forehead. Feel it soften and relax. Let go of any tension you find.", pause: 6 },
  { text: "Allow the relaxation to flow down to your eyes. Feel the muscles around your eyes become heavy and still.", pause: 6 },
  { text: "Bring your awareness to your jaw. Let it drop slightly, creating space between your teeth. Release all holding.", pause: 6 },
  { text: "Now notice your neck and throat. Allow them to soften completely.", pause: 5 },
  { text: "Move your attention to your shoulders. With each exhale, feel them drop further away from your ears.", pause: 7 },
  { text: "Bring awareness to your right arm. From shoulder to elbow, elbow to wrist, wrist to fingertips. Feel it grow heavy.", pause: 8 },
  { text: "Now your left arm. Shoulder, elbow, wrist, fingertips. Let it rest completely.", pause: 7 },
  { text: "Bring your attention to your chest. Feel the gentle rise and fall of your breath. No need to change it.", pause: 7 },
  { text: "Move awareness to your belly. Let it be soft. Release any holding or bracing.", pause: 6 },
  { text: "Now notice your lower back. Let the surface beneath you fully support your weight.", pause: 6 },
  { text: "Bring attention to your hips and pelvis. Allow them to feel heavy and grounded.", pause: 6 },
  { text: "Move your awareness down your right leg. Thigh, knee, shin, ankle, foot. Let it completely relax.", pause: 7 },
  { text: "And your left leg. Thigh, knee, shin, ankle, foot. Feel the weight of your body sinking down.", pause: 7 },
  { text: "Now expand your awareness to your whole body at once. You are fully supported. Fully at rest.", pause: 8 },
  { text: "Stay in this state of deep rest. Your body is restoring. Your mind is quiet.", pause: 10 },
  { text: "When you are ready, begin to deepen your breath. Gently wiggle your fingers and toes.", pause: 8 },
  { text: "Take a full, deep breath in. And open your eyes when you feel ready. Welcome back.", pause: 5 },
];

function speak(text, rate = 0.8) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = 0.9;
    u.volume = 0.9;
    // Try to pick a calm-sounding voice
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Google UK English Female'));
    if (preferred) u.voice = preferred;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Breathing ring animation
function RestCircle({ progress, isActive }) {
  const breathPhase = isActive ? (Date.now() / 4000) % 1 : 0;
  const breathScale = isActive ? 0.92 + Math.sin(breathPhase * Math.PI * 2) * 0.08 : 0.85;

  return (
    <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="90" fill="none" stroke="#1e1e26" strokeWidth="2" />
        {isActive && (
          <circle cx="100" cy="100" r="90" fill="none" stroke={COLOR} strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 90}`}
            strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress)}`}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 120, height: 120, marginTop: -60, marginLeft: -60,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${COLOR}18, ${COLOR}06)`,
        border: `1px solid ${COLOR}25`,
        transform: `scale(${breathScale})`,
        transition: 'transform 0.5s ease-in-out',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#ccc' : '#555', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {isActive ? 'Resting' : 'Ready'}
        </div>
      </div>
    </div>
  );
}

export default function NsdrProtocol() {
  const { startSession, endSession } = useCognitive();
  const { startNsdr, stopEngine, isRunning } = useAudioEngine();

  const [duration, setDuration] = useState(600);
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(-1);
  const [currentText, setCurrentText] = useState('');
  const [ambientOn, setAmbientOn] = useState(true);

  const activeRef = useRef(false);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);

  const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;

  const runSession = useCallback(async () => {
    activeRef.current = true;
    startTimeRef.current = Date.now();
    setIsActive(true);
    setElapsed(0);
    setCurrentSegment(0);
    startSession('nsdr');

    if (ambientOn) {
      startNsdr({ volume: 0.35 });
    }

    // Timer
    timerRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(el);
      if (el >= duration) {
        stopSessionClean();
      }
    }, 1000);

    // Wait for voices to load
    await new Promise(r => {
      if (speechSynthesis.getVoices().length > 0) r();
      else speechSynthesis.onvoiceschanged = r;
      setTimeout(r, 500); // fallback
    });

    // Calculate how many script segments to use based on duration
    const segmentsToUse = duration <= 600
      ? BODY_SCAN_SCRIPT
      : BODY_SCAN_SCRIPT.concat(
          // Repeat the deep rest segment for longer sessions
          Array.from({ length: Math.floor((duration - 600) / 30) }, () => ({
            text: "Continue to rest deeply. Let each breath carry you further into stillness.",
            pause: 12,
          }))
        );

    // Scale pauses to fit duration
    const totalScriptTime = segmentsToUse.reduce((s, seg) => s + seg.text.length * 0.06 + seg.pause, 0);
    const scale = Math.max(1, (duration * 0.8) / totalScriptTime);

    for (let i = 0; i < segmentsToUse.length; i++) {
      if (!activeRef.current) break;
      const seg = segmentsToUse[i];
      setCurrentSegment(i);
      setCurrentText(seg.text);

      await speak(seg.text, 0.78);

      if (!activeRef.current) break;

      // Pause between segments
      await new Promise(r => setTimeout(r, seg.pause * 1000 * scale));
    }

    if (activeRef.current) {
      stopSessionClean();
    }
  }, [duration, ambientOn, startSession, startNsdr]);

  const stopSessionClean = useCallback(() => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    speechSynthesis.cancel();
    stopEngine('nsdr');
    setIsActive(false);
    setCurrentText('');
    setCurrentSegment(-1);
    endSession({ duration: elapsed, ambientOn });
  }, [stopEngine, endSession, elapsed, ambientOn]);

  const toggle = useCallback(() => {
    isActive ? stopSessionClean() : runSession();
  }, [isActive, stopSessionClean, runSession]);

  // Cleanup
  useEffect(() => () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    speechSynthesis.cancel();
  }, []);

  const remaining = Math.max(0, duration - elapsed);

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          NSDR Protocol
        </h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Non-sleep deep rest · guided body scan
        </p>
      </div>

      {/* Duration selector */}
      {!isActive && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
            Duration
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                border: `1px solid ${duration === d.value ? COLOR + '50' : '#1e1e26'}`,
                background: duration === d.value ? COLOR + '10' : '#111116',
                color: duration === d.value ? '#e8e8ec' : '#555',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ambient toggle */}
      {!isActive && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 12,
          background: '#111116', border: '1px solid #1e1e26',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>Ambient soundscape</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Gentle drone + brown noise backdrop</div>
          </div>
          <button onClick={() => setAmbientOn(!ambientOn)} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            background: ambientOn ? COLOR : '#252530',
            cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', position: 'absolute',
              top: 3, left: ambientOn ? 23 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      )}

      {/* Rest circle */}
      <div style={{
        background: '#111116', borderRadius: 16, padding: '24px 20px',
        border: '1px solid #1e1e26', marginBottom: 20,
        boxShadow: isActive ? `0 0 80px ${COLOR}08` : 'none',
      }}>
        <RestCircle progress={progress} isActive={isActive} />

        {/* Current instruction */}
        {isActive && currentText && (
          <div style={{
            textAlign: 'center', marginTop: 20,
            fontSize: 14, color: '#999', lineHeight: 1.6,
            fontStyle: 'italic', padding: '0 16px',
            minHeight: 50,
          }}>
            "{currentText}"
          </div>
        )}

        {/* Timer row */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          marginTop: 20, padding: '12px 0', borderTop: '1px solid #1e1e26',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Elapsed</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>
              {formatTime(elapsed)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: isActive ? COLOR : '#888' }}>
              {formatTime(remaining)}
            </div>
          </div>
        </div>

        {/* Play/Stop */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button onClick={toggle} style={{
            width: isActive ? 140 : 180, padding: '14px 0', borderRadius: 14,
            border: 'none',
            background: isActive ? '#222' : `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isActive ? 'none' : `0 4px 24px ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>{isActive ? '▪' : '▶'}</span>
            {isActive ? 'End Session' : 'Begin NSDR'}
          </button>
        </div>

        {isActive && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>
            Audio persists when you switch tabs
          </div>
        )}
      </div>

      {/* Science card */}
      {!isActive && (
        <div style={{
          background: '#111116', borderRadius: 12, padding: 16,
          border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
          <span style={{ color: '#888' }}>
            NSDR uses guided body scanning and breathing to shift brainwave activity from beta (alert) through alpha into theta (deep rest) without falling asleep. This activates parasympathetic recovery and has been shown to increase striatal dopamine.
          </span>
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>Evidence: </span>
            10-min NSDR improved reaction time, cognitive accuracy, and emotional balance vs passive rest (n=65 RCT).{' '}
            <a href="https://doi.org/10.1111/aphw.12571" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>
              Boukhris et al. (2024) →
            </a>
          </div>
          <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            Yoga nidra increased striatal dopamine by ~65% in a PET imaging study.{' '}
            <a href="https://doi.org/10.1089/acm.2002.8.357" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>
              Kjaer et al. (2002) →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
