// Mirrors the alphabet in functions/src/logic.ts (no 0/O, 1/I/L).
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export const JOIN_CODE_LENGTH = 6;

/** Uppercases and strips spacing/dashes; null if the result isn't a well-formed code. */
export function normalizeJoinCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return CODE_PATTERN.test(code) ? code : null;
}

/** Strips characters that can't appear in a code, for live input formatting. */
export function sanitizeJoinCodeInput(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .replace(/[ILO]/g, '')
    .slice(0, JOIN_CODE_LENGTH);
}

export function joinLink(code: string): string {
  return `babycare://join?code=${code}`;
}

/** Accepts a bare code or a `babycare://join?code=XXXXXX` link, e.g. from a scanned QR code. */
export function extractJoinCode(text: string): string | null {
  const trimmed = text.trim();
  const fromLink = /[?&]code=([^&#\s]+)/i.exec(trimmed);
  return normalizeJoinCode(fromLink?.[1] ? decodeURIComponent(fromLink[1]) : trimmed);
}
