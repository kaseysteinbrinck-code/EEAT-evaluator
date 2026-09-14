import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { EeatEvaluation } from "@/lib/eeat/schema";
import { scoreToQrgLabel } from "@/lib/eeat/schema";

const COLORS = {
  ink: "#1a1a1a",
  muted: "#5c5c5c",
  border: "#e0e0e0",
  pass: "#1a7f37",
  warning: "#9a6700",
  fail: "#cf222e",
  brand: "#2b2560",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.ink,
  },
  header: {
    marginBottom: 20,
    borderBottom: `2px solid ${COLORS.brand}`,
    paddingBottom: 12,
  },
  brandLine: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.brand,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  metaItem: {
    fontSize: 9,
    color: COLORS.muted,
    marginRight: 10,
    marginBottom: 3,
  },
  overallBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f4fb",
    borderRadius: 4,
    padding: 14,
    marginBottom: 20,
  },
  overallGrade: {
    fontSize: 32,
    fontWeight: 700,
    color: COLORS.brand,
  },
  overallSummary: {
    fontSize: 10,
    color: COLORS.ink,
    maxWidth: 380,
  },
  overallGoogleLine: {
    fontSize: 8.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  pillarSection: {
    marginBottom: 16,
    breakInside: "avoid",
  },
  pillarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 4,
    marginBottom: 6,
  },
  pillarName: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.brand,
  },
  pillarGrade: {
    fontSize: 13,
    fontWeight: 700,
  },
  pillarScoreNote: {
    fontSize: 8,
    color: COLORS.muted,
  },
  rationale: {
    fontSize: 9.5,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  checklistRow: {
    flexDirection: "row",
    marginBottom: 3,
    gap: 6,
  },
  checklistIcon: {
    width: 12,
    fontSize: 9,
    fontWeight: 700,
  },
  checklistLabel: {
    fontSize: 9,
    fontWeight: 700,
  },
  checklistNote: {
    fontSize: 8.5,
    color: COLORS.muted,
  },
  suggestionsHeading: {
    fontSize: 9,
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 2,
  },
  suggestionRow: {
    fontSize: 8.5,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  researchSection: {
    marginTop: 10,
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 10,
  },
  researchHeading: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.brand,
    marginBottom: 6,
  },
  researchRow: {
    marginBottom: 5,
  },
  researchQuery: {
    fontSize: 8.5,
    fontWeight: 700,
  },
  researchFinding: {
    fontSize: 8.5,
    color: COLORS.muted,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: COLORS.muted,
    textAlign: "center",
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 6,
  },
});

function statusColor(status: "pass" | "warning" | "fail"): string {
  if (status === "pass") return COLORS.pass;
  if (status === "warning") return COLORS.warning;
  return COLORS.fail;
}

function statusIcon(status: "pass" | "warning" | "fail"): string {
  if (status === "pass") return "✓";
  if (status === "warning") return "!";
  return "✕";
}

function PillarBlock({
  name,
  result,
}: {
  name: string;
  result: EeatEvaluation["pillars"]["experience"];
}) {
  return (
    <View style={styles.pillarSection} wrap={false}>
      <View style={styles.pillarHeaderRow}>
        <Text style={styles.pillarName}>{name}</Text>
        <View>
          <Text style={styles.pillarGrade}>{result.grade}</Text>
          <Text style={styles.pillarScoreNote}>
            Google: {result.score}/100 · {scoreToQrgLabel(result.score)}
          </Text>
        </View>
      </View>
      <Text style={styles.rationale}>{result.rationale}</Text>
      {result.checklist.map((item, i) => (
        <View key={i} style={styles.checklistRow}>
          <Text style={[styles.checklistIcon, { color: statusColor(item.status) }]}>
            {statusIcon(item.status)}
          </Text>
          <View>
            <Text style={styles.checklistLabel}>{item.label}</Text>
            <Text style={styles.checklistNote}>{item.note}</Text>
          </View>
        </View>
      ))}
      {result.suggestions.length > 0 && (
        <>
          <Text style={styles.suggestionsHeading}>Suggested improvements</Text>
          {result.suggestions.map((s, i) => (
            <Text key={i} style={styles.suggestionRow}>
              {"•"} {s}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

export function ReportDocument({ evaluation }: { evaluation: EeatEvaluation }) {
  const { pillars, overall, researchNotes, contentMeta } = evaluation;
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document title={`EEAT Evaluation - ${contentMeta.title ?? "Untitled"}`}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brandLine}>EEAT Evaluator by Blue Ivory Creative</Text>
          <Text style={styles.title}>{contentMeta.title ?? "Untitled Article"}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>Generated {generatedAt}</Text>
            <Text style={styles.metaItem}>{contentMeta.wordCount.toLocaleString()} words</Text>
            {contentMeta.detectedBrand && (
              <Text style={styles.metaItem}>Brand: {contentMeta.detectedBrand}</Text>
            )}
            {contentMeta.detectedAuthor && (
              <Text style={styles.metaItem}>Author: {contentMeta.detectedAuthor}</Text>
            )}
            {contentMeta.ymyl && <Text style={styles.metaItem}>YMYL topic</Text>}
          </View>
        </View>

        <View style={styles.overallBox}>
          <View>
            <Text style={styles.overallGrade}>{overall.grade}</Text>
            <Text style={styles.overallGoogleLine}>
              Google: {overall.score}/100 · {scoreToQrgLabel(overall.score)}
            </Text>
          </View>
          <Text style={styles.overallSummary}>{overall.summary}</Text>
        </View>

        <PillarBlock name="Experience" result={pillars.experience} />
        <PillarBlock name="Expertise" result={pillars.expertise} />
        <PillarBlock name="Authoritativeness" result={pillars.authoritativeness} />
        <PillarBlock name="Trust" result={pillars.trust} />

        {researchNotes.length > 0 && (
          <View style={styles.researchSection}>
            <Text style={styles.researchHeading}>What We Checked</Text>
            {researchNotes.map((note, i) => (
              <View key={i} style={styles.researchRow}>
                <Text style={styles.researchQuery}>
                  {note.query}
                  {note.source ? ` — ${note.source}` : ""}
                </Text>
                <Text style={styles.researchFinding}>{note.findingSummary}</Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `EEAT Evaluator — Blue Ivory Creative — Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
