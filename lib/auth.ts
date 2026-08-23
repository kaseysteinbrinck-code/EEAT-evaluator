export const SESSION_COOKIE_NAME = "eeat_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Uses Web Crypto (`crypto.subtle`) rather than node:crypto -- this file is
// imported from middleware.ts, which runs on the Edge runtime where the
// Node crypto module isn't available. Web Crypto works in both.

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set.");
  }
  return secret;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedSessionToken(): Promise<string> {
  return hmacHex(getSessionSecret(), "eeat-evaluator-session");
}

/** Manual constant-time string compare -- avoids leaking length/content via timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPasscode(candidate: string): boolean {
  const expected = process.env.PASSCODE;
  if (!expected) {
    throw new Error("PASSCODE environment variable is not set.");
  }
  return timingSafeEqualStr(candidate, expected);
}

export async function getSessionCookieValue(): Promise<string> {
  return expectedSessionToken();
}

export async function isValidSessionCookieValue(
  value: string | undefined | null,
): Promise<boolean> {
  if (!value) return false;
  const expected = await expectedSessionToken();
  return timingSafeEqualStr(value, expected);
}
