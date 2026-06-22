import { describe, it, expect } from 'vitest';
import { BODY_SCAN_SCRIPT, NSDR_FILLER, NBACK_LETTERS, nsdrSegmentKey } from './voiceContent';

describe('voiceContent', () => {
  it('keys base segments by index and repeated fillers as "filler"', () => {
    expect(nsdrSegmentKey(0)).toBe('0');
    expect(nsdrSegmentKey(BODY_SCAN_SCRIPT.length - 1)).toBe(String(BODY_SCAN_SCRIPT.length - 1));
    expect(nsdrSegmentKey(BODY_SCAN_SCRIPT.length)).toBe('filler');
    expect(nsdrSegmentKey(BODY_SCAN_SCRIPT.length + 5)).toBe('filler');
  });

  it('has non-empty text + numeric pause for every segment', () => {
    for (const seg of [...BODY_SCAN_SCRIPT, NSDR_FILLER]) {
      expect(typeof seg.text).toBe('string');
      expect(seg.text.length).toBeGreaterThan(0);
      expect(typeof seg.pause).toBe('number');
    }
  });

  it('exposes 8 distinct single-character letters', () => {
    expect(NBACK_LETTERS).toHaveLength(8);
    expect(new Set(NBACK_LETTERS).size).toBe(8);
    expect(NBACK_LETTERS.every(l => /^[A-Z]$/.test(l))).toBe(true);
  });
});
