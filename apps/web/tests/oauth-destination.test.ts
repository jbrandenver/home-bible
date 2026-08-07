import { describe, expect, it } from 'vitest';
import { DEFAULT_OAUTH_DESTINATION, oauthDestinationPath } from '../lib/auth';

// The OAuth redirect target can originate in a ?next= query string and is
// handed straight to the identity provider, so it is an open-redirect surface.
describe('oauthDestinationPath', () => {
  it('defaults to the dashboard', () => {
    expect(oauthDestinationPath(undefined)).toBe(DEFAULT_OAUTH_DESTINATION);
    expect(oauthDestinationPath(null)).toBe(DEFAULT_OAUTH_DESTINATION);
    expect(oauthDestinationPath('')).toBe(DEFAULT_OAUTH_DESTINATION);
  });

  // Signing up has to go through first-run setup. Hard-coding /dashboard here
  // is what sent every Google and Apple signup straight past the wizard.
  it('allows the wizard, so signup and sign-in can differ', () => {
    expect(oauthDestinationPath('/welcome')).toBe('/welcome');
  });

  it('keeps an ordinary in-app path', () => {
    expect(oauthDestinationPath('/dashboard')).toBe('/dashboard');
  });

  it('refuses another origin', () => {
    for (const hostile of [
      'https://evil.example',
      'http://evil.example/welcome',
      '//evil.example',
      'javascript:alert(1)'
    ]) {
      expect(oauthDestinationPath(hostile)).toBe(DEFAULT_OAUTH_DESTINATION);
    }
  });

  it('refuses values that are not strings', () => {
    expect(oauthDestinationPath(['/welcome'])).toBe(DEFAULT_OAUTH_DESTINATION);
    expect(oauthDestinationPath(42)).toBe(DEFAULT_OAUTH_DESTINATION);
  });

  it('always returns a path that stays on this origin', () => {
    for (const candidate of ['/welcome', 'https://evil.example', '//evil.example', '']) {
      expect(oauthDestinationPath(candidate).startsWith('/')).toBe(true);
      expect(oauthDestinationPath(candidate).startsWith('//')).toBe(false);
    }
  });
});
