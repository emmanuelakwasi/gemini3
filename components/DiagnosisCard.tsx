"use client";

import { useCallback, useState } from "react";
import type { AnalysisResult, BoardType, ExplanationLevel } from "@/lib/types";
import { powerChecklistToMarkdown, type PowerChecklistItem } from "@/lib/quickTools";
import {
  I2C_SPI_VALIDATION_TEMPLATES,
  BOARD_SAFE_WIRING_RULES,
} from "@/lib/offlineContent";

export type VerifyFixEvidence = {
  newImageBase64: string | null;
  newSerialOutput: string;
  confirmations: string[];
};

type DiagnosisCardProps = {
  result: AnalysisResult | null;
  loading: boolean;
  sankofaMode?: boolean;
  judgeMode?: boolean;
  offlineMode?: boolean;
  fallback?: boolean;
  showImageBanner?: boolean;
  boardType?: BoardType;
  powerChecklist?: PowerChecklistItem[];
  verificationChecked?: Record<number, boolean>;
  onVerificationToggle?: (index: number) => void;
  onVerifyFix?: (evidence: VerifyFixEvidence) => Promise<boolean | void>;
  verifyLoading?: boolean;
};

function buildReportMarkdown(
  result: AnalysisResult,
  powerChecklist?: PowerChecklistItem[],
  sankofaMode?: boolean
): string {
  const beginnerExplanation =
    sankofaMode && result.explanation_beginner_sankofa
      ? result.explanation_beginner_sankofa
      : result.explanation_beginner;
  const lines: string[] = [
    `# ${result.title}`,
    "",
    `**Confidence:** ${result.confidence}`,
    "",
    "## Summary",
    "",
    result.summary,
    "",
    "## Explanation (Beginner)" + (sankofaMode && result.explanation_beginner_sankofa ? " (Sankofa)" : ""),
    "",
    beginnerExplanation,
    "",
    "## Explanation (Advanced)",
    "",
    result.explanation_advanced,
    "",
  ];
  if (result.likely_causes.length > 0) {
    lines.push("## Likely causes", "");
    result.likely_causes.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }
  if (result.fix_steps.length > 0) {
    lines.push("## Fix steps", "");
    result.fix_steps.forEach((s) => {
      lines.push(`### Step ${s.step}`, "", `**Action:** ${s.action}`, "", `**Why:** ${s.why}`, "");
    });
  }
  if (result.verification.length > 0) {
    lines.push("## Verification", "");
    result.verification.forEach((v) => lines.push(`- [ ] ${v}`));
    lines.push("");
  }
  if (result.code_snippet) {
    lines.push("## Code snippet", "", "```" + result.code_snippet.language, result.code_snippet.content, "```", "");
  }
  if (result.safety_notes && result.safety_notes.length > 0) {
    lines.push("## Safety notes", "");
    result.safety_notes.forEach((n) => lines.push(`- ${n}`));
    lines.push("");
  }
  if (result.assumptions && result.assumptions.length > 0) {
    lines.push("## Assumptions", "");
    result.assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  if (result.uncertainty_zones && result.uncertainty_zones.length > 0) {
    lines.push("## Uncertain areas (verify first)", "");
    result.uncertainty_zones.forEach((z) => {
      lines.push(`- **${z.area}** — ${z.reason} Verify: ${z.how_to_verify}`, "");
    });
  }
  if (result.intent_mismatch && result.intent_mismatch.length > 0) {
    lines.push("## Design intent vs wiring reality", "");
    result.intent_mismatch.forEach((m) => {
      lines.push(`- **Expected:** ${m.expected}`, `  **Observed:** ${m.observed}`, `  **Impact:** ${m.impact}`, "");
    });
  }
  if (result.failure_risks && result.failure_risks.length > 0) {
    lines.push("## Preventive checks (failure risks)", "");
    result.failure_risks.forEach((r) => {
      lines.push(`- **${r.risk}** (${r.likelihood})`, `  Prevention: ${r.prevention}`, r.time_horizon ? `  Horizon: ${r.time_horizon}` : "", "");
    });
  }
  if (powerChecklist && powerChecklist.length > 0) {
    lines.push(powerChecklistToMarkdown(powerChecklist));
  }
  return lines.join("\n");
}

function ConfidenceBadge({ confidence }: { confidence: AnalysisResult["confidence"] }) {
  const style =
    confidence === "high"
      ? "bg-ghana-green/15 text-ghana-green"
      : confidence === "medium"
        ? "bg-ghana-yellow/20 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {confidence}
    </span>
  );
}

export function DiagnosisCard({
  result,
  loading,
  sankofaMode = false,
  judgeMode = false,
  offlineMode = false,
  fallback = false,
  showImageBanner = false,
  boardType = "ESP32",
  powerChecklist,
  verificationChecked: controlledVerification,
  onVerificationToggle,
  onVerifyFix,
  verifyLoading = false,
}: DiagnosisCardProps) {
  const [internalVerification, setInternalVerification] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>("beginner");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyNewImage, setVerifyNewImage] = useState<string | null>(null);
  const [verifySerialOutput, setVerifySerialOutput] = useState("");
  const [verifyConfirmations, setVerifyConfirmations] = useState<Record<number, boolean>>({});
  const [verifyExtraI2C, setVerifyExtraI2C] = useState(false);

  const verificationChecked = controlledVerification ?? internalVerification;
  const toggleVerification = useCallback(
    (index: number) => {
      if (onVerificationToggle) {
        onVerificationToggle(index);
      } else {
        setInternalVerification((prev) => ({ ...prev, [index]: !prev[index] }));
      }
    },
    [onVerificationToggle]
  );

  const codeContent = result?.code_snippet?.content ?? "";
  const copyCode = useCallback(() => {
    if (!codeContent) return;
    void navigator.clipboard.writeText(codeContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [codeContent]);

  const downloadReport = useCallback(() => {
    if (!result) return;
    const markdown = buildReportMarkdown(result, powerChecklist, sankofaMode);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sankofawire-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [result, powerChecklist, sankofaMode]);

  const handleVerifyFixSubmit = useCallback(() => {
    if (!onVerifyFix || !result) return;
    const confirmations = [
      ...(result.verification ?? []).filter((_, i) => verifyConfirmations[i]),
      ...(verifyExtraI2C ? ["I2C address detected"] : []),
    ];
    void onVerifyFix({
      newImageBase64: verifyNewImage,
      newSerialOutput: verifySerialOutput.trim(),
      confirmations,
    }).then((success: boolean | void) => {
      if (success === true) {
        setShowVerifyModal(false);
        setVerifyNewImage(null);
        setVerifySerialOutput("");
        setVerifyConfirmations({});
        setVerifyExtraI2C(false);
      }
    });
  }, [
    onVerifyFix,
    result,
    verifyConfirmations,
    verifyExtraI2C,
    verifyNewImage,
    verifySerialOutput,
  ]);

  if (loading) {
    return (
      <section className="card flex min-h-[360px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-[var(--text-muted)]">Running diagnostics…</p>
        </div>
      </section>
    );
  }

  if (!result) {
    if (offlineMode) {
      const boardRules: string[] = BOARD_SAFE_WIRING_RULES[boardType as BoardType] ?? BOARD_SAFE_WIRING_RULES.ESP32;
      return (
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="card-title mb-0">Diagnosis</h2>
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              Offline Mode
            </span>
          </div>

          <h3 className="text-base font-semibold text-[var(--text)] mb-1">
            Offline Diagnostics Active
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            The AI analysis service is unavailable. Use the checks below — they do not require AI.
          </p>

          <div className="space-y-5">
            <div className="rounded-lg border border-[var(--border)] bg-[#fafaf9] p-4">
              <h4 className="text-sm font-medium text-[var(--text)] mb-2">What requires AI</h4>
              <p className="text-sm text-[var(--text-muted)]">
                Image-based diagnosis, natural language analysis of your issue, and tailored fix steps require the online service. Retry when connected.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[#fafaf9] p-4">
              <h4 className="text-sm font-medium text-[var(--text)] mb-2">What does not</h4>
              <p className="text-sm text-[var(--text-muted)]">
                Power checklist, I2C/SPI pin validation, and board-specific safe wiring rules run locally. Use them now.
              </p>
            </div>

            {powerChecklist && powerChecklist.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Power checklist</h4>
                <ul className="space-y-2">
                  {powerChecklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        readOnly
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">I2C / SPI pin validation</h4>
              <ul className="space-y-3">
                {I2C_SPI_VALIDATION_TEMPLATES.map((group) => (
                  <li key={group.title} className="rounded-lg border border-[var(--border)] bg-[#fafaf9] p-3">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">{group.title}</p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-[var(--text)]">
                      {group.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                Board-specific safe wiring ({boardType})
              </h4>
              <ul className="list-inside list-disc space-y-0.5 rounded-lg border border-[var(--border)] bg-[#fafaf9] p-3 text-sm text-[var(--text)]">
                {boardRules.map((rule: string, i: number) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="card flex min-h-[360px] items-center justify-center p-8">
        <p className="text-center text-[var(--text-muted)]">
          Run &quot;Analyze Setup&quot; to see diagnosis here.
        </p>
      </section>
    );
  }

  const {
    title,
    confidence,
    summary,
    likely_causes,
    fix_steps,
    verification,
    code_snippet,
    safety_notes,
    assumptions,
    uncertainty_zones,
    intent_mismatch,
    failure_risks,
    explanation_beginner,
    explanation_advanced,
    explanation_beginner_sankofa,
    status,
  } = result;

  const isResolved = status === "resolved";
  const isReadOnly = isResolved;

  const beginnerText =
    explanationLevel === "beginner" &&
    sankofaMode &&
    explanation_beginner_sankofa
      ? explanation_beginner_sankofa
      : explanation_beginner;
  const currentExplanation =
    explanationLevel === "beginner" ? beginnerText : explanation_advanced;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="card-title mb-4">Diagnosis</h2>

      {showImageBanner && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          role="status"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-amber-600" aria-hidden>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p>
            No hardware detected in image. Upload a clear photo of your circuit for accurate diagnosis.
          </p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
            <ConfidenceBadge confidence={confidence} />
            {fallback && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Demo fallback result
              </span>
            )}
            {isResolved && (
              <span className="inline-flex items-center rounded-full bg-[var(--ghana-green)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--ghana-green)]">
                Fix Verified
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">Summary</h3>
          <p className="mt-1 text-sm text-[var(--text)]">{summary}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Explanation</h3>
            <div className="flex rounded-lg border border-[var(--border)] bg-[#fafaf9] p-0.5">
              <button
                type="button"
                onClick={() => setExplanationLevel("beginner")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  explanationLevel === "beginner"
                    ? "bg-white text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Beginner
              </button>
              <button
                type="button"
                onClick={() => setExplanationLevel("advanced")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  explanationLevel === "advanced"
                    ? "bg-white text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Advanced
              </button>
            </div>
          </div>
          <p className="text-sm text-[var(--text)]">{currentExplanation}</p>
        </div>

        {uncertainty_zones && uncertainty_zones.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              Uncertain areas (verify first)
              <span
                className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] text-[var(--text-muted)]"
                title="This prevents false diagnoses."
              >
                ?
              </span>
            </h3>
            <ul className="mt-2 space-y-3">
              {uncertainty_zones.map((z, i) => (
                <li key={i} className="rounded-lg border border-[var(--border)] bg-[#fafaf9] p-3 text-sm">
                  <p className="font-medium text-[var(--text)]">{z.area}</p>
                  <p className="mt-0.5 text-[var(--text-muted)]">{z.reason}</p>
                  <p className="mt-1.5 text-[var(--text)]">
                    <span className="text-[var(--text-muted)]">Verify:</span> {z.how_to_verify}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {intent_mismatch && intent_mismatch.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
              Design intent vs wiring reality
            </h3>
            <ul className="space-y-4">
              {intent_mismatch.map((m, i) => (
                <li key={i} className="rounded-xl border border-amber-300/60 bg-amber-50/50 overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-0">
                    <div className="border-b sm:border-b-0 sm:border-r border-amber-300/60 bg-amber-50/80 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-amber-800/80 font-medium mb-1">
                        Intended (from goal)
                      </p>
                      <p className="text-sm text-amber-900">{m.expected}</p>
                    </div>
                    <div className="bg-red-50/80 border-red-200/60 p-3 sm:border-l-0">
                      <p className="text-[10px] uppercase tracking-wide text-red-800/80 font-medium mb-1">
                        Actual (from wiring)
                      </p>
                      <p className="text-sm text-red-900">{m.observed}</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-t border-amber-200/60 bg-white/60">
                    <p className="text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text)]">Impact:</span> {m.impact}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {failure_risks && failure_risks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
              Preventive checks
            </h3>
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              Predicted failure risks — not current errors. Address to avoid future issues.
            </p>
            <ul className="space-y-3">
              {failure_risks.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-3"
                >
                  <p className="text-sm font-medium text-amber-900">{r.risk}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        r.likelihood === "high"
                          ? "bg-amber-200/80 text-amber-900"
                          : r.likelihood === "medium"
                            ? "bg-amber-100/80 text-amber-800"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.likelihood} likelihood
                    </span>
                    {r.time_horizon && (
                      <span className="text-[10px] text-amber-800/90">
                        {r.time_horizon}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-amber-900/90">
                    <span className="font-medium text-amber-900">Prevention:</span> {r.prevention}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {likely_causes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Likely causes</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text)]">
              {likely_causes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {fix_steps.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Fix steps</h3>
            <ol className="mt-2 space-y-3 pl-0">
              {fix_steps.map((step) => (
                <li key={step.step} className="text-sm">
                  <span className="font-medium text-[var(--text)]">Step {step.step}:</span>{" "}
                  <span className="text-[var(--text)]">{step.action}</span>
                  <p className="mt-0.5 pl-4 text-[var(--text-muted)]">Why: {step.why}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {verification.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Verification</h3>
            <ul className="mt-2 space-y-2">
              {verification.map((label, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`verification-${i}`}
                    checked={verificationChecked[i] ?? false}
                    onChange={() => !isReadOnly && toggleVerification(i)}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label
                    htmlFor={`verification-${i}`}
                    className={`text-sm text-[var(--text)] ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {code_snippet && code_snippet.content && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">
              Code snippet
              {code_snippet.language !== "text" && (
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  ({code_snippet.language})
                </span>
              )}
            </h3>
            <div className="relative mt-2">
              <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[#f8f7f5] p-3 pr-20 text-xs">
                <code>{code_snippet.content}</code>
              </pre>
              <button
                type="button"
                onClick={copyCode}
                className="btn-secondary absolute right-2 top-2 text-xs"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {safety_notes && safety_notes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Safety notes</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text)]">
              {safety_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {assumptions && assumptions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Assumptions</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
              {assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadReport} className="btn-secondary">
            Export report
          </button>
        </div>
      </div>

      {showVerifyModal && onVerifyFix && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-fix-title"
        >
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6">
            <h2 id="verify-fix-title" className="card-title mb-4">
              Verify Fix
            </h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Share evidence that the fix worked.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                  New image (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-[var(--text-muted)]"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f || !f.type.startsWith("image/")) return;
                      const reader = new FileReader();
                      reader.onloadend = () => setVerifyNewImage(reader.result as string);
                      reader.readAsDataURL(f);
                    }}
                  />
                  {verifyNewImage && (
                    <button
                      type="button"
                      onClick={() => setVerifyNewImage(null)}
                      className="text-xs text-[var(--text-muted)] underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {verifyNewImage && (
                  <img
                    src={verifyNewImage}
                    alt="New setup"
                    className="mt-2 max-h-24 rounded object-contain"
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                  Serial output (optional)
                </label>
                <textarea
                  value={verifySerialOutput}
                  onChange={(e) => setVerifySerialOutput(e.target.value)}
                  placeholder="Serial output after fix"
                  rows={4}
                  className="input-field resize-y text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Confirm (check what applies)
                </label>
                <ul className="space-y-2">
                  {verification.map((label, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`verify-confirm-${i}`}
                        checked={verifyConfirmations[i] ?? false}
                        onChange={(e) =>
                          setVerifyConfirmations((prev) => ({ ...prev, [i]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`verify-confirm-${i}`}
                        className="cursor-pointer text-sm text-[var(--text)]"
                      >
                        {label}
                      </label>
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="verify-confirm-i2c"
                      checked={verifyExtraI2C}
                      onChange={(e) => setVerifyExtraI2C(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label
                      htmlFor="verify-confirm-i2c"
                      className="cursor-pointer text-sm text-[var(--text)]"
                    >
                      I2C address detected
                    </label>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleVerifyFixSubmit}
                disabled={verifyLoading}
                className="btn-primary"
                aria-busy={verifyLoading}
              >
                {verifyLoading ? "Verifying…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                disabled={verifyLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
