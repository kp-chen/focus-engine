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
import UltradianTimer from './modules/UltradianTimer';
import BilateralStimulation from './modules/BilateralStimulation';

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
              <Route path="/timer" element={<UltradianTimer />} />
              <Route path="/bilateral" element={<BilateralStimulation />} />
            </Routes>
            <NowPlaying />
            <TabBar />
          </div>
        </AudioEngineProvider>
      </CognitiveProvider>
    </BrowserRouter>
  );
}
