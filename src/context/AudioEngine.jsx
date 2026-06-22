import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';
import { getAudioContext } from '../lib/audioContext';
import { BODY_SCAN_SCRIPT, NSDR_FILLER } from '../lib/voiceContent';
import { playNsdrSegment, stopCurrentVoice } from '../lib/voice';

const AudioEngineContext = createContext(null);

/**
 * @typedef {Object} FocusConfig
 * @property {'warmpad'|'rain'|'brown'|'binaural'|string} texture
 * @property {number} freq   AM modulation frequency in Hz
 * @property {number} depth  AM depth, 0–0.5
 * @property {number} [volume]
 */

/**
 * @typedef {Object} AudioGraph
 * @property {AudioScheduledSourceNode[]} sources
 * @property {GainNode} output
 * @property {AnalyserNode} [analyser]
 * @property {GainNode} [master]
 */

/**
 * One running audio engine, keyed by module id ('focus' | 'nsdr').
 * @typedef {Object} EngineEntry
 * @property {AudioContext} ctx
 * @property {AudioGraph} graph
 * @property {number} startedAt
 * @property {Object} config
 */

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

// The NSDR body-scan script lives in ../lib/voiceContent (shared with
// scripts/gen-voices.mjs so the pre-rendered ElevenLabs audio never drifts from
// the spoken text). pickVoice/speakText below are the SpeechSynthesis fallback.

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
  const enginesRef = useRef(/** @type {Record<string, EngineEntry>} */ ({}));
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
    const ctx = getAudioContext();
    const graph = buildFocusGraph(ctx, config.texture, config.freq, config.depth);
    graph.output.gain.value = config.volume ?? 0.7;
    enginesRef.current.focus = { ctx, graph, startedAt: Date.now(), config };
    syncUI();
    return graph.analyser;
  }, [syncUI]);

  const startNsdr = useCallback((config) => {
    stopEngine('nsdr');
    const ctx = getAudioContext();
    const graph = buildNsdrGraph(ctx, config.volume ?? 0.4);
    enginesRef.current.nsdr = { ctx, graph, startedAt: Date.now(), config };
    syncUI();
  }, [syncUI]);

  // Start the full NSDR narration session (ambient + voice) — persists across navigation
  const startNsdrSession = useCallback(async (config) => {
    // Stop any existing
    stopNsdrSession();

    const { duration, ambientOn, ambientVol, voiceVol, nsdrVoiceId, onComplete } = config;

    if (ambientOn) startNsdr({ volume: ambientVol });

    // Fresh token object per session. stopNsdrSession() (called above) set the
    // PREVIOUS session's token abortFlag=true; a previous narration loop still
    // awaiting an inter-segment pause captured that old token, so it now exits
    // instead of being silently re-enabled by resetting a shared flag. This is
    // what caused two voices to overlap when you stopped, changed voice, restarted.
    const narRef = { active: true, abortFlag: false };
    nsdrNarrationRef.current = narRef;
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
      if (speechSynthesis.getVoices().length > 0) return r();
      // addEventListener (not onvoiceschanged=) so we don't clobber any existing
      // handler, and { once } cleans itself up.
      const onVoices = () => r();
      speechSynthesis.addEventListener('voiceschanged', onVoices, { once: true });
      setTimeout(r, 1000);
    });

    // Build segments (base script, plus repeated filler for longer sessions).
    const segments = duration <= 600
      ? BODY_SCAN_SCRIPT
      : BODY_SCAN_SCRIPT.concat(
          Array.from({ length: Math.floor((duration - 600) / 30) }, () => NSDR_FILLER)
        );

    const totalScriptTime = segments.reduce((s, seg) => s + seg.text.length * 0.06 + seg.pause, 0);
    const scale = Math.max(1, (duration * 0.8) / totalScriptTime);

    for (let i = 0; i < segments.length; i++) {
      if (narRef.abortFlag) break;
      setNsdrNarration(prev => ({ ...prev, currentText: segments[i].text }));
      // Premium ElevenLabs audio when present (base segments key by index, the
      // repeated filler shares 'filler'); SpeechSynthesis otherwise.
      const key = i < BODY_SCAN_SCRIPT.length ? String(i) : 'filler';
      await playNsdrSegment(nsdrVoiceId, key, segments[i].text, voiceVol, (t, v) => speakText(t, v));
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
    stopCurrentVoice(); // stop any in-flight pre-rendered segment
    stopEngine('nsdr');
    setNsdrNarration({ active: false, currentText: '', elapsed: 0, duration: 0, progress: 0 });
  }, []);

  const stopEngine = useCallback((moduleId) => {
    const engine = enginesRef.current[moduleId];
    if (!engine) return;
    engine.graph.sources.forEach(s => { try { s.stop(); } catch {} });
    try { engine.graph.output.disconnect(); } catch {}
    // The shared context is intentionally NOT closed — repeatedly closing and
    // reopening AudioContexts hits the browser's hardware-context cap.
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
      try { e.graph.output.disconnect(); } catch {}
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
