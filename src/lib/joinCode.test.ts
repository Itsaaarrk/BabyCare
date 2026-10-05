import { extractJoinCode, joinLink, normalizeJoinCode, sanitizeJoinCodeInput } from './joinCode';

describe('normalizeJoinCode', () => {
  it('accepts codes however they are typed', () => {
    expect(normalizeJoinCode('K7M4P2')).toBe('K7M4P2');
    expect(normalizeJoinCode('k7m4p2')).toBe('K7M4P2');
    expect(normalizeJoinCode(' k7m - 4p2 ')).toBe('K7M4P2');
  });

  it('rejects wrong length and ambiguous characters', () => {
    expect(normalizeJoinCode('K7M4P')).toBeNull();
    expect(normalizeJoinCode('K7M4P22')).toBeNull();
    expect(normalizeJoinCode('K7M4P0')).toBeNull();
    expect(normalizeJoinCode('K7M4PO')).toBeNull();
    expect(normalizeJoinCode('K7M4P1')).toBeNull();
    expect(normalizeJoinCode('')).toBeNull();
  });
});

describe('sanitizeJoinCodeInput', () => {
  it('uppercases, drops invalid characters and caps the length', () => {
    expect(sanitizeJoinCodeInput('k7m-4p2xyz')).toBe('K7M4P2');
    expect(sanitizeJoinCodeInput('i1l0o')).toBe('');
  });
});

describe('extractJoinCode', () => {
  it('reads a bare code or a scanned link', () => {
    expect(extractJoinCode('K7M4P2')).toBe('K7M4P2');
    expect(extractJoinCode(joinLink('K7M4P2'))).toBe('K7M4P2');
    expect(extractJoinCode('https://example.com/join?x=1&code=k7m4p2')).toBe('K7M4P2');
  });

  it('rejects QR codes that are not invitations', () => {
    expect(extractJoinCode('https://example.com')).toBeNull();
    expect(extractJoinCode('babycare://join?code=NOPE')).toBeNull();
    expect(extractJoinCode('hello world')).toBeNull();
  });
});
