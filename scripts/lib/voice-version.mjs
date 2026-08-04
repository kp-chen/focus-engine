// Content-versioned voice URLs.
//
// The service worker runtime-caches /voices/*.mp3 with CacheFirst and a one-year
// expiry (vite.config.js). The app shell gets Vite's content hashes and updates
// cleanly, but the MP3s are referenced by stable path — so re-rendering a voice
// and redeploying left returning/offline users playing the OLD audio until the
// entry expired or they cleared storage. Nothing in the manifest signalled the
// change, because the path was identical.
//
// Fix: put a short content hash of each MP3 in its manifest URL
// (`/voices/lily/nsdr/00.mp3?v=1a2b3c4d`). A re-rendered file yields a new query,
// which is a different cache key, so the new audio is fetched while every
// unchanged file keeps its existing cache entry. The service worker's matcher
// tests `url.pathname`, which excludes the query, so these URLs still match the
// voice-audio rule — and with immutable, versioned URLs, CacheFirst plus a long
// expiry becomes the correct strategy rather than a staleness trap.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Short content hash of a file, or null when it is missing. */
export function contentHash(absPath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex').slice(0, 8);
  } catch {
    return null;
  }
}

/**
 * Build the manifest URL for a voice file, stamped with its content hash.
 * Falls back to the bare path if the file cannot be read, so a partial render
 * still produces a usable (if unversioned) manifest rather than throwing.
 *
 * @param {string} outDir  absolute path to public/voices
 * @param {string} file    path relative to outDir, e.g. 'lily/nsdr/00.mp3'
 */
export function versionedUrl(outDir, file) {
  const hash = contentHash(path.join(outDir, file));
  const url = `/voices/${file}`;
  return hash ? `${url}?v=${hash}` : url;
}

/** Strip any existing ?v= stamp so re-stamping is idempotent. */
function bare(url) {
  return typeof url === 'string' ? url.split('?')[0] : url;
}

/**
 * Re-stamp every URL in an existing manifest from the files currently on disk.
 * Idempotent: running it twice yields the same manifest. Returns a summary.
 *
 * @param {string} outDir absolute path to public/voices
 */
export function stampManifest(outDir) {
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let stamped = 0;
  let missing = 0;
  let changed = 0;

  for (const group of ['nsdr', 'letters']) {
    for (const voiceId of Object.keys(manifest[group] || {})) {
      const entries = manifest[group][voiceId];
      for (const key of Object.keys(entries)) {
        const before = entries[key];
        const file = bare(before).replace(/^\/voices\//, '');
        const after = versionedUrl(outDir, file);
        if (after.includes('?v=')) stamped++; else missing++;
        if (after !== before) changed++;
        entries[key] = after;
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { stamped, missing, changed, manifestPath };
}
