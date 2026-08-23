import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { EeatEvaluationSchema } from "@/lib/eeat/schema";
import { ReportDocument } from "@/lib/pdf/ReportDocument";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = EeatEvaluationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Evaluation payload is malformed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const buffer = await renderToBuffer(ReportDocument({ evaluation: parsed.data }));
    const safeTitle = (parsed.data.contentMeta.title ?? "eeat-evaluation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "eeat-evaluation";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}-eeat-report.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json({ error: "Failed to generate PDF report." }, { status: 500 });
  }
}
