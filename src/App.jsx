import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CognitiveProvider } from './context/CognitiveContext';
import { AudioEngineProvider } from './context/AudioEngine';
import TabBar from './components/TabBar';
import NowPlaying from './components/NowPlaying';
import Dashboard from './modules/Dashboard';
import FocusEngine from './modules/FocusEngine';
import BreathworkStudio from './modules/BreathworkStudio';
import DualNBack from './modules/DualNBack';
import NsdrProtocol from './modules/NsdrProtocol';
import PlaceholderModule from './components/PlaceholderModule';

function TimerPage() {
  return (
    <PlaceholderModule
      id="timer"
      title="Ultradian Timer"
      icon="◷"
      description="Smart work/rest timer aligned to 90-minute ultradian rhythms. Tracks focus ratings to learn your optimal block duration."
      science="Peretz Lavie's ultradian rhythm research: humans cycle through ~90-min periods of higher and lower alertness."
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CognitiveProvider>
        <AudioEngineProvider>
          <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/focus" element={<FocusEngine />} />
              <Route path="/breathe" element={<BreathworkStudio />} />
              <Route path="/nback" element={<DualNBack />} />
              <Route path="/nsdr" element={<NsdrProtocol />} />
              <Route path="/timer" element={<TimerPage />} />
            </Routes>
            <NowPlaying />
            <TabBar />
          </div>
        </AudioEngineProvider>
      </CognitiveProvider>
    </BrowserRouter>
  );
}
