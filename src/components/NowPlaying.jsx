import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';

const MODULE_META = {
  focus: { label: 'Focus Engine', icon: '◎', path: '/focus' },
  nsdr:  { label: 'NSDR', icon: '◡', path: '/nsdr' },
};

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function NowPlaying() {
  const { activeEngines, stopEngine, getElapsed } = useAudioEngine();
  const navigate = useNavigate();
  const [, forceUpdate] = useState(0);

  const ids = Object.keys(activeEngines);

  // Tick elapsed every second
  useEffect(() => {
    if (ids.length === 0) return;
    const iv = setInterval(() => forceUpdate(x => x + 1), 1000);
    return () => clearInterval(iv);
  }, [ids.length]);

  if (ids.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      left: 0, right: 0,
      zIndex: 999,
      padding: '0 8px',
    }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        background: 'rgba(18, 18, 24, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 14,
        border: '1px solid #252530',
        padding: '8px 12px',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {ids.map(id => {
          const meta = MODULE_META[id];
          if (!meta) return null;
          const color = MODULE_COLORS[id];
          const elapsed = getElapsed(id);

          return (
            <div key={id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}>
              {/* Pulsing dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}80`,
                animation: 'pulse 2s ease-in-out infinite',
                flexShrink: 0,
              }} />

              {/* Info - tappable to navigate */}
              <button
                onClick={() => navigate(meta.path)}
                style={{
                  flex: 1, minWidth: 0,
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', padding: 0,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.icon} {meta.label}
                </div>
                <div style={{ fontSize: 10, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatTime(elapsed)}
                </div>
              </button>

              {/* Stop button */}
              <button
                onClick={(e) => { e.stopPropagation(); stopEngine(id); }}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: '#1a1a22', border: '1px solid #252530',
                  color: '#666', fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ▪
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
