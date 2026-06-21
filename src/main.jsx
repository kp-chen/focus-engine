import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts (no render-blocking Google Fonts request, CSP-friendly).
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

// Service worker for offline use + installability. autoUpdate (configured in
// vite.config.js) activates a fresh worker on the next visit after a deploy.
// Registered from the bundle (not an injected inline script) to stay within the
// site CSP. No-op in dev unless devOptions are enabled.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
