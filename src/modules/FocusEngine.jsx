import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';

const MODES = [
  { id: 'focus', label: 'Focus', icon: '◎', freq: 16, desc: 'Beta-range AM for deep work' },
  { id: 'relax', label: 'Relax', icon: '◠', freq: 10, desc: 'Alpha-range for calm alertness' },
  { id: 'sleep', label: 'Sleep', icon: '◡', freq: 4, desc: 'Theta-range for wind-down' },
];

const TEXTURES = [
  { id: 'warmpad', label: 'Warm Pad' },
  { id: 'rain', label: 'Rain' },
  { id: 'brown', label: 'Brown Noise' },
  { id: 'binaural', label: 'Drone' },
];

function Visualizer({ analyser, isPlaying, color }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    c.scale(dpr, dpr);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const draw = () => {
      c.clearRect(0, 0, w, h);
      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bars = 48;
        const barW = w / bars;
        for (let i = 0; i < bars; i++) {
          const val = data[Math.floor((i / bars) * data.length)] / 255;
          const barH = val * h * 0.85;
          c.fillStyle = color + Math.floor(40 + val * 60).toString(16).padStart(2, '0');
          c.beginPath();
          c.roundRect(i * barW + 1, h - barH, barW - 2, barH, 3);
          c.fill();
        }
      } else {
        c.strokeStyle = color + '30';
        c.lineWidth = 1.5;
        c.beginPath();
        for (let x = 0; x < w; x++) {
          const y = h / 2 + Math.sin(x * 0.02 + Date.now() * 0.001) * 8;
          x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPlaying, color]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function FocusEngine() {
  const { startSession, endSession } = useCognitive();
  const { startFocus, stopEngine, isRunning, getAnalyser, setVolume, getElapsed } = useAudioEngine();

  const [mode, setMode] = useState(MODES[0]);
  const [texture, setTexture] = useState(TEXTURES[0].id);
  const [depth, setDepth] = useState(0.22);
  const [volume, setVolumeState] = useState(0.7);
  const [elapsed, setElapsed] = useState(0);

  const playing = isRunning('focus');
  const analyser = getAnalyser('focus');
  const color = MODULE_COLORS.focus;
  const timerRef = useRef(null);

  const play = useCallback(() => {
    startFocus({ texture, freq: mode.freq, depth, volume });
    startSession('focus');
    setElapsed(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(getElapsed('focus'));
    }, 1000);
  }, [texture, mode, depth, volume, startFocus, startSession, getElapsed]);

  const stop = useCallback(() => {
    stopEngine('focus');
    clearInterval(timerRef.current);
    endSession({ mode: mode.id, texture, depth, elapsed });
  }, [stopEngine, endSession, mode.id, texture, depth, elapsed]);

  const toggle = useCallback(() => {
    playing ? stop() : play();
  }, [playing, play, stop]);

  // Sync elapsed if returning to tab with running engine
  useEffect(() => {
    if (playing) {
      setElapsed(getElapsed('focus'));
      timerRef.current = setInterval(() => setElapsed(getElapsed('focus')), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [playing, getElapsed]);

  // Live volume update
  useEffect(() => {
    if (playing) setVolume('focus', volume);
  }, [volume, playing, setVolume]);

  // Restart audio if params change while playing
  useEffect(() => {
    if (playing) {
      startFocus({ texture, freq: mode.freq, depth, volume });
    }
  }, [mode, texture, depth]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${color}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Focus Engine
        </h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          {mode.freq} Hz amplitude modulation · neural phase-locking
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m)} style={{
            flex: 1, padding: '12px 8px', borderRadius: 12,
            border: `1px solid ${mode.id === m.id ? color + '60' : '#1e1e26'}`,
            background: mode.id === m.id ? color + '10' : '#111116',
            color: mode.id === m.id ? '#e8e8ec' : '#555',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{
        background: '#111116', borderRadius: 16, padding: 20, marginBottom: 20,
        border: '1px solid #1e1e26', boxShadow: `0 0 60px ${color}08`,
      }}>
        <div style={{ height: 90, marginBottom: 16, borderRadius: 8, overflow: 'hidden' }}>
          <Visualizer analyser={analyser} isPlaying={playing} color={color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, color: '#888', minWidth: 60, textAlign: 'center' }}>
            {formatTime(elapsed)}
          </span>
          <button onClick={toggle} style={{
            width: 60, height: 60, borderRadius: '50%', border: 'none',
            background: playing ? '#222' : `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: '#fff', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playing ? 'none' : `0 4px 24px ${color}40`,
          }}>
            {playing ? '▪' : '▶'}
          </button>
          <div style={{ minWidth: 60 }} />
        </div>
        {playing && (
          <div style={{
            textAlign: 'center', marginTop: 12, fontSize: 11, color: '#555',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Audio persists when you switch tabs
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
          Sound texture
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEXTURES.map(t => (
            <button key={t.id} onClick={() => setTexture(t.id)} style={{
              padding: '8px 16px', borderRadius: 8,
              border: `1px solid ${texture === t.id ? color + '50' : '#1e1e26'}`,
              background: texture === t.id ? color + '12' : '#111116',
              color: texture === t.id ? '#ccc' : '#555',
              cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Neural effect (AM depth)
            </label>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>
              {Math.round(depth * 100)}%
            </span>
          </div>
          <input type="range" min="0" max="0.5" step="0.01" value={depth} onChange={e => setDepth(+e.target.value)}
            style={{ width: '100%', accentColor: color }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', marginTop: 2 }}>
            <span>Subtle</span><span>Strong</span>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Volume</label>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{Math.round(volume * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolumeState(+e.target.value)}
            style={{ width: '100%', accentColor: color }} />
        </div>
      </div>

      <div style={{
        background: '#111116', borderRadius: 12, padding: 16,
        border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
        <span style={{ color: '#888' }}>{mode.desc}.</span>{' '}
        Sound is modulated at{' '}
        <span style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{mode.freq} Hz</span>{' '}
        with {Math.round(depth * 100)}% depth, driving neural phase-locking in attentional brain networks.
        Based on Woods et al. (2024), <em style={{ color: '#666' }}>Commun Biol</em>.{' '}
        <a href="https://doi.org/10.1038/s42003-024-06981-7" target="_blank" rel="noopener noreferrer" style={{ color, textDecoration: 'none', borderBottom: `1px solid ${color}40`, fontSize: 11 }}>
          Read study →
        </a>
      </div>
    </div>
  );
}
