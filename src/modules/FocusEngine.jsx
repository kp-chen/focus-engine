import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
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

function createNoiseBuffer(ctx, type) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      let env = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        env += (Math.random() > 0.9997 ? 1 : 0.3 - env) * 0.001;
        data[i] = white * env;
      }
    }
  }
  return buf;
}

function buildGraph(ctx, texture, modeFreq, depth) {
  const master = ctx.createGain();
  master.gain.value = 1 - depth * 0.5;

  const amOsc = ctx.createOscillator();
  amOsc.type = 'sine';
  amOsc.frequency.value = modeFreq;

  const sources = [];

  if (texture === 'warmpad') {
    [110, 164.81, 220, 329.63].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.value = 0.08;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600 + i * 100;
      lp.Q.value = 0.7;
      osc.connect(lp).connect(g).connect(master);
      osc.start();
      sources.push(osc);
    });
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    const sg = ctx.createGain();
    sg.gain.value = 0.12;
    sub.connect(sg).connect(master);
    sub.start();
    sources.push(sub);
  } else if (texture === 'binaural') {
    [110, 110.5, 220, 220.7, 330, 55].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.15 : 0.06;
      osc.connect(g).connect(master);
      osc.start();
      sources.push(osc);
    });
  } else {
    const buf = createNoiseBuffer(ctx, texture);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = texture === 'brown' ? 400 : 8000;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = texture === 'brown' ? 0.6 : 0.4;
    src.connect(lp).connect(g).connect(master);
    src.start();
    sources.push(src);
    if (texture === 'rain') {
      const buf2 = createNoiseBuffer(ctx, 'rain');
      const src2 = ctx.createBufferSource();
      src2.buffer = buf2;
      src2.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const g2 = ctx.createGain();
      g2.gain.value = 0.15;
      src2.connect(hp).connect(g2).connect(master);
      src2.start();
      sources.push(src2);
    }
  }

  const amDepthGain = ctx.createGain();
  amDepthGain.gain.value = depth * 0.5;
  amOsc.connect(amDepthGain).connect(master.gain);
  amOsc.start();
  sources.push(amOsc);

  // Reverb
  const reverbLen = ctx.sampleRate * 2;
  const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = reverbBuf.getChannelData(ch);
    for (let i = 0; i < reverbLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbBuf;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.25;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.75;
  const output = ctx.createGain();
  output.gain.value = 0.7;
  master.connect(convolver).connect(wetGain).connect(output);
  master.connect(dryGain).connect(output);
  output.connect(ctx.destination);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  output.connect(analyser);

  return { sources, output, analyser, master };
}

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
  const [mode, setMode] = useState(MODES[0]);
  const [texture, setTexture] = useState(TEXTURES[0].id);
  const [depth, setDepth] = useState(0.22);
  const [volume, setVolume] = useState(0.7);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const ctxRef = useRef(null);
  const graphRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const color = MODULE_COLORS.focus;

  const stop = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.sources.forEach(s => { try { s.stop(); } catch (e) {} });
      graphRef.current.output.disconnect();
      graphRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    clearInterval(timerRef.current);
    if (isPlaying) {
      endSession({ mode: mode.id, texture, depth, elapsed });
    }
    setIsPlaying(false);
  }, [isPlaying, endSession, mode.id, texture, depth, elapsed]);

  const play = useCallback(() => {
    stop();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    const graph = buildGraph(ctx, texture, mode.freq, depth);
    graph.output.gain.value = volume;
    graphRef.current = graph;
    setIsPlaying(true);
    startSession('focus');
    startTimeRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [texture, mode, depth, volume, stop, startSession]);

  const toggle = useCallback(() => {
    isPlaying ? stop() : play();
  }, [isPlaying, play, stop]);

  useEffect(() => {
    if (graphRef.current) graphRef.current.output.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    if (isPlaying) play();
  }, [mode, texture, depth]);

  useEffect(() => () => {
    if (graphRef.current) {
      graphRef.current.sources.forEach(s => { try { s.stop(); } catch (e) {} });
      graphRef.current.output.disconnect();
    }
    if (ctxRef.current) ctxRef.current.close();
    clearInterval(timerRef.current);
  }, []);

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
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

      {/* Mode selector */}
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

      {/* Visualizer + Play */}
      <div style={{
        background: '#111116', borderRadius: 16, padding: 20, marginBottom: 20,
        border: '1px solid #1e1e26',
        boxShadow: `0 0 60px ${color}08`,
      }}>
        <div style={{ height: 90, marginBottom: 16, borderRadius: 8, overflow: 'hidden' }}>
          <Visualizer analyser={graphRef.current?.analyser} isPlaying={isPlaying} color={color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, color: '#888', minWidth: 60, textAlign: 'center' }}>
            {formatTime(elapsed)}
          </span>
          <button onClick={toggle} style={{
            width: 60, height: 60, borderRadius: '50%', border: 'none',
            background: isPlaying ? '#222' : `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: '#fff', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isPlaying ? 'none' : `0 4px 24px ${color}40`,
          }}>
            {isPlaying ? '▪' : '▶'}
          </button>
          <div style={{ minWidth: 60 }} />
        </div>
      </div>

      {/* Texture selector */}
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

      {/* Sliders */}
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
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Volume
            </label>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(+e.target.value)}
            style={{ width: '100%', accentColor: color }} />
        </div>
      </div>

      {/* Info */}
      <div style={{
        background: '#111116', borderRadius: 12, padding: 16,
        border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
        <span style={{ color: '#888' }}>{mode.desc}.</span>{' '}
        Sound is modulated at{' '}
        <span style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{mode.freq} Hz</span>{' '}
        with {Math.round(depth * 100)}% depth, driving neural phase-locking in attentional brain networks.
        Based on Woods et al. (2024), <em style={{ color: '#666' }}>Commun Biol</em>.
      </div>
    </div>
  );
}
