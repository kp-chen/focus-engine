import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';

const AudioEngineContext = createContext(null);

// Noise buffer generator
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

// Build Focus Engine audio graph
function buildFocusGraph(ctx, texture, freq, depth) {
  const master = ctx.createGain();
  master.gain.value = 1 - depth * 0.5;

  const amOsc = ctx.createOscillator();
  amOsc.type = 'sine';
  amOsc.frequency.value = freq;
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

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  output.connect(analyser);
  output.connect(ctx.destination);

  return { sources, output, analyser, master };
}

// Build NSDR ambient soundscape
function buildNsdrGraph(ctx, volume) {
  const master = ctx.createGain();
  master.gain.value = volume;
  const sources = [];

  // Warm drone - very low, gentle
  [55, 82.41, 110].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.06 - i * 0.015;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 0.5;
    osc.connect(lp).connect(g).connect(master);
    osc.start();
    sources.push(osc);
  });

  // Gentle brown noise bed
  const buf = createNoiseBuffer(ctx, 'brown');
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  lp.Q.value = 0.3;
  const ng = ctx.createGain();
  ng.gain.value = 0.25;
  src.connect(lp).connect(ng).connect(master);
  src.start();
  sources.push(src);

  // Reverb
  const reverbLen = ctx.sampleRate * 3;
  const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = reverbBuf.getChannelData(ch);
    for (let i = 0; i < reverbLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 1.2));
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbBuf;
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  const output = ctx.createGain();
  output.gain.value = 1;
  master.connect(convolver).connect(wet).connect(output);
  master.connect(dry).connect(output);
  output.connect(ctx.destination);

  return { sources, output, master };
}

export function AudioEngineProvider({ children }) {
  // Running engines: { [moduleId]: { ctx, graph, startedAt, config } }
  const enginesRef = useRef({});
  const [activeEngines, setActiveEngines] = useState({}); // { [moduleId]: { startedAt, config } } for UI

  const syncUI = useCallback(() => {
    const uiState = {};
    for (const [id, e] of Object.entries(enginesRef.current)) {
      uiState[id] = { startedAt: e.startedAt, config: e.config };
    }
    setActiveEngines({ ...uiState });
  }, []);

  const startFocus = useCallback((config) => {
    // Stop existing focus if running
    stopEngine('focus');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const graph = buildFocusGraph(ctx, config.texture, config.freq, config.depth);
    graph.output.gain.value = config.volume ?? 0.7;
    enginesRef.current.focus = { ctx, graph, startedAt: Date.now(), config };
    syncUI();
    return graph.analyser;
  }, [syncUI]);

  const startNsdr = useCallback((config) => {
    stopEngine('nsdr');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const graph = buildNsdrGraph(ctx, config.volume ?? 0.4);
    enginesRef.current.nsdr = { ctx, graph, startedAt: Date.now(), config };
    syncUI();
  }, [syncUI]);

  const stopEngine = useCallback((moduleId) => {
    const engine = enginesRef.current[moduleId];
    if (!engine) return;
    engine.graph.sources.forEach(s => { try { s.stop(); } catch {} });
    engine.graph.output.disconnect();
    engine.ctx.close();
    delete enginesRef.current[moduleId];
    syncUI();
  }, [syncUI]);

  const stopAll = useCallback(() => {
    Object.keys(enginesRef.current).forEach(stopEngine);
  }, [stopEngine]);

  const isRunning = useCallback((moduleId) => {
    return !!enginesRef.current[moduleId];
  }, []);

  const getAnalyser = useCallback((moduleId) => {
    return enginesRef.current[moduleId]?.graph?.analyser || null;
  }, []);

  const setVolume = useCallback((moduleId, vol) => {
    const engine = enginesRef.current[moduleId];
    if (engine) engine.graph.output.gain.value = vol;
  }, []);

  const getElapsed = useCallback((moduleId) => {
    const engine = enginesRef.current[moduleId];
    if (!engine) return 0;
    return Math.floor((Date.now() - engine.startedAt) / 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    Object.values(enginesRef.current).forEach(e => {
      e.graph.sources.forEach(s => { try { s.stop(); } catch {} });
      e.graph.output.disconnect();
      e.ctx.close();
    });
  }, []);

  return (
    <AudioEngineContext.Provider value={{
      startFocus, startNsdr, stopEngine, stopAll,
      isRunning, getAnalyser, setVolume, getElapsed,
      activeEngines,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine() {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngine must be used within AudioEngineProvider');
  return ctx;
}
