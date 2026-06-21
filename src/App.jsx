import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CognitiveProvider } from './context/CognitiveContext';
import { AudioEngineProvider } from './context/AudioEngine';
import ErrorBoundary from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import NowPlaying from './components/NowPlaying';

// Route modules are code-split so the initial bundle no longer carries every
// screen (the 32 KB N-Back game in particular) up front.
const Dashboard = lazy(() => import('./modules/Dashboard'));
const FocusEngine = lazy(() => import('./modules/FocusEngine'));
const BreathworkStudio = lazy(() => import('./modules/BreathworkStudio'));
const DualNBack = lazy(() => import('./modules/DualNBack'));
const NsdrProtocol = lazy(() => import('./modules/NsdrProtocol'));
const UltradianTimer = lazy(() => import('./modules/UltradianTimer'));
const BilateralStimulation = lazy(() => import('./modules/BilateralStimulation'));

function RouteFallback() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#555', fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CognitiveProvider>
        <AudioEngineProvider>
          <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/focus" element={<FocusEngine />} />
                  <Route path="/breathe" element={<BreathworkStudio />} />
                  <Route path="/nback" element={<DualNBack />} />
                  <Route path="/nsdr" element={<NsdrProtocol />} />
                  <Route path="/timer" element={<UltradianTimer />} />
                  <Route path="/bilateral" element={<BilateralStimulation />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
            <NowPlaying />
            <TabBar />
          </div>
        </AudioEngineProvider>
      </CognitiveProvider>
    </BrowserRouter>
  );
}
