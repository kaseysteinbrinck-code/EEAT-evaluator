import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getQrgText } from "./qrg-text";
import {
  PILLAR_DEFINITIONS,
  BOUNDED_RESEARCH_INSTRUCTIONS,
  CHECKLIST_SIGNALS_BY_PILLAR,
} from "./rubric";
import { EeatEvaluationSchema, scoreToGrade, type EeatEvaluation } from "./schema";

const MODEL = "claude-sonnet-5";

// Generated once at module load. Used only as a plain-text schema
// description for phase 2's prompt -- NOT passed via output_config.format,
// since that measurably broke prompt-cache reuse of the ~97K-token QRG
// block between phase 1 and phase 2 (full cache_write on every synthesis
// call instead of a cheap cache_read). Plain-JSON-in-prompt + manual Zod
// validation keeps both phases the same request shape so the cache carries.
const EEAT_JSON_SCHEMA = JSON.stringify(z.toJSONSchema(EeatEvaluationSchema));

function buildSystemPrompt(): Anthropic.Messages.TextBlockParam[] {
  const qrg = getQrgText();
  return [
    {
      type: "text",
      text: [
        "You are an expert E-E-A-T content evaluator for Blue Ivory Creative's EEAT Evaluator tool.",
        "",
        "The single most important instruction: your scoring MUST be grounded first and foremost",
        "in the actual Search Quality Rater Guidelines text below. This is Google's real, current",
        "(September 11, 2025) guidance for how human Search Quality Raters assess Page Quality,",
        "including the E-E-A-T framework. Treat it as authoritative. Everything you're given after",
        "it in this system prompt — pillar definitions, research instructions, a supplementary",
        "checklist — is illustrative scaffolding to help you structure output consistently. If any",
        "of that scaffolding ever seems to conflict with the guidelines text, the guidelines text",
        "wins.",
        "",
        "=== BEGIN SEARCH QUALITY RATER GUIDELINES (September 11, 2025) ===",
        qrg,
        "=== END SEARCH QUALITY RATER GUIDELINES ===",
      ].join("\n"),
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: [
        PILLAR_DEFINITIONS,
        "",
        BOUNDED_RESEARCH_INSTRUCTIONS,
        "",
        CHECKLIST_SIGNALS_BY_PILLAR,
        "",
        "## Your Task",
        "You will be given the text of a submitted article. Evaluate it against Experience,",
        "Expertise, Authoritativeness, and Trust as defined above. Perform any bounded research you",
        "judge useful (within your budget), then you will be asked to produce a final structured",
        "evaluation. Score each pillar 0-100, anchored to the QRG's five-point",
        "Lowest(1)/Low(25)/Medium(50)/High(75)/Highest(100) rating scale — reason about which band",
        "the evidence supports and place your score within it, rather than estimating a number",
        "directly. Ground every rationale and checklist note in specific evidence from the content",
        "or your research. Never assert a signal you did not actually observe, and never fabricate",
        "a research finding — if a lookup was inconclusive, say so and score conservatively.",
      ].join("\n"),
    },
  ];
}

// Sonnet 5 per-token pricing (intro rate through 2026-08-31) -- update if
// pricing changes. This is a rough cost estimate for server-side logging
// only, never shown to end users.
const INPUT_PER_TOKEN = 2 / 1_000_000;
const OUTPUT_PER_TOKEN = 10 / 1_000_000;
const CACHE_READ_PER_TOKEN = INPUT_PER_TOKEN * 0.1;
const CACHE_WRITE_PER_TOKEN = INPUT_PER_TOKEN * 1.25;

function logUsage(label: string, usage: Anthropic.Messages.Usage): void {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cost =
    usage.input_tokens * INPUT_PER_TOKEN +
    usage.output_tokens * OUTPUT_PER_TOKEN +
    cacheRead * CACHE_READ_PER_TOKEN +
    cacheWrite * CACHE_WRITE_PER_TOKEN;
  console.log(
    `[eeat:usage] ${label} -- input=${usage.input_tokens} output=${usage.output_tokens} ` +
      `cache_read=${cacheRead} cache_write=${cacheWrite} est_cost=$${cost.toFixed(4)}`,
  );
}

/**
 * Heuristic title extraction from raw article text -- covers pasted
 * markdown/text and file-upload extraction, neither of which has a real
 * H1/title tag to pull from (unlike a live URL, which gets its title from
 * Readability in lib/extract/url.ts). Not trusted to the model, same
 * reasoning as wordCount below -- deterministic where possible beats an LLM
 * guess that can come back null or inconsistent.
 */
function deriveTitleFromContent(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;

  const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
  const candidate = headingMatch ? headingMatch[1].trim() : firstLine;

  if (candidate.length === 0 || candidate.length > 140) return null;
  // A real paragraph masquerading as a "first line" reads like a sentence,
  // not a title -- word count is a cheap proxy for that distinction.
  if (!headingMatch && candidate.split(/\s+/).length > 20) return null;

  return candidate;
}

function buildTools(maxUses: number): Anthropic.Messages.ToolUnion[] {
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxUses },
  ];
}

export interface EvaluateOptions {
  maxResearchLookups?: number;
  /**
   * Real title already extracted client-side (Readability for a live URL,
   * or whatever the file/paste flow determined). Takes priority over both
   * the content-heuristic fallback and the model's own guess when present.
   */
  extractedTitle?: string;
  /**
   * User-supplied LinkedIn profile URL for the article's author. Only
   * meaningful for pasted/uploaded content, where there's no live page for
   * the tool to derive and verify author identity from on its own -- for a
   * live URL submission, the tool discovers and verifies this itself as
   * part of its normal bounded research.
   */
  authorLinkedInUrl?: string;
  /** True when the user explicitly confirmed this content has no disclosed author. */
  noDefinedAuthor?: boolean;
  /**
   * Brand or site this content will be/is published under. Only meaningful
   * for pasted/uploaded content (a live URL submission already has a real
   * domain to anchor brand research to) -- lets the tool assess brand-level
   * Authoritativeness/Trust for a draft that isn't live anywhere yet.
   */
  publishingSite?: string;
}

export async function evaluateContent(
  content: string,
  opts: EvaluateOptions = {},
): Promise<EeatEvaluation> {
  const client = new Anthropic();
  const system = buildSystemPrompt();
  const maxUses = opts.maxResearchLookups ?? Number(process.env.EEAT_MAX_RESEARCH_LOOKUPS ?? 15);
  const tools = buildTools(maxUses);

  const contextNotes: string[] = [];
  if (opts.authorLinkedInUrl) {
    contextNotes.push(
      "The user has directly supplied this LinkedIn profile URL for the article's author: " +
        opts.authorLinkedInUrl +
        ". Use web_fetch to check it directly as your author identity/credential lookup -- " +
        "this is a stronger signal than searching by name, so prefer it over a name-based search.",
    );
  }
  if (opts.noDefinedAuthor) {
    contextNotes.push(
      "The user has explicitly confirmed this content has no disclosed author. Apply the " +
        "QRG's treatment of undisclosed authorship as a real quality signal per your system " +
        "prompt instructions -- do not treat this as neutral.",
    );
  }
  if (opts.publishingSite) {
    contextNotes.push(
      "This content will be/is published under: " +
        opts.publishingSite +
        ". Use this as the brand/site anchor for your research per your system prompt " +
        "instructions, even though this specific piece may not be live there yet.",
    );
  }
  const contextBlock = contextNotes.length ? "\n\n" + contextNotes.join("\n\n") : "";

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        "Evaluate the following article for E-E-A-T. Use your bounded research budget",
        "judiciously per the instructions in your system prompt." + contextBlock,
        "",
        "=== ARTICLE CONTENT ===",
        content,
        "=== END ARTICLE CONTENT ===",
      ].join("\n"),
    },
  ];

  // Phase 1: bounded agentic research. web_search/web_fetch are server-side
  // tools -- Claude calls them autonomously and results arrive as content
  // blocks in the same response. We only need to loop to resume on pause_turn
  // (a long research chain hitting its per-turn iteration limit server-side).
  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    tools,
    messages,
  });
  logUsage("research (initial)", response.usage);

  let resumeGuard = 0;
  while (response.stop_reason === "pause_turn" && resumeGuard < 5) {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      tools,
      messages,
    });
    logUsage(`research (resume ${resumeGuard + 1})`, response.usage);
    resumeGuard++;
  }

  messages.push({ role: "assistant", content: response.content });
  messages.push({
    role: "user",
    content:
      "Based on everything above -- the article and any research you performed -- " +
      "produce the final E-E-A-T evaluation now. Do not perform further research.\n\n" +
      "Respond with ONLY a single JSON object matching this JSON Schema exactly -- no " +
      "markdown code fences, no commentary before or after, just the raw JSON. This will be " +
      "parsed with JSON.parse(), so it must be strictly valid: escape every double-quote " +
      "character that appears inside a string value as \\\", escape literal newlines inside " +
      "string values as \\n, and do not include any other control characters.\n\n" +
      EEAT_JSON_SCHEMA,
  });

  // Phase 2: structured synthesis. Deliberately the same request shape as
  // phase 1 (messages.create, same `tools`/`system` arrays, no
  // output_config.format) so the cached QRG prefix actually gets reused --
  // see the note on EEAT_JSON_SCHEMA above for why. tool_choice: none still
  // prevents further tool calls without affecting the cached prefix (cache
  // matching is on the tools -> system -> messages content, not tool_choice).
  //
  // Trade-off of dropping output_config.format: no more hard schema
  // guarantee, so the model can occasionally emit invalid JSON (observed:
  // an unescaped quote broke JSON.parse after a full research+synthesis
  // pass had already run, wasting ~2min and real API cost with nothing to
  // show for it). One bounded retry -- telling the model exactly what parse
  // error it produced -- recovers from that without giving back the caching
  // win in the common case.
  let evaluation: EeatEvaluation | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2 && !evaluation; attempt++) {
    if (attempt > 0 && lastError) {
      messages.push({
        role: "user",
        content:
          `Your previous response was not valid JSON: ${lastError}. Resend the ENTIRE JSON ` +
          "object again from scratch, valid this time -- double-check every string value for " +
          "unescaped quotes or control characters.",
      });
    }

    const final = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      tools,
      tool_choice: { type: "none" },
      messages,
    });
    logUsage(`synthesis (attempt ${attempt + 1})`, final.usage);
    messages.push({ role: "assistant", content: final.content });

    const textBlock = final.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      lastError = "Model did not return a text response.";
      continue;
    }

    const jsonText = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(jsonText);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    const validated = EeatEvaluationSchema.safeParse(rawParsed);
    if (!validated.success) {
      lastError = validated.error.message;
      continue;
    }

    evaluation = validated.data;
  }

  if (!evaluation) {
    throw new Error(`Model did not return a usable E-E-A-T evaluation: ${lastError}`);
  }

  // Word count is arithmetic the model is unreliable at -- compute it ourselves.
  evaluation.contentMeta.wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  // Title priority: a real client-extracted title (Readability, for a live
  // URL) beats a content-heuristic guess, which beats the model's own guess.
  const derivedTitle = opts.extractedTitle?.trim() || deriveTitleFromContent(content);
  if (derivedTitle) {
    evaluation.contentMeta.title = derivedTitle;
  }

  // Grade must be a pure function of score -- the model was asked to supply
  // both independently, which let them drift out of sync (e.g. a 60/100
  // coming back labeled C+ instead of D-). Always recompute grade from score
  // server-side so the two can never disagree.
  evaluation.pillars.experience.grade = scoreToGrade(evaluation.pillars.experience.score);
  evaluation.pillars.expertise.grade = scoreToGrade(evaluation.pillars.expertise.score);
  evaluation.pillars.authoritativeness.grade = scoreToGrade(
    evaluation.pillars.authoritativeness.score,
  );
  evaluation.pillars.trust.grade = scoreToGrade(evaluation.pillars.trust.score);
  evaluation.overall.grade = scoreToGrade(evaluation.overall.score);

  return evaluation;
}
