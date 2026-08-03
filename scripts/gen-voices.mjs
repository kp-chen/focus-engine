// gen-voices.mjs — pre-render the app's fixed voice content to ElevenLabs MP3s.
//
// Renders each voice in VOICE_OPTIONS (src/lib/voiceContent.js): the NSDR body
// scan + filler at a slow, relaxing cadence, and the Dual N-Back letters at
// normal speed. Output goes to public/voices/<slug>/{nsdr,letters}/ plus a
// manifest the app reads to populate the in-app voice pickers. Uses the
// ElevenLabs REST API (xi-api-key, /v1/text-to-speech, eleven_multilingual_v2)
// with the `speed` voice-setting.
//
//   node scripts/gen-voices.mjs                            # reads ./.env
//   npm run voices -- --env <path>                       # render all VOICE_OPTIONS
//   npm run voices -- --env <path> --voices Lily,Bella   # render/add a subset (merges)
//   npm run voices -- --env <path> --force               # re-render existing files
//   npm run voices -- --env <path> --nsdr-speed 0.85     # tune the narration cadence
//
// The manifest is written after EACH voice, so a mid-run stop (e.g. the key's
// credit quota) still leaves a valid manifest of the voices completed so far.
// Committed OUTPUT = MP3s + manifest.json, never the API key.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BODY_SCAN_SCRIPT, NSDR_FILLER, NBACK_LETTERS,
  VOICE_OPTIONS, NSDR_SPEED, LETTER_SPEED,
} from '../src/lib/voiceContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'voices');

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function parseArgs(argv) {
  const a = { env: null, force: false, voices: null, nsdrSpeed: NSDR_SPEED };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') a.env = argv[++i];
    else if (argv[i] === '--force') a.force = true;
    else if (argv[i] === '--voices') a.voices = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (argv[i] === '--nsdr-speed') a.nsdrSpeed = Number(argv[++i]);
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
  // File values OVERRIDE process.env — a stale/empty ELEVENLABS_API_KEY
  // inherited from the environment must not win over the .env.
  return { ...process.env, ...fileVals };
}

async function tts(key, model, voiceId, text, speed) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

async function render(key, model, voiceId, text, speed, file, force) {
  const abs = path.join(OUT, file);
  if (!force && fs.existsSync(abs)) {
    process.stdout.write(`  skip ${file}\n`);
    return;
  }
  process.stdout.write(`  render ${file} … `);
  const buf = await tts(key, model, voiceId, text, speed);
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
    console.error('ELEVENLABS_API_KEY not found. Copy .env.example to .env and fill in a key, or pass --env <path to a .env>.');
    process.exit(1);
  }

  let voices = VOICE_OPTIONS;
  if (args.voices) {
    const want = new Set(args.voices.map(s => s.toLowerCase()));
    voices = VOICE_OPTIONS.filter(v => want.has(v.id.toLowerCase()) || want.has(v.name.toLowerCase()));
    if (!voices.length) { console.error(`No VOICE_OPTIONS match: ${args.voices.join(', ')}`); process.exit(1); }
  }

  fs.mkdirSync(OUT, { recursive: true });

  const manifest = {
    model: MODEL,
    nsdrSpeed: args.nsdrSpeed,
    voices: /** @type {{id:string,name:string,desc:string}[]} */ ([]),
    nsdr: /** @type {Record<string, Record<string,string>>} */ ({}),
    letters: /** @type {Record<string, Record<string,string>>} */ ({}),
  };

  // Write the manifest, merging with any existing same-schema manifest on disk so
  // a subset render (--voices X) adds/updates without dropping earlier voices.
  const persist = () => {
    let out = manifest;
    try {
      const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
      if (Array.isArray(prev.voices) && prev.nsdr && typeof prev.nsdr === 'object'
        && prev.letters && typeof prev.letters === 'object') {
        const byId = new Map([...prev.voices, ...manifest.voices].map(v => [v.id, v]));
        out = {
          model: manifest.model,
          nsdrSpeed: manifest.nsdrSpeed,
          voices: [...byId.values()],
          nsdr: { ...prev.nsdr, ...manifest.nsdr },
          letters: { ...prev.letters, ...manifest.letters },
        };
      }
    } catch { /* no prior / different schema — write fresh */ }
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(out, null, 2));
  };

  for (const v of voices) {
    const slug = slugify(v.name);
    console.log(`\n${v.name} (${v.id}) -> ${slug}/  [NSDR speed ${args.nsdrSpeed}]`);
    manifest.nsdr[v.id] = {};
    manifest.letters[v.id] = {};
    for (let i = 0; i < BODY_SCAN_SCRIPT.length; i++) {
      const file = `${slug}/nsdr/${String(i).padStart(2, '0')}.mp3`;
      await render(KEY, MODEL, v.id, BODY_SCAN_SCRIPT[i].text, args.nsdrSpeed, file, args.force);
      manifest.nsdr[v.id][String(i)] = `/voices/${file}`;
    }
    await render(KEY, MODEL, v.id, NSDR_FILLER.text, args.nsdrSpeed, `${slug}/nsdr/filler.mp3`, args.force);
    manifest.nsdr[v.id].filler = `/voices/${slug}/nsdr/filler.mp3`;
    for (const letter of NBACK_LETTERS) {
      const file = `${slug}/letters/${letter}.mp3`;
      await render(KEY, MODEL, v.id, letter, LETTER_SPEED, file, args.force);
      manifest.letters[v.id][letter] = `/voices/${file}`;
    }
    // Only now mark the voice available, and persist — a crash before here leaves
    // the prior (complete) voices intact in the manifest.
    manifest.voices.push({ id: v.id, name: v.name, desc: v.desc });
    persist();
    console.log(`  ✓ ${v.name} done`);
  }

  console.log(`\nwrote public/voices/manifest.json — voices: ${manifest.voices.map(v => v.name).join(', ') || '(none)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
