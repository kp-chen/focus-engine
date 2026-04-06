import { useState, useRef, useCallback, useEffect } from 'react';
import { useCognitive } from '../context/CognitiveContext';
import { MODULE_COLORS } from '../theme';

const COLOR = MODULE_COLORS.nback;

// Audio letters for auditory channel
const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

// Speech synthesis for letters
function speakLetter(letter) {
  try {
    const u = new SpeechSynthesisUtterance(letter);
    u.rate = 0.9;
    u.pitch = 1.0;
    u.volume = 0.8;
    speechSynthesis.speak(u);
  } catch {}
}

// Generate a sequence with controlled match rate (~30% matches for each channel)
function generateSequence(length, n) {
  const positions = [];
  const letters = [];
  const posMatches = new Set();
  const audMatches = new Set();

  for (let i = 0; i < length; i++) {
    if (i >= n && Math.random() < 0.3) {
      positions.push(positions[i - n]);
      posMatches.add(i);
    } else {
      positions.push(Math.floor(Math.random() * 9));
    }

    if (i >= n && Math.random() < 0.3) {
      letters.push(letters[i - n]);
      audMatches.add(i);
    } else {
      letters.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    }
  }

  return { positions, letters, posMatches, audMatches };
}

// 3x3 Grid component
function Grid({ activeCell, showFeedback, feedbackType }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 6,
      width: 200,
      height: 200,
      margin: '0 auto',
    }}>
      {Array.from({ length: 9 }, (_, i) => {
        const isActive = activeCell === i;
        return (
          <div key={i} style={{
            borderRadius: 10,
            background: isActive ? COLOR : '#1a1a22',
            border: `1px solid ${isActive ? COLOR + '80' : '#252530'}`,
            boxShadow: isActive ? `0 0 20px ${COLOR}40` : 'none',
            transition: 'all 0.15s ease-out',
          }} />
        );
      })}
    </div>
  );
}

// Response button
function ResponseButton({ label, sublabel, active, correct, wrong, onPress, disabled }) {
  let bg = '#111116';
  let border = '#1e1e26';
  if (active && correct) { bg = '#1a3a1a'; border = '#2a6a2a'; }
  else if (active && wrong) { bg = '#3a1a1a'; border = '#6a2a2a'; }
  else if (active) { bg = COLOR + '15'; border = COLOR + '40'; }

  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '14px 8px',
        borderRadius: 12,
        border: `1.5px solid ${border}`,
        background: bg,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#e8e8ec' : '#888' }}>{label}</div>
      <div style={{ fontSize: 10, color: '#555', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{sublabel}</div>
    </button>
  );
}

// Results screen
function Results({ stats, nLevel, onRestart, onClose }) {
  const total = stats.posHits + stats.posMisses + stats.posFalseAlarms + stats.posCorrectRejects;
  const posAccuracy = total > 0 ? Math.round(((stats.posHits + stats.posCorrectRejects) / total) * 100) : 0;
  const audAccuracy = total > 0 ? Math.round(((stats.audHits + stats.audCorrectRejects) / total) * 100) : 0;
  const overall = Math.round((posAccuracy + audAccuracy) / 2);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 48, fontWeight: 700, color: COLOR,
        letterSpacing: '-0.03em', marginBottom: 4,
      }}>
        {overall}%
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Overall accuracy at {nLevel}-back
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        marginBottom: 24,
      }}>
        <div style={{ background: '#0d0d14', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Position</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLOR }}>{posAccuracy}%</div>
          <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
            {stats.posHits}h {stats.posMisses}m {stats.posFalseAlarms}fa
          </div>
        </div>
        <div style={{ background: '#0d0d14', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Audio</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLOR }}>{audAccuracy}%</div>
          <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
            {stats.audHits}h {stats.audMisses}m {stats.audFalseAlarms}fa
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
        {overall >= 80 ? `Strong performance. Consider advancing to ${nLevel + 1}-back.` :
         overall >= 60 ? `Solid session. Keep training at ${nLevel}-back.` :
         `Keep practicing at ${nLevel}-back. Accuracy improves with consistent daily sessions.`}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRestart} style={{
          flex: 1, padding: '12px', borderRadius: 12,
          background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
          border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          boxShadow: `0 4px 20px ${COLOR}30`,
        }}>
          Play Again
        </button>
        <button onClick={onClose} style={{
          flex: 1, padding: '12px', borderRadius: 12,
          background: '#1a1a22', border: '1px solid #252530',
          color: '#888', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

export default function DualNBack() {
  const { startSession, endSession } = useCognitive();

  const [nLevel, setNLevel] = useState(2);
  const [trialCount, setTrialCount] = useState(20);
  const [gameState, setGameState] = useState('setup'); // setup | playing | feedback | results
  const [currentTrial, setCurrentTrial] = useState(0);
  const [activeCell, setActiveCell] = useState(-1);
  const [activeLetter, setActiveLetter] = useState('');
  const [posPressed, setPosPressed] = useState(false);
  const [audPressed, setAudPressed] = useState(false);
  const [posFeedback, setPosFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [audFeedback, setAudFeedback] = useState(null);
  const [stats, setStats] = useState(null);
  const [showingStimulus, setShowingStimulus] = useState(false);

  const seqRef = useRef(null);
  const statsRef = useRef({
    posHits: 0, posMisses: 0, posFalseAlarms: 0, posCorrectRejects: 0,
    audHits: 0, audMisses: 0, audFalseAlarms: 0, audCorrectRejects: 0,
  });
  const timeoutRef = useRef(null);
  const trialRef = useRef(0);

  const STIMULUS_TIME = 500;  // ms stimulus shown
  const RESPONSE_TIME = 2500; // ms total per trial

  const clearTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  const startGame = useCallback(() => {
    const seq = generateSequence(trialCount + nLevel, nLevel);
    seqRef.current = seq;
    statsRef.current = {
      posHits: 0, posMisses: 0, posFalseAlarms: 0, posCorrectRejects: 0,
      audHits: 0, audMisses: 0, audFalseAlarms: 0, audCorrectRejects: 0,
    };
    trialRef.current = 0;
    setCurrentTrial(0);
    setGameState('playing');
    setStats(null);
    startSession('nback');
    // Start first trial after short delay
    setTimeout(() => showTrial(0), 600);
  }, [trialCount, nLevel, startSession]);

  const showTrial = useCallback((index) => {
    const seq = seqRef.current;
    if (!seq || index >= seq.positions.length) {
      finishGame();
      return;
    }

    trialRef.current = index;
    setCurrentTrial(index);
    setPosPressed(false);
    setAudPressed(false);
    setPosFeedback(null);
    setAudFeedback(null);

    // Show stimulus
    setActiveCell(seq.positions[index]);
    setActiveLetter(seq.letters[index]);
    setShowingStimulus(true);
    speakLetter(seq.letters[index]);

    // Hide stimulus after STIMULUS_TIME
    timeoutRef.current = setTimeout(() => {
      setActiveCell(-1);
      setShowingStimulus(false);
    }, STIMULUS_TIME);

    // End trial after RESPONSE_TIME → score and advance
    setTimeout(() => {
      scoreTrial(index);
    }, RESPONSE_TIME);
  }, [nLevel]);

  const scoreTrial = useCallback((index) => {
    const seq = seqRef.current;
    if (!seq) return;

    const s = statsRef.current;
    const isPosMatch = seq.posMatches.has(index);
    const isAudMatch = seq.audMatches.has(index);

    // Only score trials where n-back comparison is possible
    if (index >= nLevel) {
      // Position
      if (isPosMatch && posPressed) s.posHits++;
      else if (isPosMatch && !posPressed) s.posMisses++;
      else if (!isPosMatch && posPressed) s.posFalseAlarms++;
      else s.posCorrectRejects++;

      // Audio
      if (isAudMatch && audPressed) s.audHits++;
      else if (isAudMatch && !audPressed) s.audMisses++;
      else if (!isAudMatch && audPressed) s.audFalseAlarms++;
      else s.audCorrectRejects++;
    }

    // Brief feedback
    if (index >= nLevel) {
      const pc = (isPosMatch && posPressed) || (!isPosMatch && !posPressed) ? 'correct' : 'wrong';
      const ac = (isAudMatch && audPressed) || (!isAudMatch && !audPressed) ? 'correct' : 'wrong';
      setPosFeedback(pc);
      setAudFeedback(ac);
    }

    // Advance or finish
    const nextIndex = index + 1;
    if (nextIndex >= seq.positions.length) {
      setTimeout(() => finishGame(), 400);
    } else {
      setTimeout(() => showTrial(nextIndex), 400);
    }
  }, [nLevel, posPressed, audPressed]);

  // We need posPressed/audPressed at score time, so use refs
  const posPressedRef = useRef(false);
  const audPressedRef = useRef(false);

  useEffect(() => { posPressedRef.current = posPressed; }, [posPressed]);
  useEffect(() => { audPressedRef.current = audPressed; }, [audPressed]);

  // Override scoreTrial to use refs
  const scoreTrialReal = useCallback((index) => {
    const seq = seqRef.current;
    if (!seq) return;

    const s = statsRef.current;
    const isPosMatch = seq.posMatches.has(index);
    const isAudMatch = seq.audMatches.has(index);
    const pp = posPressedRef.current;
    const ap = audPressedRef.current;

    if (index >= nLevel) {
      if (isPosMatch && pp) s.posHits++;
      else if (isPosMatch && !pp) s.posMisses++;
      else if (!isPosMatch && pp) s.posFalseAlarms++;
      else s.posCorrectRejects++;

      if (isAudMatch && ap) s.audHits++;
      else if (isAudMatch && !ap) s.audMisses++;
      else if (!isAudMatch && ap) s.audFalseAlarms++;
      else s.audCorrectRejects++;

      const pc = (isPosMatch && pp) || (!isPosMatch && !pp) ? 'correct' : 'wrong';
      const ac = (isAudMatch && ap) || (!isAudMatch && !ap) ? 'correct' : 'wrong';
      setPosFeedback(pc);
      setAudFeedback(ac);
    }

    const nextIndex = index + 1;
    if (nextIndex >= seq.positions.length) {
      setTimeout(() => finishGame(), 400);
    } else {
      setTimeout(() => showTrial(nextIndex), 400);
    }
  }, [nLevel]);

  // Patch showTrial to use scoreTrialReal
  const showTrialPatched = useCallback((index) => {
    const seq = seqRef.current;
    if (!seq || index >= seq.positions.length) {
      finishGame();
      return;
    }

    trialRef.current = index;
    setCurrentTrial(index);
    setPosPressed(false);
    setAudPressed(false);
    posPressedRef.current = false;
    audPressedRef.current = false;
    setPosFeedback(null);
    setAudFeedback(null);
    setActiveCell(seq.positions[index]);
    setActiveLetter(seq.letters[index]);
    setShowingStimulus(true);
    speakLetter(seq.letters[index]);

    timeoutRef.current = setTimeout(() => {
      setActiveCell(-1);
      setShowingStimulus(false);
    }, STIMULUS_TIME);

    setTimeout(() => {
      scoreTrialReal(index);
    }, RESPONSE_TIME);
  }, [scoreTrialReal]);

  const finishGame = useCallback(() => {
    clearTimers();
    const s = { ...statsRef.current };
    setStats(s);
    setGameState('results');
    setActiveCell(-1);
    setShowingStimulus(false);

    const total = s.posHits + s.posMisses + s.posFalseAlarms + s.posCorrectRejects;
    const posAcc = total > 0 ? (s.posHits + s.posCorrectRejects) / total : 0;
    const audAcc = total > 0 ? (s.audHits + s.audCorrectRejects) / total : 0;

    endSession({
      nLevel,
      trials: trialCount,
      positionAccuracy: Math.round(posAcc * 100),
      audioAccuracy: Math.round(audAcc * 100),
      overallAccuracy: Math.round((posAcc + audAcc) / 2 * 100),
      ...s,
    });
  }, [clearTimers, endSession, nLevel, trialCount]);

  // Keyboard shortcuts
  useEffect(() => {
    if (gameState !== 'playing') return;
    const handler = (e) => {
      if (e.key === 'a' || e.key === 'A') {
        setPosPressed(true);
        posPressedRef.current = true;
      }
      if (e.key === 'l' || e.key === 'L') {
        setAudPressed(true);
        audPressedRef.current = true;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameState]);

  // Cleanup
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Start game with patched function
  const startGamePatched = useCallback(() => {
    const seq = generateSequence(trialCount + nLevel, nLevel);
    seqRef.current = seq;
    statsRef.current = {
      posHits: 0, posMisses: 0, posFalseAlarms: 0, posCorrectRejects: 0,
      audHits: 0, audMisses: 0, audFalseAlarms: 0, audCorrectRejects: 0,
    };
    trialRef.current = 0;
    setCurrentTrial(0);
    setGameState('playing');
    setStats(null);
    startSession('nback');
    setTimeout(() => showTrialPatched(0), 600);
  }, [trialCount, nLevel, startSession, showTrialPatched]);

  const totalTrials = seqRef.current ? seqRef.current.positions.length : trialCount + nLevel;
  const progress = gameState === 'playing' ? currentTrial / totalTrials : 0;

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${COLOR}, #e8e8ec)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Dual N-Back
        </h1>
        <p style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          Working memory training · {nLevel}-back
        </p>
      </div>

      {/* Setup screen */}
      {gameState === 'setup' && (
        <>
          {/* N-Level selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              N-level
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setNLevel(n)} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10,
                  border: `1px solid ${nLevel === n ? COLOR + '50' : '#1e1e26'}`,
                  background: nLevel === n ? COLOR + '10' : '#111116',
                  color: nLevel === n ? '#e8e8ec' : '#555',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
              {nLevel === 1 ? 'Beginner — match current with previous' :
               nLevel === 2 ? 'Standard — match current with 2 steps ago' :
               nLevel === 3 ? 'Advanced — match current with 3 steps ago' :
               nLevel === 4 ? 'Expert — high cognitive load' :
               'Elite — near working memory ceiling'}
            </div>
          </div>

          {/* Trial count */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Trials per session
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: '20', value: 20 }, { label: '30', value: 30 }, { label: '50', value: 50 }].map(t => (
                <button key={t.value} onClick={() => setTrialCount(t.value)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1px solid ${trialCount === t.value ? COLOR + '50' : '#1e1e26'}`,
                  background: trialCount === t.value ? COLOR + '10' : '#111116',
                  color: trialCount === t.value ? '#e8e8ec' : '#555',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div style={{
            background: '#111116', borderRadius: 14, padding: 16,
            border: '1px solid #1e1e26', marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 10 }}>How to play</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>
              Each trial shows a position on a 3×3 grid and plays a letter. Your task: identify when the current stimulus matches the one from <span style={{ color: COLOR, fontWeight: 600 }}>{nLevel} steps ago</span>.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#0d0d14' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Position match</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Tap left button or press <span style={{ color: COLOR, fontFamily: "'JetBrains Mono', monospace" }}>A</span></div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#0d0d14' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Audio match</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Tap right button or press <span style={{ color: COLOR, fontFamily: "'JetBrains Mono', monospace" }}>L</span></div>
              </div>
            </div>
          </div>

          {/* Start button */}
          <button onClick={startGamePatched} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR}cc)`,
            border: 'none', color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 24px ${COLOR}30`,
          }}>
            Start {nLevel}-Back Training
          </button>
        </>
      )}

      {/* Playing screen */}
      {gameState === 'playing' && (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                Trial {Math.min(currentTrial + 1, totalTrials)}/{totalTrials}
              </span>
              <span style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                {nLevel}-back
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: '#1a1a22' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: COLOR,
                width: `${progress * 100}%`, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Grid area */}
          <div style={{
            background: '#111116', borderRadius: 16, padding: '24px 20px',
            border: '1px solid #1e1e26', marginBottom: 16,
            boxShadow: showingStimulus ? `0 0 60px ${COLOR}10` : 'none',
            transition: 'box-shadow 0.2s',
          }}>
            {/* Current letter display */}
            <div style={{
              textAlign: 'center', marginBottom: 16,
              fontSize: 28, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: showingStimulus ? COLOR : '#222',
              transition: 'color 0.15s',
              height: 40, lineHeight: '40px',
            }}>
              {showingStimulus ? activeLetter : '·'}
            </div>

            <Grid activeCell={activeCell} />

            {/* N-back indicator */}
            {currentTrial < nLevel && (
              <div style={{
                textAlign: 'center', marginTop: 16,
                fontSize: 11, color: '#555', fontStyle: 'italic',
              }}>
                Memorise — matching starts in {nLevel - currentTrial} trial{nLevel - currentTrial > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Response buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <ResponseButton
              label="Position"
              sublabel="A key"
              active={posPressed}
              correct={posFeedback === 'correct'}
              wrong={posFeedback === 'wrong'}
              disabled={currentTrial < nLevel}
              onPress={() => {
                setPosPressed(true);
                posPressedRef.current = true;
                try { navigator?.vibrate?.(15); } catch {}
              }}
            />
            <ResponseButton
              label="Audio"
              sublabel="L key"
              active={audPressed}
              correct={audFeedback === 'correct'}
              wrong={audFeedback === 'wrong'}
              disabled={currentTrial < nLevel}
              onPress={() => {
                setAudPressed(true);
                audPressedRef.current = true;
                try { navigator?.vibrate?.(15); } catch {}
              }}
            />
          </div>

          {/* Stop button */}
          <button onClick={finishGame} style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: 'none', border: '1px solid #252530',
            color: '#555', fontSize: 12, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            End Session
          </button>
        </>
      )}

      {/* Results screen */}
      {gameState === 'results' && stats && (
        <div style={{
          background: '#111116', borderRadius: 16, padding: 24,
          border: '1px solid #1e1e26',
        }}>
          <Results
            stats={stats}
            nLevel={nLevel}
            onRestart={startGamePatched}
            onClose={() => setGameState('setup')}
          />
        </div>
      )}

      {/* Science card (only on setup) */}
      {gameState === 'setup' && (
        <div style={{
          background: '#111116', borderRadius: 12, padding: 16, marginTop: 20,
          border: '1px solid #1e1e26', fontSize: 12, color: '#555', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 6 }}>How it works</div>
          <span style={{ color: '#888' }}>
            The dual n-back task trains working memory updating — the ability to hold, monitor, and replace information in real time. It engages the dorsolateral prefrontal cortex and fronto-parietal attention networks.
          </span>
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0d0d14', fontSize: 11 }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>Evidence: </span>
            Meta-analysis of 33 RCTs found medium transfer to untrained WM tasks and small but significant effects on fluid intelligence and cognitive control.
            <a href="https://doi.org/10.3758/s13423-016-1217-0" target="_blank" rel="noopener noreferrer" style={{ color: COLOR, marginLeft: 4, textDecoration: 'none', borderBottom: `1px solid ${COLOR}40` }}>
              Soveri et al. (2017) →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
