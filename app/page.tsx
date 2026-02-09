"use client";

import { useCallback, useEffect, useState } from "react";
import { InputCard } from "@/components/InputCard";
import { DiagnosisCard } from "@/components/DiagnosisCard";
import { QuickTools, getInitialPowerChecklist } from "@/components/QuickTools";
import { BenchReplaySidebar } from "@/components/BenchReplaySidebar";
import type { AnalysisResult } from "@/lib/types";
import type { BoardType } from "@/lib/types";
import type { PowerChecklistItem } from "@/lib/quickTools";
import type { BenchSession } from "@/lib/benchReplay";
import { getSessions, saveSession, updateSession } from "@/lib/benchReplay";
import { OFFLINE_USER_MESSAGE } from "@/lib/offlineContent";

/** Verified demo data used when Judge Mode is on */
const JUDGE_DEMO_GOAL = "ESP32 + OLED (SSD1306) display";
const JUDGE_DEMO_ISSUE = "OLED stays blank; I2C scanner shows no devices.";

/** Fallback result when API fails in Judge Mode so output is never blocked */
function getJudgeModeFallbackResult(): AnalysisResult {
  return {
    title: "Demo scenario loaded",
    confidence: "low",
    summary:
      "Analysis unavailable. Check connection or API key. Run diagnostics again when the API is ready.",
    likely_causes: ["API unreachable or key missing", "Network or server error"],
    fix_steps: [
      { step: 1, action: "Verify GEMINI_API_KEY in .env.local", why: "Required for analysis." },
      { step: 2, action: "Retry Run Diagnostics", why: "Temporary errors may resolve." },
    ],
    verification: ["Confirm .env.local has a valid key", "Check browser console for errors"],
    explanation_beginner:
      "The analysis service could not be reached. Check connection and API key, then retry.",
    explanation_advanced:
      "The /api/analyze request failed (network, 5xx, or missing GEMINI_API_KEY). Judge Mode keeps the UI usable with this fallback so demos are not blocked.",
  };
}

/** True if result suggests the uploaded image is not relevant hardware */
function suggestsIrrelevantImage(result: AnalysisResult): boolean {
  const zones = result.uncertainty_zones ?? [];
  const assumptions = result.assumptions ?? [];
  const summary = result.summary ?? "";
  const text = [...zones.map((z) => `${z.area} ${z.reason}`), ...assumptions, summary]
    .join(" ")
    .toLowerCase();
  const patterns = [
    "no hardware",
    "irrelevant",
    "no image",
    "image not",
    "board not visible",
    "circuit not",
    "no board",
    "cannot identify",
    "not a circuit",
    "does not show",
    "doesn't show",
    "no wiring",
    "wiring not visible",
    "no circuit",
  ];
  return patterns.some((p) => text.includes(p));
}

function createSession(
  boardType: BoardType,
  inputs: { goal: string; issueText: string; imageBase64: string | null },
  analysisResult: AnalysisResult,
  verificationChecked: Record<number, boolean>,
  powerChecklist: PowerChecklistItem[]
): BenchSession {
  const verification: Record<string, boolean> = {};
  Object.entries(verificationChecked).forEach(([k, v]) => {
    verification[k] = v;
  });
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    boardType,
    inputs,
    analysisResult,
    checklistState: { verification, powerChecklist },
  };
}

export default function DashboardPage() {
  const [boardType, setBoardType] = useState<BoardType>("ESP32");
  const [goal, setGoal] = useState("");
  const [issueText, setIssueText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultFallback, setResultFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [powerChecklist, setPowerChecklist] = useState<PowerChecklistItem[]>(
    getInitialPowerChecklist
  );
  const [verificationChecked, setVerificationChecked] = useState<Record<number, boolean>>({});
  const [sessions, setSessions] = useState<BenchSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sankofaMode, setSankofaMode] = useState(false);
  const [judgeMode, setJudgeMode] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    if (!judgeMode) return;
    setBoardType("ESP32");
    setGoal(JUDGE_DEMO_GOAL);
    setIssueText(JUDGE_DEMO_ISSUE);
    fetch("/demo/demo1.jpg")
      .then((res) => res.blob())
      .then((blob) => {
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      })
      .then((data) => setImageBase64(data))
      .catch(() => setImageBase64(null));
  }, [judgeMode]);

  const onAnalyze = useCallback(
    async (params: {
      boardType: BoardType;
      goal: string;
      issueText: string;
      imageBase64: string | null;
      sankofaMode?: boolean;
      judgeMode?: boolean;
    }) => {
      setError(null);
      setResult(null);
      setLoading(true);
      const isJudgeMode = !!params.judgeMode;
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardType: params.boardType,
            goal: params.goal,
            issueText: params.issueText,
            imageBase64: params.imageBase64 || null,
            sankofaMode: params.sankofaMode ?? false,
          }),
        });
        let data: { error?: string; details?: string[] };
        try {
          data = await res.json();
        } catch {
          data = { error: "Server returned invalid response. Check connection and retry." };
        }
        if (!res.ok) {
          const msg = data?.error ?? "Analysis failed.";
          const details = Array.isArray(data?.details) ? data.details.join(" ") : "";
          if (isJudgeMode) {
            setResult(getJudgeModeFallbackResult());
            setError(null);
          } else {
            setResult(null);
            setOfflineMode(true);
            setError(details ? `${msg} ${details}` : msg);
          }
          setLoading(false);
          return;
        }
        const analysisResult = data as AnalysisResult & { fallback?: boolean };
        setResult(analysisResult);
        setResultFallback(!!analysisResult.fallback);
        setVerificationChecked({});

        const session = createSession(
          params.boardType,
          {
            goal: params.goal,
            issueText: params.issueText,
            imageBase64: params.imageBase64 || null,
          },
          analysisResult,
          {},
          powerChecklist
        );
        saveSession(session);
        setCurrentSessionId(session.id);
        setSessions(getSessions());
      } catch {
        if (isJudgeMode) {
          setResult(getJudgeModeFallbackResult());
          setError(null);
        } else {
          setResult(null);
          setOfflineMode(true);
          setError(OFFLINE_USER_MESSAGE);
        }
      } finally {
        setLoading(false);
      }
    },
    [powerChecklist]
  );

  const handleOpenSession = useCallback((session: BenchSession) => {
    setBoardType(session.boardType);
    setGoal(session.inputs.goal);
    setIssueText(session.inputs.issueText);
    setImageBase64(session.inputs.imageBase64);
    setResult(session.analysisResult);
    setPowerChecklist(session.checklistState.powerChecklist);
    setCurrentSessionId(session.id);
    const ver: Record<number, boolean> = {};
    Object.entries(session.checklistState.verification).forEach(([k, v]) => {
      ver[Number(k)] = v;
    });
    setVerificationChecked(ver);
    setSidebarOpen(false);
  }, []);

  const onVerifyFix = useCallback(
    async (evidence: {
      newImageBase64: string | null;
      newSerialOutput: string;
      confirmations: string[];
    }): Promise<boolean> => {
      if (!result) return false;
      setVerifyLoading(true);
      try {
        const res = await fetch("/api/verify-fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardType,
            goal,
            originalIssueText: issueText,
            previousResult: result,
            newImageBase64: evidence.newImageBase64 || null,
            newSerialOutput: evidence.newSerialOutput.trim() || "",
            confirmations: evidence.confirmations,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(OFFLINE_USER_MESSAGE);
          return false;
        }
        const updated = data as AnalysisResult;
        setResult(updated);
        setError(null);
        if (updated.status === "resolved" && currentSessionId) {
          updateSession(currentSessionId, { analysisResult: updated, verified: true });
          setSessions(getSessions());
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed.");
        return false;
      } finally {
        setVerifyLoading(false);
      }
    },
    [result, boardType, goal, issueText, currentSessionId]
  );

  const handleVerificationToggle = useCallback((index: number) => {
    setVerificationChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={judgeMode}
            onChange={(e) => setJudgeMode(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-[var(--text)]">Judge Mode</span>
        </label>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="btn-secondary text-sm"
        >
          Bench Replay
        </button>
      </div>

      {judgeMode && (
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-[var(--ghana-green)]/15 px-3 py-1 text-sm font-medium text-[var(--ghana-green)]">
            Verified Demo Scenario
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <InputCard
            boardType={boardType}
            onBoardTypeChange={setBoardType}
            goal={goal}
            onGoalChange={setGoal}
            issueText={issueText}
            onIssueTextChange={setIssueText}
            imageBase64={imageBase64}
            onImageBase64Change={setImageBase64}
            sankofaMode={sankofaMode}
            onSankofaModeChange={setSankofaMode}
            judgeMode={judgeMode}
            onAnalyze={onAnalyze}
            loading={loading}
            error={error}
            imageUploadHighlight={
              !!result &&
              result.confidence === "low" &&
              suggestsIrrelevantImage(result)
            }
          />
          <QuickTools
            boardType={boardType}
            powerChecklist={powerChecklist}
            onPowerChecklistChange={setPowerChecklist}
          />
        </div>
        <DiagnosisCard
          result={result}
          loading={loading}
          sankofaMode={sankofaMode}
          judgeMode={judgeMode}
          fallback={resultFallback}
          offlineMode={offlineMode}
          boardType={boardType}
          showImageBanner={
            !!result &&
            result.confidence === "low" &&
            suggestsIrrelevantImage(result)
          }
          powerChecklist={powerChecklist}
          verificationChecked={verificationChecked}
          onVerificationToggle={handleVerificationToggle}
          onVerifyFix={onVerifyFix}
          verifyLoading={verifyLoading}
        />
      </div>

      <BenchReplaySidebar
        sessions={sessions}
        onSessionsChange={setSessions}
        onOpenSession={handleOpenSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </main>
  );
}
