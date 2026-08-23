import { NextRequest, NextResponse } from "next/server";
import { evaluateContent } from "@/lib/eeat/score";
import { checkEvaluationRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Observed real-world latency for the research+synthesis pipeline: ~1-2.5min,
// well past initial estimates. This requires Vercel Pro with Fluid Compute
// (Hobby hard-caps at 60s regardless of this setting) -- see deployment notes.
export const maxDuration = 300;

const MAX_CONTENT_CHARS = 60000; // generous ceiling well above any realistic article
const MIN_CONTENT_CHARS = 200;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rateLimit = await checkEvaluationRateLimit(ip);
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "unavailable") {
      return NextResponse.json(
        { error: "The tool is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    const message =
      rateLimit.reason === "global"
        ? "This tool has hit its shared daily evaluation limit. Please try again tomorrow."
        : "You've hit your daily evaluation limit. Please try again tomorrow.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  let body: {
    content?: unknown;
    source?: unknown;
    authorLinkedInUrl?: unknown;
    noDefinedAuthor?: unknown;
    publishingSite?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }

  const content = body.content.trim();
  const source = body.source === "paste" ? "paste" : "url";
  const noDefinedAuthor = body.noDefinedAuthor === true;

  let authorLinkedInUrl: string | undefined;
  if (typeof body.authorLinkedInUrl === "string" && body.authorLinkedInUrl.trim()) {
    const candidate = body.authorLinkedInUrl.trim();
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.endsWith("linkedin.com")) {
        return NextResponse.json(
          { error: "Author profile must be a linkedin.com URL." },
          { status: 400 },
        );
      }
      authorLinkedInUrl = candidate;
    } catch {
      return NextResponse.json({ error: "Author profile URL is invalid." }, { status: 400 });
    }
  }

  // For pasted/uploaded content there's no live page to derive authorship
  // from, so we require either a profile or an explicit "no author" flag --
  // a live URL submission skips this since the tool discovers it itself.
  if (source === "paste" && !authorLinkedInUrl && !noDefinedAuthor) {
    return NextResponse.json(
      { error: "Provide the author's LinkedIn profile, or confirm there's no defined author." },
      { status: 400 },
    );
  }

  const publishingSite =
    typeof body.publishingSite === "string" && body.publishingSite.trim()
      ? body.publishingSite.trim().slice(0, 200)
      : undefined;

  if (content.length < MIN_CONTENT_CHARS) {
    return NextResponse.json(
      {
        error: `Content is too short to evaluate meaningfully (minimum ${MIN_CONTENT_CHARS} characters).`,
      },
      { status: 400 },
    );
  }

  if (content.length > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      {
        error: `Content is too long (max ~${MAX_CONTENT_CHARS.toLocaleString()} characters). Please submit a single article.`,
      },
      { status: 400 },
    );
  }

  try {
    const evaluation = await evaluateContent(content, {
      authorLinkedInUrl,
      noDefinedAuthor,
      publishingSite,
    });
    return NextResponse.json(evaluation);
  } catch (err) {
    console.error("EEAT evaluation failed:", err);
    const message = err instanceof Error ? err.message : "Evaluation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
