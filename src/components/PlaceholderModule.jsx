import { MODULE_COLORS } from '../theme';

export default function PlaceholderModule({ id, title, icon, description, science }) {
  const color = MODULE_COLORS[id] || '#888';

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${color}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {title}
        </h1>
      </div>

      <div style={{
        background: '#111116', borderRadius: 16, padding: 32,
        border: '1px solid #1e1e26', textAlign: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20, margin: '0 auto 20px',
          background: color + '12', border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, color,
        }}>
          {icon}
        </div>

        <div style={{ fontSize: 15, color: '#888', lineHeight: 1.6, marginBottom: 16 }}>
          {description}
        </div>

        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: 8,
          background: color + '15', border: `1px solid ${color}30`,
          fontSize: 12, fontWeight: 600, color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Coming in Sprint {id === 'breathe' ? '2' : id === 'nback' ? '3' : id === 'nsdr' ? '4' : '5'}
        </div>

        {science && (
          <div style={{
            marginTop: 20, padding: 16, borderRadius: 10,
            background: '#0d0d14', border: '1px solid #1a1a24',
            textAlign: 'left', fontSize: 12, color: '#555', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>Scientific basis</div>
            {science}
          </div>
        )}
      </div>
    </div>
  );
}
