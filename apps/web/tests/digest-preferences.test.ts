import { describe, expect, it } from 'vitest';
import {
  DIGEST_FREQUENCIES,
  DIGEST_FREQUENCY_LABELS,
  type DigestFrequency
} from '../lib/digestPreferences';

describe('reminder email frequency', () => {
  it('offers off, monthly and weekly — and nothing more', () => {
    expect([...DIGEST_FREQUENCIES]).toEqual(['off', 'monthly', 'weekly']);
  });

  it('lists monthly before weekly, so the calmer option reads as the norm', () => {
    // The app's own dashboard digest looks 14-60 days ahead, which is a monthly
    // horizon. Weekly is for a busy home, not the default expectation.
    expect(DIGEST_FREQUENCIES.indexOf('monthly')).toBeLessThan(
      DIGEST_FREQUENCIES.indexOf('weekly')
    );
  });

  it('labels every frequency in plain language, with no jargon', () => {
    for (const frequency of DIGEST_FREQUENCIES) {
      const label = DIGEST_FREQUENCY_LABELS[frequency as DigestFrequency];
      expect(label).toBeTruthy();
      expect(label.toLowerCase()).not.toContain('digest');
      expect(label.toLowerCase()).not.toContain('cron');
    }
  });

  it('says plainly when emails are switched off', () => {
    expect(DIGEST_FREQUENCY_LABELS.off).toBe('No reminder emails');
  });
});
