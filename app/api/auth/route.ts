import { NextRequest, NextResponse } from "next/server";
import {
  checkPasscode,
  getSessionCookieValue,
  isValidSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { checkAuthAttemptRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await isValidSessionCookieValue(cookie);
  return NextResponse.json({ authenticated });
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const withinLimit = await checkAuthAttemptRateLimit(ip);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: { passcode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.passcode !== "string" || body.passcode.length === 0) {
    return NextResponse.json({ error: "Passcode required." }, { status: 400 });
  }

  let ok: boolean;
  try {
    ok = checkPasscode(body.passcode);
  } catch {
    return NextResponse.json({ error: "Server is misconfigured." }, { status: 500 });
  }

  if (!ok) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  const value = await getSessionCookieValue();
  res.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
