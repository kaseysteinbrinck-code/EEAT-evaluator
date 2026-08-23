import { NextRequest, NextResponse } from "next/server";
import { extractUrl } from "@/lib/extract/url";
import { extractDocx } from "@/lib/extract/docx";
import { extractPdf } from "@/lib/extract/pdf";

export const runtime = "nodejs"; // mammoth/pdf-parse need Node APIs, not the Edge runtime

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const MIN_TEXT_CHARS = 50;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (typeof body.url !== "string" || !body.url) {
        return NextResponse.json({ error: "A URL is required." }, { status: 400 });
      }
      const { text, title } = await extractUrl(body.url);
      return NextResponse.json({ text, title });
    }

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "A file is required." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File is too large (max 15MB)." }, { status: 400 });
      }

      const name = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      let text: string;
      if (name.endsWith(".docx")) {
        text = await extractDocx(buffer);
      } else if (name.endsWith(".pdf")) {
        text = await extractPdf(buffer);
      } else {
        return NextResponse.json(
          { error: "Only .docx and .pdf files are supported." },
          { status: 400 },
        );
      }

      if (!text || text.trim().length < MIN_TEXT_CHARS) {
        return NextResponse.json(
          { error: "Couldn't extract readable text from that file." },
          { status: 400 },
        );
      }

      return NextResponse.json({ text: text.trim(), title: null });
    }

    return NextResponse.json({ error: "Unsupported content type." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
