import { readFileSync } from "fs";
import { join } from "path";

let cached: string | null = null;

/**
 * Full text of Google's Search Quality Rater Guidelines (Sept 11, 2025),
 * extracted once from knowledge-base/search-quality-rater-guidelines.pdf.
 * This is the primary, authoritative scoring source — see lib/eeat/rubric.ts
 * for the supplementary checklist.
 */
export function getQrgText(): string {
  if (cached) return cached;
  const path = join(process.cwd(), "knowledge-base", "search-quality-rater-guidelines.txt");
  cached = readFileSync(path, "utf-8");
  return cached;
}
