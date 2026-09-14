import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { lookup } from "dns/promises";
import { isIP } from "net";

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 10 * 1024 * 1024; // 10MB

/** Blocks loopback, private, link-local, and other non-public ranges to prevent SSRF. */
function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 -- recheck the embedded v4 address
      const v4 = normalized.split(":").pop();
      if (v4 && isIP(v4) === 4) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true; // couldn't determine -- fail closed
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") {
    throw new Error("Requests to localhost are not allowed.");
  }
  const directIpVersion = isIP(hostname);
  if (directIpVersion) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Requests to private or reserved IP addresses are not allowed.");
    }
    return;
  }
  const records = await lookup(hostname, { all: true });
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error("This URL resolves to a private or reserved address and cannot be fetched.");
    }
  }
}

export interface ExtractedUrl {
  text: string;
  title: string | null;
}

export async function extractUrl(rawUrl: string): Promise<ExtractedUrl> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  await assertPublicHost(parsed.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      // A realistic browser UA reduces false blocks on UA-sensitive sites.
      // Doesn't help against IP-based/anti-scraper blocking (see the 403
      // handling below) -- some hosts block by network origin regardless
      // of what the request claims to be.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch {
    throw new Error("Could not reach that URL. Check it's correct and publicly accessible.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 403 || res.status === 999) {
    throw new Error(
      "That site is blocking automated requests (common with hosting/security firewalls " +
        "that reject non-browser traffic regardless of who's asking) -- this isn't something " +
        "we can work around reliably. Use the Paste/Upload tab for this article instead.",
    );
  }

  if (!res.ok) {
    throw new Error(`The page returned an error (HTTP ${res.status}).`);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
    throw new Error("That page is too large to process.");
  }

  const html = await res.text();
  if (html.length > MAX_HTML_BYTES) {
    throw new Error("That page is too large to process.");
  }

  const dom = new JSDOM(html, { url: parsed.toString() });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 50) {
    throw new Error("Couldn't extract readable article content from that page.");
  }

  return { text: article.textContent.trim(), title: article.title ?? null };
}
