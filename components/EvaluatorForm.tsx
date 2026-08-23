"use client";

import { useEffect, useRef, useState } from "react";
import type { EeatEvaluation } from "@/lib/eeat/schema";

type Tab = "paste" | "url";
type PasteMode = "text" | "file";

const STAGES = [
  "Reading article...",
  "Researching author & claims...",
  "Scoring against the QRG...",
  "Finalizing report...",
];

async function readJsonSafely(res: Response): Promise<{ error?: string }> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function EvaluatorForm({
  onResult,
  onUnauthorized,
}: {
  onResult: (evaluation: EeatEvaluation) => void;
  onUnauthorized: () => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [pasteMode, setPasteMode] = useState<PasteMode>("text");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [authorLinkedInUrl, setAuthorLinkedInUrl] = useState("");
  const [noDefinedAuthor, setNoDefinedAuthor] = useState(false);
  const [publishingSite, setPublishingSite] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      stageTimer.current = setInterval(() => {
        setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
      }, 6000);
    } else if (stageTimer.current) {
      clearInterval(stageTimer.current);
    }
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [loading]);

  async function extractText(): Promise<{ text: string; title: string | null }> {
    if (tab === "url") {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.status === 401) throw new UnauthorizedError();
      if (!res.ok) throw new Error((await readJsonSafely(res)).error ?? "Couldn't fetch that URL.");
      return res.json();
    }

    if (pasteMode === "file") {
      if (!file) throw new Error("Choose a file first.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      if (res.status === 401) throw new UnauthorizedError();
      if (!res.ok)
        throw new Error((await readJsonSafely(res)).error ?? "Couldn't read that file.");
      return res.json();
    }

    return { text: pastedText, title: null };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStageIndex(0);
    setLoading(true);
    try {
      const { text } = await extractText();

      const evalRes = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          source: tab,
          authorLinkedInUrl:
            tab === "paste" && !noDefinedAuthor && authorLinkedInUrl ? authorLinkedInUrl : undefined,
          noDefinedAuthor: tab === "paste" ? noDefinedAuthor : undefined,
          publishingSite: tab === "paste" && publishingSite ? publishingSite : undefined,
        }),
      });

      if (evalRes.status === 401) throw new UnauthorizedError();
      if (!evalRes.ok) {
        throw new Error((await readJsonSafely(evalRes)).error ?? "Evaluation failed.");
      }

      const evaluation: EeatEvaluation = await evalRes.json();
      onResult(evaluation);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const hasContent =
    tab === "url" ? url.trim().length > 0 : pasteMode === "text" ? pastedText.trim().length >= 200 : file !== null;
  const hasAuthorInfo = noDefinedAuthor || authorLinkedInUrl.trim().length > 0;
  const canSubmit = tab === "url" ? hasContent : hasContent && hasAuthorInfo;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex gap-1 rounded-lg bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setTab("paste")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "paste" ? "bg-white text-brand shadow-sm" : "text-neutral-500"
          }`}
        >
          Paste / Upload
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "url" ? "bg-white text-brand shadow-sm" : "text-neutral-500"
          }`}
        >
          Live URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {tab === "paste" ? (
          <div className="space-y-4">
            <div className="flex gap-1 text-sm">
              <button
                type="button"
                onClick={() => setPasteMode("text")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  pasteMode === "text" ? "bg-brand/10 text-brand" : "text-neutral-500"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setPasteMode("file")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  pasteMode === "file" ? "bg-brand/10 text-brand" : "text-neutral-500"
                }`}
              >
                Upload file
              </button>
            </div>

            {pasteMode === "text" ? (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your article's markdown or plain text here..."
                rows={12}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            ) : (
              <div>
                <input
                  type="file"
                  accept=".docx,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
                />
                <p className="mt-1 text-xs text-neutral-400">.docx or .pdf, up to 15MB</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Author&apos;s LinkedIn profile
              </label>
              <input
                type="url"
                value={authorLinkedInUrl}
                onChange={(e) => setAuthorLinkedInUrl(e.target.value)}
                disabled={noDefinedAuthor}
                placeholder="https://www.linkedin.com/in/..."
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-neutral-100 disabled:text-neutral-400"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Give us the author&apos;s profile and we&apos;ll check it out.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={noDefinedAuthor}
                  onChange={(e) => {
                    setNoDefinedAuthor(e.target.checked);
                    if (e.target.checked) setAuthorLinkedInUrl("");
                  }}
                  className="rounded border-border"
                />
                No defined author for this piece
              </label>
              {noDefinedAuthor && (
                <p className="mt-1 text-xs text-amber-600">
                  Note: Undisclosed authorship is a quality signal that will weigh down certain
                  scores.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Publishing site / brand{" "}
                <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                type="text"
                value={publishingSite}
                onChange={(e) => setPublishingSite(e.target.value)}
                placeholder="e.g. woocommerce.com, or the brand name"
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Where will this be published? We can verify brand claims and check existing
                topical authority.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-neutral-700">Article URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/blog/my-article"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1 text-xs text-neutral-400">
              We&apos;ll pull the article content and look for the author&apos;s LinkedIn
              ourselves as part of research.
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="mt-6 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? STAGES[stageIndex] : "Evaluate"}
        </button>

        {loading && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full animate-pulse rounded-full bg-brand" style={{ width: "60%" }} />
          </div>
        )}
      </form>
    </div>
  );
}

class UnauthorizedError extends Error {}
