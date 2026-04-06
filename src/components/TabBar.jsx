import { useLocation, useNavigate } from 'react-router-dom';
import { TABS, MODULE_COLORS } from '../theme';

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = TABS.find(t =>
    t.path === '/' ? location.pathname === '/' : location.pathname.startsWith(t.path)
  ) || TABS[0];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'rgba(10, 10, 15, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid #1e1e26',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        maxWidth: 640,
        margin: '0 auto',
        padding: '5px 2px 3px',
      }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab.id;
          const color = MODULE_COLORS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 0 2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? color : '#555',
                transition: 'color 0.2s',
                fontFamily: "'DM Sans', sans-serif",
                position: 'relative',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 20,
                  height: 2,
                  borderRadius: 1,
                  background: color,
                }} />
              )}
              <span style={{
                fontSize: 18,
                lineHeight: 1,
                transition: 'transform 0.2s',
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 9,
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.02em',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
