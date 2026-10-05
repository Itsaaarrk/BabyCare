import { cleanLegalUrl } from './legal';

describe('cleanLegalUrl', () => {
  it('accepts a plain https address and trims spaces', () => {
    expect(cleanLegalUrl('https://example.com/privacy')).toBe('https://example.com/privacy');
    expect(cleanLegalUrl('  https://example.com/privacy  ')).toBe('https://example.com/privacy');
  });

  it('refuses anything that is not https, or is not a single address', () => {
    for (const bad of [
      undefined,
      '',
      '   ',
      'http://example.com',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'intent://evil#Intent;end',
      'example.com/privacy',
      'https://exa mple.com',
      'https://example.com https://evil.example',
      'https://',
    ]) {
      expect(cleanLegalUrl(bad)).toBe('');
    }
  });
});
