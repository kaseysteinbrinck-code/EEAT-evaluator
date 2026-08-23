"use client";

import { useState } from "react";
import type { EeatEvaluation } from "@/lib/eeat/schema";
import { GradeBadge } from "./GradeBadge";

type PillarKey = "experience" | "expertise" | "authoritativeness" | "trust";

const PILLAR_LABELS: Record<PillarKey, string> = {
  experience: "Experience",
  expertise: "Expertise",
  authoritativeness: "Authoritativeness",
  trust: "Trust",
};

function StatusIcon({ status }: { status: "pass" | "warning" | "fail" }) {
  const map = {
    pass: { symbol: "✓", className: "bg-emerald-100 text-emerald-700" },
    warning: { symbol: "!", className: "bg-amber-100 text-amber-700" },
    fail: { symbol: "✕", className: "bg-red-100 text-red-700" },
  } as const;
  const { symbol, className } = map[status];
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${className}`}
    >
      {symbol}
    </span>
  );
}

function PillarCard({ pillarKey, evaluation }: { pillarKey: PillarKey; evaluation: EeatEvaluation }) {
  const result = evaluation.pillars[pillarKey];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">{PILLAR_LABELS[pillarKey]}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{result.score}/100</span>
          <GradeBadge grade={result.grade} size="sm" />
        </div>
      </div>

      {pillarKey === "authoritativeness" && "subSignals" in result && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-neutral-50 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Pre-existing authority
            </p>
            <p className="text-sm font-semibold text-neutral-700">
              {result.subSignals.preExistingAuthority.score}/100
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Content depth
            </p>
            <p className="text-sm font-semibold text-neutral-700">
              {result.subSignals.contentDepth.score}/100
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{result.rationale}</p>

      <ul className="mt-4 space-y-2">
        {result.checklist.map((item, i) => (
          <li key={i} className="flex gap-2">
            <StatusIcon status={item.status} />
            <div>
              <p className="text-xs font-medium text-neutral-700">{item.label}</p>
              <p className="text-xs text-neutral-500">{item.note}</p>
            </div>
          </li>
        ))}
      </ul>

      {result.suggestions.length > 0 && (
        <div className="mt-4 rounded-lg bg-brand/5 p-3">
          <p className="text-xs font-semibold text-brand">Suggested improvements</p>
          <ul className="mt-1 space-y-1">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-neutral-600">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ReportView({
  evaluation,
  onReset,
}: {
  evaluation: EeatEvaluation;
  onReset: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const { overall, contentMeta, researchNotes } = evaluation;

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evaluation),
      });
      if (!res.ok) throw new Error("Failed to generate PDF.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${(contentMeta.title ?? "eeat-evaluation").replace(/[^a-z0-9]+/gi, "-")}-eeat-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <GradeBadge grade={overall.grade} size="lg" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Overall E-E-A-T
              </p>
              <p className="text-lg font-semibold text-neutral-800">{overall.score}/100</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {downloading ? "Generating..." : "Download PDF"}
            </button>
            <button
              onClick={onReset}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
            >
              Evaluate another
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-neutral-600">{overall.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {contentMeta.title && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
              {contentMeta.title}
            </span>
          )}
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
            {contentMeta.wordCount.toLocaleString()} words
          </span>
          {contentMeta.detectedBrand && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
              Brand: {contentMeta.detectedBrand}
            </span>
          )}
          {contentMeta.detectedAuthor && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
              Author: {contentMeta.detectedAuthor}
            </span>
          )}
          {contentMeta.ymyl && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              YMYL topic
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <PillarCard pillarKey="experience" evaluation={evaluation} />
        <PillarCard pillarKey="expertise" evaluation={evaluation} />
        <PillarCard pillarKey="authoritativeness" evaluation={evaluation} />
        <PillarCard pillarKey="trust" evaluation={evaluation} />
      </div>

      {researchNotes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-700">What We Checked</h3>
          <ul className="mt-3 space-y-3">
            {researchNotes.map((note, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-neutral-700">
                  {note.query}
                  {note.source && <span className="font-normal text-neutral-400"> — {note.source}</span>}
                </p>
                <p className="text-neutral-500">{note.findingSummary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
