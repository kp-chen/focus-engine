import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';

const AudioEngineContext = createContext(null);

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
      osc.type = 'sawtooth'; osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain(); g.gain.value = 0.08;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = 600 + i * 100; lp.Q.value = 0.7;
      osc.connect(lp).connect(g).connect(master); osc.start(); sources.push(osc);
    });
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 55;
    const sg = ctx.createGain(); sg.gain.value = 0.12;
    sub.connect(sg).connect(master); sub.start(); sources.push(sub);
  } else if (texture === 'binaural') {
    [110, 110.5, 220, 220.7, 330, 55].forEach((f, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.15 : 0.06;
      osc.connect(g).connect(master); osc.start(); sources.push(osc);
    });
  } else {
    const buf = createNoiseBuffer(ctx, texture);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = texture === 'brown' ? 400 : 8000; lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = texture === 'brown' ? 0.6 : 0.4;
    src.connect(lp).connect(g).connect(master); src.start(); sources.push(src);
    if (texture === 'rain') {
      const buf2 = createNoiseBuffer(ctx, 'rain');
      const src2 = ctx.createBufferSource(); src2.buffer = buf2; src2.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const g2 = ctx.createGain(); g2.gain.value = 0.15;
      src2.connect(hp).connect(g2).connect(master); src2.start(); sources.push(src2);
    }
  }

  const amDepthGain = ctx.createGain(); amDepthGain.gain.value = depth * 0.5;
  amOsc.connect(amDepthGain).connect(master.gain); amOsc.start(); sources.push(amOsc);
  const reverbLen = ctx.sampleRate * 2;
  const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = reverbBuf.getChannelData(ch);
    for (let i = 0; i < reverbLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
  }
  const convolver = ctx.createConvolver(); convolver.buffer = reverbBuf;
  const wetGain = ctx.createGain(); wetGain.gain.value = 0.25;
  const dryGain = ctx.createGain(); dryGain.gain.value = 0.75;
  const output = ctx.createGain(); output.gain.value = 0.7;
  master.connect(convolver).connect(wetGain).connect(output);
  master.connect(dryGain).connect(output);
  const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
  output.connect(analyser); output.connect(ctx.destination);
  return { sources, output, analyser, master };
}

function buildNsdrGraph(ctx, volume) {
  const master = ctx.createGain(); master.gain.value = volume;
  const sources = [];
  [55, 82.41, 110].forEach((f, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0.06 - i * 0.015;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 0.5;
    osc.connect(lp).connect(g).connect(master); osc.start(); sources.push(osc);
  });
  const buf = createNoiseBuffer(ctx, 'brown');
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 0.3;
  const ng = ctx.createGain(); ng.gain.value = 0.25;
  src.connect(lp).connect(ng).connect(master); src.start(); sources.push(src);
  const reverbLen = ctx.sampleRate * 3;
  const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = reverbBuf.getChannelData(ch);
    for (let i = 0; i < reverbLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 1.2));
  }
  const convolver = ctx.createConvolver(); convolver.buffer = reverbBuf;
  const wet = ctx.createGain(); wet.gain.value = 0.4;
  const dry = ctx.createGain(); dry.gain.value = 0.6;
  const output = ctx.createGain(); output.gain.value = 1;
  master.connect(convolver).connect(wet).connect(output);
  master.connect(dry).connect(output); output.connect(ctx.destination);
  return { sources, output, master };
}

// NSDR body scan script
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

function pickVoice(voiceURI) {
  const voices = speechSynthesis.getVoices();
  if (voiceURI) {
    const v = voices.find(v => v.voiceURI === voiceURI);
    if (v) return v;
  }
  const preferred = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Google UK English Female', 'Microsoft Zira'];
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }
  return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

function speakText(text, voiceVol, voiceURI) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.75; u.pitch = 0.85;
    u.volume = Math.min(1, voiceVol);
    const voice = pickVoice(voiceURI);
    if (voice) u.voice = voice;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function AudioEngineProvider({ children }) {
  const enginesRef = useRef({});
  const [activeEngines, setActiveEngines] = useState({});

  // NSDR narration state — lives here so it survives navigation
  const nsdrNarrationRef = useRef({ active: false, abortFlag: false });
  const [nsdrNarration, setNsdrNarration] = useState({
    active: false,
    currentText: '',
    elapsed: 0,
    duration: 0,
    progress: 0,
  });
  const nsdrTimerRef = useRef(null);

  const syncUI = useCallback(() => {
    const uiState = {};
    for (const [id, e] of Object.entries(enginesRef.current)) {
      uiState[id] = { startedAt: e.startedAt, config: e.config };
    }
    setActiveEngines({ ...uiState });
  }, []);

  const startFocus = useCallback((config) => {
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

  // Start the full NSDR narration session (ambient + voice) — persists across navigation
  const startNsdrSession = useCallback(async (config) => {
    // Stop any existing
    stopNsdrSession();

    const { duration, ambientOn, ambientVol, voiceVol, voiceURI, onComplete } = config;

    if (ambientOn) startNsdr({ volume: ambientVol });

    const narRef = nsdrNarrationRef.current;
    narRef.active = true;
    narRef.abortFlag = false;
    const startTime = Date.now();

    setNsdrNarration({ active: true, currentText: '', elapsed: 0, duration, progress: 0 });

    // Timer for elapsed
    nsdrTimerRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - startTime) / 1000);
      const prog = Math.min(el / duration, 1);
      setNsdrNarration(prev => ({ ...prev, elapsed: el, progress: prog }));
      if (el >= duration) {
        stopNsdrSession();
        if (onComplete) onComplete();
      }
    }, 1000);

    // Wait for voices
    await new Promise(r => {
      if (speechSynthesis.getVoices().length > 0) r();
      else speechSynthesis.onvoiceschanged = r;
      setTimeout(r, 1000);
    });

    // Build segments
    const segments = duration <= 600
      ? BODY_SCAN_SCRIPT
      : BODY_SCAN_SCRIPT.concat(
          Array.from({ length: Math.floor((duration - 600) / 30) }, () => ({
            text: "Continue to rest deeply. Let each breath carry you further into stillness.",
            pause: 12,
          }))
        );

    const totalScriptTime = segments.reduce((s, seg) => s + seg.text.length * 0.06 + seg.pause, 0);
    const scale = Math.max(1, (duration * 0.8) / totalScriptTime);

    for (let i = 0; i < segments.length; i++) {
      if (narRef.abortFlag) break;
      setNsdrNarration(prev => ({ ...prev, currentText: segments[i].text }));
      await speakText(segments[i].text, voiceVol, voiceURI);
      if (narRef.abortFlag) break;
      await new Promise(r => setTimeout(r, segments[i].pause * 1000 * scale));
    }

    if (narRef.active && !narRef.abortFlag) {
      stopNsdrSession();
      if (onComplete) onComplete();
    }
  }, [startNsdr]);

  const stopNsdrSession = useCallback(() => {
    nsdrNarrationRef.current.active = false;
    nsdrNarrationRef.current.abortFlag = true;
    clearInterval(nsdrTimerRef.current);
    speechSynthesis.cancel();
    stopEngine('nsdr');
    setNsdrNarration({ active: false, currentText: '', elapsed: 0, duration: 0, progress: 0 });
  }, []);

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
    stopNsdrSession();
    Object.keys(enginesRef.current).forEach(stopEngine);
  }, [stopEngine, stopNsdrSession]);

  const isRunning = useCallback((moduleId) => {
    if (moduleId === 'nsdr') return nsdrNarrationRef.current.active || !!enginesRef.current.nsdr;
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
    if (moduleId === 'nsdr' && nsdrNarrationRef.current.active) {
      return nsdrNarration.elapsed;
    }
    const engine = enginesRef.current[moduleId];
    if (!engine) return 0;
    return Math.floor((Date.now() - engine.startedAt) / 1000);
  }, [nsdrNarration.elapsed]);

  useEffect(() => () => {
    speechSynthesis.cancel();
    clearInterval(nsdrTimerRef.current);
    Object.values(enginesRef.current).forEach(e => {
      e.graph.sources.forEach(s => { try { s.stop(); } catch {} });
      e.graph.output.disconnect(); e.ctx.close();
    });
  }, []);

  return (
    <AudioEngineContext.Provider value={{
      startFocus, startNsdr, startNsdrSession, stopNsdrSession,
      stopEngine, stopAll,
      isRunning, getAnalyser, setVolume, getElapsed,
      activeEngines, nsdrNarration,
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
