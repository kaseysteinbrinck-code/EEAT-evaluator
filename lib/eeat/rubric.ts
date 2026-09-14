/**
 * Supplementary, illustrative signals to look for when scoring E-E-A-T.
 *
 * IMPORTANT: This checklist is NOT the source of truth. It is a structuring
 * aid adapted from Ahrefs' E-E-A-T audit checklist (Pages + Authors tabs),
 * restricted to items detectable from submitted content plus the bounded
 * research this tool performs. When anything here appears to conflict with
 * the Search Quality Rater Guidelines text provided separately, the QRG
 * always wins. Use this list to structure the itemized checklist in your
 * output, not to override QRG-grounded judgment.
 */
export const PILLAR_DEFINITIONS = `
## E-E-A-T Pillar Definitions (apply these distinguishing tests to avoid conflating pillars)

**Experience** — "Was this demonstrably lived, or credibly sourced from someone who lived it?"
Evidence: first-hand language ("I tested...", "in my experience..."), specific sensory/practical
details only a practitioner would know, original results or images described as the author's own.
IMPORTANT — broadened credit: the byline author does not need to have the direct experience
themselves. If the piece credibly channels someone else's first-hand experience — a quoted
subject-matter expert, a linked real customer case study, an embedded customer testimonial,
a cited practitioner's account — that counts toward Experience. A content marketer writing about
a product they haven't personally used can still score well here if the piece includes a quote
from someone on the product team, or summarizes and links to a genuine customer's case study.
Do not penalize indirect authorship if the sourcing is credible and specific.

**Expertise** — "Does this demonstrate deep, correct command of the subject?"
Evidence: correct terminology, technical depth, handling of nuance and edge cases, accuracy of
claims. Same broadened principle as Experience: expertise can be demonstrated through credible
quotes from credentialed people (a product engineer, a certified professional) or citations to
expert sources, not only the byline author's own stated credentials.

**Authoritativeness** — "Is this recognized as a go-to source, by others, not by self-claim?"
Split this into two sub-signals so new or recently-updated content isn't unfairly penalized for
lacking a track record:
  (a) Pre-existing author/brand authority — independent of this specific piece, does the author
      or brand already have external recognition? Check via the bounded research: does a search
      on the author's name + topic, or the brand + product, surface existing citations, guest
      posts, press mentions, or documented expertise elsewhere. A brand's or author's authority
      does not reset to zero just because this particular article is new.
  (b) Content-level authority-supporting depth — independent of external reputation, does the
      piece itself cite authoritative external sources, demonstrate comprehensiveness relative to
      the topic, and align with the brand's established topical focus? This sub-signal is fully
      scorable even for genuinely brand-new content with zero external track record yet.
Never let (a) being low (because content is new) drag the whole pillar to Lowest if (b) is strong.

**Undisclosed authorship**: the QRG treats not being able to identify who is responsible for
content as a real quality problem, not a neutral gap (see guideline sections on finding who is
responsible for the website/content and on inadequate information about the content creator --
this is explicitly called out as a low-quality signal, more severe on YMYL topics). If the user
tells you no author is being disclosed for this piece, do not treat it as a harmless omission --
apply the same judgment a rater would: this should weigh down Trust, and to a lesser extent
Authoritativeness and Expertise (there is no one to attribute expertise to), scaled by how much
the topic matters (heavier on YMYL). Say so plainly in the rationale rather than softening it.

**Trust** — "Can a reader rely on this being accurate, honest, and safe?"
Evidence: accuracy of specific factual claims (verify via bounded research where a claim is
checkable — e.g. against the brand's own docs/product pages), whether cited sources are real and
actually support what's claimed, transparency about affiliations/sponsorship, absence of
deceptive or manipulative framing. Trust is the most heavily weighted pillar per Google's own
guidance — when evidence is mixed, weight accuracy and honesty issues most heavily.
`.trim();

export const BOUNDED_RESEARCH_INSTRUCTIONS = `
## Bounded Research Instructions

You have web_search and web_fetch tools available, capped at a small number of total uses for
this evaluation. Spend them narrowly and deliberately — do not do open-ended browsing.

If the user has told you where this content will be/is published (a brand or site), treat that as
the anchor for brand-related research: verify factual/product claims against that brand's own
site or docs, and check that brand's pre-existing authority/reputation independent of this piece,
even though the piece itself may not be live there yet. This is what lets Authoritativeness and
Trust be assessed meaningfully for content that hasn't been published anywhere yet.

Do these in this exact order — literally make the author-identity lookup your first tool call,
before anything else, even though it feels like the smaller task. It is cheap (1 lookup) and easy
to skip past if you start with the more open-ended claim-verification work first, which can expand
to consume the whole budget before you circle back to it:
1. (exactly 1 lookup, do this FIRST) Author identity/credential check — if the content names an
   author, search for that name plus their stated topic or "LinkedIn" to see if they have any
   external footprint or credentials. Skip only if no author is named or identifiable.
2. (up to 3 lookups total, not per claim) Verify specific factual or product claims against the
   relevant brand's own site or documentation. First identify the brand/product this content is
   written for or about from the content itself, then check its most load-bearing factual claims
   (capabilities, pricing, statistics). One corroborating source per claim is normally enough —
   do not spend more than 2 lookups chasing extra corroboration for a single claim at the expense
   of leaving other claims or later steps completely unchecked.
3. (up to 3 lookups total, not per citation) Spot-check that cited external sources in the article
   are real and actually support the claim attributed to them — pick the 1-3 most important
   citations, not all of them, and again favor breadth (checking more distinct things) over depth
   (many sources on one thing).
4. (up to 1 lookup) Only if steps 1-3 leave Authoritativeness genuinely undetermined, one general
   search on the author/brand's existing reputation independent of this piece.

Your total budget across all four steps is small. If you sense you're running low, deprioritize
depth (extra corroborating sources on something already reasonably confirmed) over breadth
(leaving an entire category, especially step 1, untouched) — a research budget that runs out
mid-step-2 with step 1 never attempted is a failure of ordering, not of budget size.

If the content gives you nothing checkable (no named author, no specific factual claims, no
citations), it is entirely acceptable to perform zero lookups — do not manufacture a query for the
sake of using your budget. Record every lookup you actually perform, its source, and what it found
in the researchNotes field of your final output, so a reader can see exactly what was and wasn't
verified. Never fabricate a research finding — if a lookup is inconclusive, say so plainly and
score conservatively rather than guessing.
`.trim();

export const CHECKLIST_SIGNALS_BY_PILLAR = `
## Supplementary Signals to Consider (illustrative, not exhaustive, always subordinate to the QRG)

Adapted from Ahrefs' E-E-A-T audit checklist, restricted to what's detectable in submitted content
or the bounded research above (site-wide/off-page items like backlink profiles, Wikipedia
presence, or knowledge panels are out of scope for this tool — do not attempt to score those,
note in researchNotes if such a signal would require deeper research than this tool performs).

**Experience signals**: first-person language and specific examples; original photos/video/results
described as the author's own OR a credibly quoted/cited practitioner's; case-study or customer-
story markers; sensory/practical specificity that couldn't be guessed.

**Expertise signals**: author or quoted-source credentials stated; correct, precise terminology;
content depth beyond a surface summary; handling of edge cases or caveats an expert would know to
mention; substantive details a generalist wouldn't include.

**Authoritativeness signals**: citations to authoritative external sources; content comprehensiveness
relative to the topic; alignment with the brand's established focus; (via research) any existing
external recognition of the author or brand independent of this piece.

**Trust signals**: accuracy of specific, checkable claims; citations that are real and actually
support what's claimed; transparency about affiliations, sponsorship, or conflicts of interest;
absence of sensationalism, clickbait framing, or manipulative claims; appropriate caution/caveats
on YMYL topics (see QRG section 2.3 and 3.4.1 for what counts as YMYL and how experience vs.
expertise should be weighed there).
`.trim();
