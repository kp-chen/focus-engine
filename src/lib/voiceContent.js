// Canonical fixed voice content, shared by the app (runtime playback + the
// SpeechSynthesis fallback) AND scripts/gen-voices.mjs (the ElevenLabs
// pre-render). Keeping this the single source of truth means the committed MP3s
// can never drift from the text the app actually speaks.

// NSDR guided body-scan — each segment is spoken, then the app pauses `pause`
// seconds (scaled to fit the chosen session length).
export const BODY_SCAN_SCRIPT = [
  { text: "Find a comfortable position, lying down or reclined. Allow your eyes to close gently.", pause: 6 },
  { text: "Take a deep breath in through your nose. And slowly exhale through your mouth.", pause: 8 },
  { text: "Again, breathe in deeply. Feel your chest and belly expand. And exhale completely, releasing all tension.", pause: 8 },
  { text: "Bring your awareness to the top of your head. Notice any sensations there. Simply observe without judgment.", pause: 7 },
  { text: "Now move your attention to your forehead. Feel it soften and relax. Let go of any tension you find.", pause: 6 },
  { text: "Allow the relaxation to flow down to your eyes. Feel the muscles around your eyes become heavy and still.", pause: 6 },
  { text: "Bring your awareness to your jaw. Let it drop slightly, creating space between your teeth. Release all holding.", pause: 6 },
  { text: "Now notice your neck and throat. Allow them to soften completely.", pause: 5 },
  { text: "Move your attention to your shoulders. With each exhale, feel them drop further away from your ears.", pause: 7 },
  { text: "Bring awareness to your right arm. From shoulder to elbow, elbow to wrist, wrist to fingertips. Feel it grow heavy.", pause: 8 },
  { text: "Now your left arm. Shoulder, elbow, wrist, fingertips. Let it rest completely.", pause: 7 },
  { text: "Bring your attention to your chest. Feel the gentle rise and fall of your breath. No need to change it.", pause: 7 },
  { text: "Move awareness to your belly. Let it be soft. Release any holding or bracing.", pause: 6 },
  { text: "Now notice your lower back. Let the surface beneath you fully support your weight.", pause: 6 },
  { text: "Bring attention to your hips and pelvis. Allow them to feel heavy and grounded.", pause: 6 },
  { text: "Move your awareness down your right leg. Thigh, knee, shin, ankle, foot. Let it completely relax.", pause: 7 },
  { text: "And your left leg. Thigh, knee, shin, ankle, foot. Feel the weight of your body sinking down.", pause: 7 },
  { text: "Now expand your awareness to your whole body at once. You are fully supported. Fully at rest.", pause: 8 },
  { text: "Stay in this state of deep rest. Your body is restoring. Your mind is quiet.", pause: 10 },
  { text: "When you are ready, begin to deepen your breath. Gently wiggle your fingers and toes.", pause: 8 },
  { text: "Take a full, deep breath in. And open your eyes when you feel ready. Welcome back.", pause: 5 },
];

// Repeated filler segment for sessions longer than the base script. Rendered
// once under the 'filler' key and reused.
export const NSDR_FILLER = {
  text: "Continue to rest deeply. Let each breath carry you further into stillness.",
  pause: 12,
};

// Dual N-Back auditory channel — the spoken letters.
export const NBACK_LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

// Stable manifest key for the segment at position `index` within a session's
// segment list: base segments key by their index, repeated fillers share 'filler'.
export function nsdrSegmentKey(index) {
  return index < BODY_SCAN_SCRIPT.length ? String(index) : 'filler';
}

// Curated ElevenLabs voices offered in the in-app pickers (ids from the
// ElevenLabs voice library). gen-voices.mjs renders each; the app shows the
// rendered set from public/voices/manifest.json. Add/remove here, then `npm run voices`.
export const VOICE_OPTIONS = [
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', desc: 'Velvety, soft' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella', desc: 'Warm, bright' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'Calm, professional' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', desc: 'Clear educator' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'Steady, male' },
  { id: 'Aa6nEBJJMKJwJkCx8VU2', name: 'Quentin', desc: 'Warm narrator, male' },
  { id: 'XfNU2rGpBa01ckF309OY', name: 'Nichalia', desc: 'Bright, friendly' },
  // Add more here, then `npm run voices -- --voices <name>` (each ≈ 3k credits).
];

// Default selections (must be ids present in VOICE_OPTIONS / the manifest).
export const DEFAULT_NSDR_VOICE = 'pFZP5JQG7iQjIQuC4Bku';  // Lily
export const DEFAULT_NBACK_VOICE = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice

// ElevenLabs `speed` voice-setting (0.7–1.2; <1 = slower/calmer). The NSDR body
// scan is rendered slower for a relaxing cadence; N-Back letters stay crisp.
export const NSDR_SPEED = 0.8;
export const LETTER_SPEED = 1.0;
