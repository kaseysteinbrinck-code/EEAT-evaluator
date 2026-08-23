import { z } from "zod";

export const GradeSchema = z.enum([
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
]);
export type Grade = z.infer<typeof GradeSchema>;

const ChecklistItemSchema = z.object({
  label: z.string().describe("Short label for the specific signal checked, e.g. 'First-hand experience language present'"),
  status: z.enum(["pass", "warning", "fail"]),
  note: z.string().describe("One sentence explaining the status, citing specific evidence from the content or research"),
});

const PillarResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  grade: GradeSchema,
  rationale: z.string().describe("2-4 sentence narrative judgment grounded in the QRG"),
  checklist: z.array(ChecklistItemSchema).min(3).max(10),
  suggestions: z.array(z.string()).min(1).max(6),
});

const AuthoritativenessResultSchema = PillarResultSchema.extend({
  subSignals: z.object({
    preExistingAuthority: z.object({
      score: z.number().int().min(0).max(100),
      note: z.string().describe("What the bounded research found (or didn't find) about the author/brand's existing external authority, independent of this piece"),
    }),
    contentDepth: z.object({
      score: z.number().int().min(0).max(100),
      note: z.string().describe("Whether the content itself demonstrates authority-supporting depth: authoritative citations, comprehensiveness, alignment with established topical focus"),
    }),
  }),
});

const ResearchNoteSchema = z.object({
  query: z.string().describe("What was searched or fetched"),
  source: z.string().describe("URL or source name consulted, if any"),
  findingSummary: z.string().describe("What was found and how it affected scoring"),
});

export const EeatEvaluationSchema = z.object({
  pillars: z.object({
    experience: PillarResultSchema,
    expertise: PillarResultSchema,
    authoritativeness: AuthoritativenessResultSchema,
    trust: PillarResultSchema,
  }),
  overall: z.object({
    score: z.number().int().min(0).max(100),
    grade: GradeSchema,
    summary: z.string().describe("2-3 sentence overall takeaway"),
  }),
  researchNotes: z.array(ResearchNoteSchema).max(10).describe(
    "Transparency log of what was actually looked up during research and what was found. Empty array if no research was performed or needed."
  ),
  contentMeta: z.object({
    title: z.string().nullable(),
    wordCount: z.number().int(),
    ymyl: z.boolean().describe("Whether this content falls under Your Money or Your Life per QRG section 2.3"),
    detectedBrand: z.string().nullable().describe("Brand or product this content is written for/about, if identifiable"),
    detectedAuthor: z.string().nullable(),
  }),
});

export type EeatEvaluation = z.infer<typeof EeatEvaluationSchema>;

export function scoreToGrade(score: number): Grade {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}
