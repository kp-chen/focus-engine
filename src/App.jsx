import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CognitiveProvider } from './context/CognitiveContext';
import TabBar from './components/TabBar';
import Dashboard from './modules/Dashboard';
import FocusEngine from './modules/FocusEngine';
import BreathworkStudio from './modules/BreathworkStudio';
import DualNBack from './modules/DualNBack';
import PlaceholderModule from './components/PlaceholderModule';

function NsdrPage() {
  return (
    <PlaceholderModule
      id="nsdr"
      title="NSDR Protocol"
      icon="◡"
      description="Non-Sleep Deep Rest guided body scan with ambient soundscape. 10-30 minute protocols for cognitive restoration."
      science="Boukhris et al. (2024): 10-min NSDR improved reaction time, cognitive accuracy, and emotional balance vs passive rest (n=65 RCT)."
    />
  );
}

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
        <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/focus" element={<FocusEngine />} />
            <Route path="/breathe" element={<BreathworkStudio />} />
            <Route path="/nback" element={<DualNBack />} />
            <Route path="/nsdr" element={<NsdrPage />} />
            <Route path="/timer" element={<TimerPage />} />
          </Routes>
          <TabBar />
        </div>
      </CognitiveProvider>
    </BrowserRouter>
  );
}
