import { NextRequest, NextResponse } from "next/server";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: ["/api/:path*"],
};

// The auth endpoint itself must stay reachable without a session cookie --
// it's how a session cookie gets issued in the first place.
const OPEN_PATHS = ["/api/auth"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSessionCookieValue(cookie);
  if (!valid) {
    return NextResponse.json(
      { error: "Unauthorized. Enter the passcode first." },
      { status: 401 },
    );
  }

  return NextResponse.next();
}
