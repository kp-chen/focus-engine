import { Component } from 'react';
import { STORAGE_KEY } from '../context/CognitiveContext';

/**
 * Catches render/runtime errors from any module so a single throw degrades to a
 * recoverable card instead of a blank black screen (the failure mode that the
 * "localStorage missing new module streaks" crash produced).
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('A module crashed:', error, info);
  }

  handleRetry = () => this.setState({ error: null });

  handleResetData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24, background: '#0a0a0f',
      }}>
        <div style={{
          maxWidth: 420, width: '100%', textAlign: 'center',
          background: '#111116', border: '1px solid #1e1e26',
          borderRadius: 16, padding: 32,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ec', marginBottom: 8 }}>
            Something broke
          </h1>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>
            This screen hit an error. Your saved data is usually fine — try again
            first. If it keeps happening, reset stored data to recover.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: '#a088e0', color: '#0a0a0f', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleResetData}
              style={{
                padding: '10px 20px', borderRadius: 10,
                border: '1px solid #2a2a36', background: 'transparent',
                color: '#888', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Reset app data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
