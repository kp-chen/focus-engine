import { useCognitive } from '../context/CognitiveContext';
import { MODULE_COLORS } from '../theme';
import { useNavigate } from 'react-router-dom';

function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: '#111116',
      border: '1px solid #1e1e26',
      borderRadius: 12,
      padding: '14px 16px',
      textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: "'DM Sans', sans-serif",
      transition: 'border-color 0.2s',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#e8e8ec', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          {sub}
        </div>
      )}
    </button>
  );
}

function ModuleRow({ id, label, icon, streak, todayTime, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: '#111116',
      border: '1px solid #1e1e26',
      borderRadius: 12,
      cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif",
      width: '100%',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + '15',
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color,
        flexShrink: 0,
      }}>
        {icon}
      </div>
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

export default function Dashboard() {
  const { state, getTodayTotal, exportData } = useCognitive();
  const navigate = useNavigate();

  const modules = [
    { id: 'focus', label: 'Focus Engine', icon: '◎', path: '/focus' },
    { id: 'breathe', label: 'Breathwork', icon: '◠', path: '/breathe' },
    { id: 'nback', label: 'Dual N-Back', icon: '◫', path: '/nback' },
    { id: 'nsdr', label: 'NSDR Protocol', icon: '◡', path: '/nsdr' },
    { id: 'timer', label: 'Ultradian Timer', icon: '◷', path: '/timer' },
  ];

  const todayTotal = modules.reduce((sum, m) => sum + getTodayTotal(m.id), 0);
  const totalSessions = state.sessions.length;
  const bestStreak = Math.max(...Object.values(state.streaks).map(s => s.best), 0);

  // Sessions in last 7 days
  const weekCutoff = Date.now() - 7 * 86400000;
  const weekSessions = state.sessions.filter(s => s.startedAt > weekCutoff).length;

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #a088e0, #e8e8ec)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>
          Cognitive Toolkit
        </h1>
        <p style={{ fontSize: 13, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
          Science-backed performance tools
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 24,
      }}>
        <StatCard
          label="Today"
          value={todayTotal > 0 ? formatDuration(todayTotal) : '—'}
          sub="total time"
          color={MODULE_COLORS.dashboard}
        />
        <StatCard
          label="This week"
          value={weekSessions}
          sub="sessions"
          color={MODULE_COLORS.dashboard}
        />
        <StatCard
          label="Best streak"
          value={bestStreak}
          sub="days"
          color={MODULE_COLORS.dashboard}
        />
      </div>

      {/* Module list */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#555',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 10, paddingLeft: 4,
        }}>
          Modules
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.map(m => (
            <ModuleRow
              key={m.id}
              {...m}
              color={MODULE_COLORS[m.id]}
              streak={state.streaks[m.id]}
              todayTime={getTodayTotal(m.id)}
              onClick={() => navigate(m.path)}
            />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={exportData} style={{
          flex: 1, padding: '10px 16px', borderRadius: 10,
          background: '#111116', border: '1px solid #1e1e26',
          color: '#666', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>
          Export Data (JSON)
        </button>
        <button onClick={() => {
          const csv = ['module,date,duration_sec,data']
            .concat(state.sessions.map(s =>
              `${s.module},${new Date(s.startedAt).toISOString()},${Math.round(s.duration / 1000)},"${JSON.stringify(s.data).replace(/"/g, '""')}"`
            )).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cognitive-toolkit-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }} style={{
          flex: 1, padding: '10px 16px', borderRadius: 10,
          background: '#111116', border: '1px solid #1e1e26',
          color: '#666', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>
          Export CSV (Obsidian)
        </button>
      </div>
    </div>
  );
}
