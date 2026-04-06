export const THEME = {
  bg: { primary: '#0a0a0f', secondary: '#111116', tertiary: '#161620', card: '#111116' },
  text: { primary: '#e8e8ec', secondary: '#888', tertiary: '#555', hint: '#444' },
  border: { default: '#1e1e26', hover: '#2a2a36' },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
  font: {
    sans: "'DM Sans', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
};

export const MODULE_COLORS = {
  dashboard:  '#a088e0',
  focus:      '#f06040',
  breathe:    '#40c090',
  nback:      '#40a0f0',
  nsdr:       '#8060d0',
  timer:      '#e0a030',
  bilateral:  '#d4537e',
};

export const TABS = [
  { id: 'dashboard',  label: 'Home',    icon: '◉', path: '/' },
  { id: 'focus',      label: 'Focus',   icon: '◎', path: '/focus' },
  { id: 'breathe',    label: 'Breathe', icon: '◠', path: '/breathe' },
  { id: 'nback',      label: 'N-Back',  icon: '◫', path: '/nback' },
  { id: 'nsdr',       label: 'NSDR',    icon: '◡', path: '/nsdr' },
  { id: 'timer',      label: 'Timer',   icon: '◷', path: '/timer' },
  { id: 'bilateral',  label: 'BLS',     icon: '⇋', path: '/bilateral' },
];
