/**
 * Email validation.
 *
 * The HTML5 `type="email"` constraint accepts garbage like `foo@a` because
 * the spec only requires one `@` and one character on each side. We want
 * stricter:
 *   - local part: anything that isn't whitespace or @
 *   - exactly one @
 *   - domain: must contain a dot
 *   - TLD: ≥ 2 chars, letters only (matches every real TLD)
 *
 * Catches the original repro `testingreg052826c` (no @, no domain) and
 * `foo@bar` (no TLD). Doesn't check DNS-MX — that needs a backend or a
 * 3rd-party API, neither of which is in scope pre-launch.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value) {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (trimmed.length > 254) return false; // RFC 5321 max
  return EMAIL_RE.test(trimmed);
}
