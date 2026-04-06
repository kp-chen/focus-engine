import { useState, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';

const COLOR = MODULE_COLORS.nsdr;

const DURATIONS = [
  { label: '10 min', value: 600 },
  { label: '20 min', value: 1200 },
  { label: '30 min', value: 1800 },
];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function VolumeSlider({ label, value, onChange, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#666' }}>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: color }} />
    </div>
  );
}

function RestCircle({ progress, isActive }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(iv);
  }, [isActive]);
  const breathScale = isActive ? 0.92 + Math.sin(tick * 0.05) * 0.08 : 0.85;

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
  const { startNsdrSession, stopNsdrSession, nsdrNarration, setVolume } = useAudioEngine();

  const [duration, setDuration] = useState(600);
  const [ambientOn, setAmbientOn] = useState(true);
  const [voiceVol, setVoiceVol] = useState(0.6);
  const [ambientVol, setAmbientVol] = useState(0.3);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');

  const isActive = nsdrNarration.active;

  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      setVoices(v);
      if (!selectedVoiceURI && v.length > 0) {
        const preferred = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Google UK English Female', 'Microsoft Zira'];
        const pick = v.find(voice => preferred.some(p => voice.name.includes(p))) || v[0];
        if (pick) setSelectedVoiceURI(pick.voiceURI);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (isActive && ambientOn) setVolume('nsdr', ambientVol);
  }, [ambientVol, isActive, ambientOn, setVolume]);

  const handleStart = () => {
    startSession('nsdr');
    startNsdrSession({
      duration,
      ambientOn,
      ambientVol,
      voiceVol,
      voiceURI: selectedVoiceURI,
      onComplete: () => endSession({ duration, ambientOn }),
    });
  };

  const handleStop = () => {
    stopNsdrSession();
    endSession({ duration: nsdrNarration.elapsed, ambientOn });
  };

  const remaining = Math.max(0, (nsdrNarration.duration || duration) - nsdrNarration.elapsed);

  // Preview voice
  const previewVoice = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('This is how your guided session will sound.');
    u.rate = 0.75; u.pitch = 0.85; u.volume = voiceVol;
    const v = speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoiceURI);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  };

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>NSDR Protocol</h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Non-sleep deep rest · guided body scan
        </p>
      </div>

      {!isActive && (
        <>
          <div style={{ marginBottom: 20 }}>
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

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 12,
            background: '#111116', border: '1px solid #1e1e26', marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>Ambient soundscape</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Gentle drone + brown noise backdrop</div>
            </div>
            <button onClick={() => setAmbientOn(!ambientOn)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none',
              background: ambientOn ? COLOR : '#252530', cursor: 'pointer', position: 'relative',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, left: ambientOn ? 23 : 3, transition: 'left 0.2s',
              }} />
            </button>
          </div>

          <div style={{
            background: '#111116', borderRadius: 12, padding: 16,
            border: '1px solid #1e1e26', marginBottom: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <VolumeSlider label="Voice guide" value={voiceVol} onChange={setVoiceVol} color={COLOR} />
            {ambientOn && <VolumeSlider label="Ambient soundscape" value={ambientVol} onChange={setAmbientVol} color={COLOR} />}
          </div>

          {voices.length > 0 && (
            <div style={{
              background: '#111116', borderRadius: 12, padding: 16,
              border: '1px solid #1e1e26', marginBottom: 20,
            }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Voice</label>
              <select value={selectedVoiceURI} onChange={e => setSelectedVoiceURI(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: '#0d0d14', border: '1px solid #252530',
                color: '#ccc', fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                appearance: 'none', cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              }}>
                {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
              </select>
              <button onClick={previewVoice} style={{
                marginTop: 8, padding: '6px 14px', borderRadius: 6,
                background: 'none', border: `1px solid ${COLOR}30`,
                color: COLOR, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}>Preview voice</button>
            </div>
          )}
        </>
      )}

      <div style={{
        background: '#111116', borderRadius: 16, padding: '24px 20px',
        border: '1px solid #1e1e26', marginBottom: 20,
        boxShadow: isActive ? `0 0 80px ${COLOR}08` : 'none',
      }}>
        <RestCircle progress={nsdrNarration.progress} isActive={isActive} />

        {isActive && nsdrNarration.currentText && (
          <div style={{
            textAlign: 'center', marginTop: 20, fontSize: 14, color: '#999',
            lineHeight: 1.6, fontStyle: 'italic', padding: '0 16px', minHeight: 50,
          }}>"{nsdrNarration.currentText}"</div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          marginTop: 20, padding: '12px 0', borderTop: '1px solid #1e1e26',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Elapsed</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#888' }}>{formatTime(nsdrNarration.elapsed)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: isActive ? COLOR : '#888' }}>{formatTime(remaining)}</div>
          </div>
        </div>

        {isActive && (
          <div style={{ padding: '12px 0 0', borderTop: '1px solid #1e1e26', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <VolumeSlider label="Voice" value={voiceVol} onChange={setVoiceVol} color={COLOR} />
            {ambientOn && <VolumeSlider label="Ambient" value={ambientVol} onChange={setAmbientVol} color={COLOR} />}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button onClick={isActive ? handleStop : handleStart} style={{
            width: isActive ? 140 : 180, padding: '14px 0', borderRadius: 14, border: 'none',
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
            Voice + audio persist when you switch tabs
          </div>
        )}
      </div>

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
            <a href="https://pubmed.ncbi.nlm.nih.gov/38953770/" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>Boukhris et al. (2024) →</a>
          </div>
          <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            Yoga nidra increased striatal dopamine by ~65% in a PET imaging study.{' '}
            <a href="https://pubmed.ncbi.nlm.nih.gov/11958969/" target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>Kjaer et al. (2002) →</a>
          </div>
        </div>
      )}
    </div>
  );
}
