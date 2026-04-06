import { useState } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { useAudioEngine } from '../context/AudioEngine';
import { MODULE_COLORS } from '../theme';
import { useNavigate } from 'react-router-dom';

function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#111116', border: '1px solid #1e1e26', borderRadius: 12,
      padding: '14px 16px', textAlign: 'left',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#e8e8ec', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

function ModuleRow({ id, label, icon, streak, todayTime, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: '#111116', border: '1px solid #1e1e26',
      borderRadius: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", width: '100%',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + '15', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ec' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
          {todayTime > 0 ? `${formatDuration(todayTime)} today` : 'Not started today'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{streak.current}</div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>day streak</div>
      </div>
      <div style={{ color: '#333', fontSize: 16 }}>›</div>
    </button>
  );
}

// Flow Sequence presets
const FLOW_PRESETS = [
  {
    id: 'deep-work',
    label: 'Deep Work',
    desc: 'Calm → Focus → 90-min block',
    color: MODULE_COLORS.focus,
    steps: [
      { module: 'breathe', label: 'Cyclic sighing', duration: '3 min', icon: '◠' },
      { module: 'focus', label: 'Focus Engine on', duration: 'Continuous', icon: '◎' },
      { module: 'timer', label: '90-min work block', duration: '90 min', icon: '◷' },
    ],
  },
  {
    id: 'recovery',
    label: 'Recovery',
    desc: 'Breathe → NSDR → Restored',
    color: MODULE_COLORS.nsdr,
    steps: [
      { module: 'breathe', label: '4-7-8 breathing', duration: '5 min', icon: '◠' },
      { module: 'nsdr', label: 'NSDR body scan', duration: '10 min', icon: '◡' },
    ],
  },
  {
    id: 'brain-train',
    label: 'Brain Training',
    desc: 'Focus → N-Back → Cooldown',
    color: MODULE_COLORS.nback,
    steps: [
      { module: 'focus', label: 'Focus Engine on', duration: 'Continuous', icon: '◎' },
      { module: 'nback', label: 'Dual N-Back', duration: '20 trials', icon: '◫' },
      { module: 'breathe', label: 'Box breathing', duration: '3 min', icon: '◠' },
    ],
  },
  {
    id: 'full-day',
    label: 'Full Day Protocol',
    desc: 'Morning → Work → Rest → Work',
    color: MODULE_COLORS.dashboard,
    steps: [
      { module: 'breathe', label: 'Morning breathwork', duration: '5 min', icon: '◠' },
      { module: 'focus', label: 'Focus Engine on', duration: 'Continuous', icon: '◎' },
      { module: 'timer', label: 'Work block 1', duration: '90 min', icon: '◷' },
      { module: 'nsdr', label: 'NSDR recovery', duration: '20 min', icon: '◡' },
      { module: 'timer', label: 'Work block 2', duration: '90 min', icon: '◷' },
    ],
  },
];

function FlowCard({ preset, onStart }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: '#111116', borderRadius: 14, border: '1px solid #1e1e26',
      overflow: 'hidden',
    }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: preset.color + '12', border: `1px solid ${preset.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: preset.color, fontWeight: 700, flexShrink: 0,
        }}>
          {preset.steps.length}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ec' }}>{preset.label}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{preset.desc}</div>
        </div>
        <div style={{ color: '#444', fontSize: 14, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          {/* Steps timeline */}
          <div style={{ padding: '4px 0 12px' }}>
            {preset.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: MODULE_COLORS[step.module] + '20',
                    border: `1.5px solid ${MODULE_COLORS[step.module]}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: MODULE_COLORS[step.module],
                  }}>{step.icon}</div>
                  {i < preset.steps.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 16, background: '#252530' }} />
                  )}
                </div>
                <div style={{ padding: '0 0 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc' }}>{step.label}</div>
                  <div style={{ fontSize: 10, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{step.duration}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => onStart(preset)} style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: preset.color + '18', border: `1px solid ${preset.color}30`,
            color: preset.color, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}>
            Start sequence →
          </button>
        </div>
      )}
    </div>
  );
}

// Weekly activity heatmap
function WeeklyHeatmap({ sessions }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {days.map((d, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (dayOfWeek - i));
        const dayStr = date.toDateString();
        const count = sessions.filter(s => new Date(s.startedAt).toDateString() === dayStr).length;
        const intensity = Math.min(count / 4, 1);
        const isToday = i === dayOfWeek;

        return (
          <div key={d} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: isToday ? '#888' : '#444', marginBottom: 3, fontFamily: "'JetBrains Mono', monospace" }}>{d}</div>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: count > 0
                ? `rgba(160, 136, 224, ${0.15 + intensity * 0.45})`
                : '#151519',
              border: isToday ? '1.5px solid #a088e050' : '1px solid #1e1e26',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              color: count > 0 ? '#a088e0' : '#333',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {count || '·'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { state, getTodayTotal, exportData } = useCognitive();
  const navigate = useNavigate();

  const modules = [
    { id: 'focus', label: 'Focus Engine', icon: '◎', path: '/focus' },
    { id: 'breathe', label: 'Breathwork', icon: '◠', path: '/breathe' },
    { id: 'nback', label: 'Dual N-Back', icon: '◫', path: '/nback' },
    { id: 'nsdr', label: 'NSDR Protocol', icon: '◡', path: '/nsdr' },
    { id: 'timer', label: 'Ultradian Timer', icon: '◷', path: '/timer' },
    { id: 'bilateral', label: 'Bilateral Stim', icon: '⇋', path: '/bilateral' },
  ];

  const todayTotal = modules.reduce((sum, m) => sum + getTodayTotal(m.id), 0);
  const bestStreak = Math.max(...Object.values(state.streaks).map(s => s.best), 0);
  const weekCutoff = Date.now() - 7 * 86400000;
  const weekSessions = state.sessions.filter(s => s.startedAt > weekCutoff);

  const handleFlowStart = (preset) => {
    // Navigate to the first step's module
    const firstStep = preset.steps[0];
    navigate(`/${firstStep.module}`);
  };

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #a088e0, #e8e8ec)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4,
        }}>Cognitive Toolkit</h1>
        <p style={{ fontSize: 13, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
          Science-backed performance tools
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        <StatCard label="Today" value={todayTotal > 0 ? formatDuration(todayTotal) : '—'} sub="total time" color={MODULE_COLORS.dashboard} />
        <StatCard label="This week" value={weekSessions.length} sub="sessions" color={MODULE_COLORS.dashboard} />
        <StatCard label="Best streak" value={bestStreak} sub="days" color={MODULE_COLORS.dashboard} />
      </div>

      {/* Weekly heatmap */}
      <div style={{
        background: '#111116', borderRadius: 14, padding: '14px 16px',
        border: '1px solid #1e1e26', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>This week</div>
        <WeeklyHeatmap sessions={state.sessions} />
      </div>

      {/* Flow Sequences */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingLeft: 4 }}>
          Flow sequences
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FLOW_PRESETS.map(p => (
            <FlowCard key={p.id} preset={p} onStart={handleFlowStart} />
          ))}
        </div>
      </div>

      {/* Module list */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingLeft: 4 }}>
          Modules
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.map(m => (
            <ModuleRow key={m.id} {...m} color={MODULE_COLORS[m.id]}
              streak={state.streaks[m.id] || { current: 0, best: 0, lastDate: null }} todayTime={getTodayTotal(m.id)}
              onClick={() => navigate(m.path)} />
          ))}
        </div>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={exportData} style={{
          flex: 1, padding: '10px 16px', borderRadius: 10,
          background: '#111116', border: '1px solid #1e1e26',
          color: '#666', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>Export JSON</button>
        <button onClick={() => {
          const csv = ['module,date,duration_sec,data']
            .concat(state.sessions.map(s =>
              `${s.module},${new Date(s.startedAt).toISOString()},${Math.round(s.duration / 1000)},"${JSON.stringify(s.data).replace(/"/g, '""')}"`
            )).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url;
          a.download = `cognitive-toolkit-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click(); URL.revokeObjectURL(url);
        }} style={{
          flex: 1, padding: '10px 16px', borderRadius: 10,
          background: '#111116', border: '1px solid #1e1e26',
          color: '#666', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>Export CSV</button>
      </div>
    </div>
  );
}
