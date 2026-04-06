import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CognitiveProvider } from './context/CognitiveContext';
import TabBar from './components/TabBar';
import Dashboard from './modules/Dashboard';
import FocusEngine from './modules/FocusEngine';
import PlaceholderModule from './components/PlaceholderModule';

function BreathePage() {
  return (
    <PlaceholderModule
      id="breathe"
      title="Breathwork"
      icon="◠"
      description="Guided cyclic physiological sighing — double inhale through nose, long exhale through mouth. 5 minutes daily."
      science="Balban et al. (2023), Cell Reports Medicine: 5 min/day cyclic sighing reduced anxiety and improved mood more effectively than mindfulness meditation over 28 days (n=108 RCT)."
    />
  );
}

function NBackPage() {
  return (
    <PlaceholderModule
      id="nback"
      title="Dual N-Back"
      icon="◫"
      description="Adaptive dual n-back working memory trainer with visual grid + audio letter stimuli. 20 min/day for 20 days."
      science="Meta-analysis of 33 RCTs: medium transfer to untrained WM tasks, small but significant transfer to fluid intelligence (Gf) and cognitive control. Soveri et al. (2017), Psychonomic Bulletin & Review."
    />
  );
}

function NsdrPage() {
  return (
    <PlaceholderModule
      id="nsdr"
      title="NSDR Protocol"
      icon="◡"
      description="Non-Sleep Deep Rest guided body scan with ambient soundscape. 10-30 minute protocols for cognitive restoration."
      science="Boukhris et al. (2024): 10-min NSDR improved reaction time, cognitive accuracy, and emotional balance vs passive rest (n=65 RCT). Kjaer et al. (2002): yoga nidra increased striatal dopamine by ~65%."
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
      science="Peretz Lavie's ultradian rhythm research: humans cycle through ~90-min periods of higher and lower alertness. Aligned work blocks may improve sustained performance."
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
            <Route path="/breathe" element={<BreathePage />} />
            <Route path="/nback" element={<NBackPage />} />
            <Route path="/nsdr" element={<NsdrPage />} />
            <Route path="/timer" element={<TimerPage />} />
          </Routes>
          <TabBar />
        </div>
      </CognitiveProvider>
    </BrowserRouter>
  );
}
