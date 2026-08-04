// Re-stamp public/voices/manifest.json with each MP3's current content hash.
//
// `npm run voices` stamps URLs as it renders, so this is only needed to backfill
// a manifest written before versioning existed, or to repair one after the audio
// files were changed by any other means. It needs no API key and touches no
// audio — it only rewrites the manifest's URLs. Idempotent.
//
// Usage: npm run voices:version

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampManifest } from './lib/voice-version.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'voices');

const { stamped, missing, changed, manifestPath } = stampManifest(OUT);

console.log(`stamped   ${stamped} urls with a content hash`);
if (missing) console.log(`MISSING   ${missing} files referenced by the manifest are not on disk (left unversioned)`);
console.log(`changed   ${changed} entries`);
console.log(`wrote     ${manifestPath}`);
