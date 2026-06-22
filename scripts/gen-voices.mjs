// gen-voices.mjs — pre-render the app's fixed voice content to ElevenLabs MP3s.
//
// Renders the NSDR body-scan segments + filler (one warm narration voice) and the
// Dual N-Back letters (one clear voice) into public/voices/, plus a manifest the
// app reads at runtime. Mirrors the morning-brief video stack's ElevenLabs usage
// (xi-api-key header, /v1/text-to-speech/{id}, eleven_multilingual_v2).
//
//   node scripts/gen-voices.mjs --env C:/Dev/morning-brief/video/.env
//   node scripts/gen-voices.mjs --env <path> --force          # re-render everything
//   node scripts/gen-voices.mjs --env <path> --nsdr-voice <id> --letter-voice <id>
//
// The committed OUTPUT is the MP3s + manifest.json — never the API key. Text edits
// in src/lib/voiceContent.js need --force (or delete the stale files) to re-render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BODY_SCAN_SCRIPT, NSDR_FILLER, NBACK_LETTERS } from '../src/lib/voiceContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'voices');

// KP's morning-brief roster: Lily = "Velvety Actress" (warm NSDR narration),
// Alice = "Clear, Engaging Educator" (crisp N-Back letters).
const DEFAULT_NSDR_VOICE = 'pFZP5JQG7iQjIQuC4Bku';   // Lily
const DEFAULT_LETTER_VOICE = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice

function parseArgs(argv) {
  const a = { env: null, force: false, nsdrVoice: DEFAULT_NSDR_VOICE, letterVoice: DEFAULT_LETTER_VOICE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') a.env = argv[++i];
    else if (argv[i] === '--force') a.force = true;
    else if (argv[i] === '--nsdr-voice') a.nsdrVoice = argv[++i];
    else if (argv[i] === '--letter-voice') a.letterVoice = argv[++i];
  }
  return a;
}

/**
 * @param {string|null} envPath
 * @returns {Record<string, string|undefined>}
 */
function loadEnv(envPath) {
  /** @type {Record<string, string|undefined>} */
  const fileVals = {};
  const candidates = [envPath, path.join(ROOT, '.env')].filter(Boolean);
  for (const p of candidates) {
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const i = s.indexOf('=');
      if (i > 0) {
        let v = s.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        fileVals[s.slice(0, i).trim()] = v;
      }
    }
    break; // first readable file wins
  }
  // File values OVERRIDE process.env — a stale/empty ELEVENLABS_API_KEY in the
  // environment (the billing-guard shadowing pattern) must not win over the .env.
  return { ...process.env, ...fileVals };
}

async function tts(key, model, voiceId, text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

async function render(key, model, voiceId, text, file, force) {
  const abs = path.join(OUT, file);
  if (!force && fs.existsSync(abs)) {
    process.stdout.write(`  skip ${file} (exists)\n`);
    return;
  }
  process.stdout.write(`  render ${file} … `);
  const buf = await tts(key, model, voiceId, text);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  process.stdout.write(`${(buf.length / 1024).toFixed(0)} KB\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(args.env);
  const KEY = env.ELEVENLABS_API_KEY;
  const MODEL = env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  if (!KEY) {
    console.error('ELEVENLABS_API_KEY not found. Pass --env <path to a .env> (e.g. the morning-brief video .env).');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {
    generatedWith: { model: MODEL, nsdrVoice: args.nsdrVoice, letterVoice: args.letterVoice },
    nsdr: {},
    letters: {},
  };

  console.log(`NSDR narration (voice ${args.nsdrVoice}):`);
  for (let i = 0; i < BODY_SCAN_SCRIPT.length; i++) {
    const file = `nsdr/${String(i).padStart(2, '0')}.mp3`;
    await render(KEY, MODEL, args.nsdrVoice, BODY_SCAN_SCRIPT[i].text, file, args.force);
    manifest.nsdr[String(i)] = `/voices/${file}`;
  }
  await render(KEY, MODEL, args.nsdrVoice, NSDR_FILLER.text, 'nsdr/filler.mp3', args.force);
  manifest.nsdr.filler = '/voices/nsdr/filler.mp3';

  console.log(`N-Back letters (voice ${args.letterVoice}):`);
  for (const letter of NBACK_LETTERS) {
    const file = `letters/${letter}.mp3`;
    await render(KEY, MODEL, args.letterVoice, letter, file, args.force);
    manifest.letters[letter] = `/voices/${file}`;
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nwrote public/voices/manifest.json (${BODY_SCAN_SCRIPT.length} segments + filler + ${NBACK_LETTERS.length} letters)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
