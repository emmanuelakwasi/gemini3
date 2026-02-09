"use client";

import { useCallback, useState } from "react";
import type { BenchSession } from "@/lib/benchReplay";
import { clearSessions, formatSessionTime } from "@/lib/benchReplay";
import type { AnalysisResult } from "@/lib/types";

type BenchReplaySidebarProps = {
  sessions: BenchSession[];
  onSessionsChange: (sessions: BenchSession[]) => void;
  onOpenSession: (session: BenchSession) => void;
  isOpen: boolean;
  onClose: () => void;
};

const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 };

function confidenceImproved(a: AnalysisResult["confidence"], b: AnalysisResult["confidence"]): boolean {
  return CONFIDENCE_ORDER[b] > CONFIDENCE_ORDER[a];
}

function confidenceDeclined(a: AnalysisResult["confidence"], b: AnalysisResult["confidence"]): boolean {
  return CONFIDENCE_ORDER[b] < CONFIDENCE_ORDER[a];
}

function CompareView({ before, after }: { before: BenchSession; after: BenchSession }) {
  const [aSession, bSession] =
    before.timestamp <= after.timestamp ? [before, after] : [after, before];
  const a = aSession.analysisResult;
  const b = bSession.analysisResult;
  const confUp = confidenceImproved(a.confidence, b.confidence);
  const confDown = confidenceDeclined(a.confidence, b.confidence);

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3 text-xs">
      <p className="font-medium text-[var(--text)]">Changes</p>
      <ul className="space-y-1.5 text-[var(--text-muted)]">
        {a.title !== b.title && (
          <li>
            <span className="text-[var(--text)]">Title:</span> {a.title} → {b.title}
          </li>
        )}
        {a.confidence !== b.confidence && (
          <li>
            <span className="text-[var(--text)]">Confidence:</span>{" "}
            <span className={confUp ? "text-ghana-green font-medium" : confDown ? "text-red-600" : ""}>
              {a.confidence} → {b.confidence}
              {confUp && " (improved)"}
              {confDown && " (declined)"}
            </span>
          </li>
        )}
        {a.summary !== b.summary && (
          <li>
            <span className="text-[var(--text)]">Summary changed</span>
          </li>
        )}
        {(a.likely_causes.length !== b.likely_causes.length ||
          JSON.stringify(a.likely_causes) !== JSON.stringify(b.likely_causes)) && (
          <li>
            <span className="text-[var(--text)]">Likely causes:</span> {a.likely_causes.length} → {b.likely_causes.length}
          </li>
        )}
        {(a.fix_steps.length !== b.fix_steps.length ||
          JSON.stringify(a.fix_steps) !== JSON.stringify(b.fix_steps)) && (
          <li>
            <span className="text-[var(--text)]">Fix steps:</span> {a.fix_steps.length} → {b.fix_steps.length}
          </li>
        )}
        {((a.uncertainty_zones?.length ?? 0) !== (b.uncertainty_zones?.length ?? 0)) && (
          <li>
            <span className="text-[var(--text)]">Uncertainty zones:</span>{" "}
            {a.uncertainty_zones?.length ?? 0} → {b.uncertainty_zones?.length ?? 0}
          </li>
        )}
      </ul>
    </div>
  );
}

export function BenchReplaySidebar({
  sessions,
  onSessionsChange,
  onOpenSession,
  isOpen,
  onClose,
}: BenchReplaySidebarProps) {
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  const handleClear = useCallback(() => {
    clearSessions();
    onSessionsChange([]);
    setBeforeId(null);
    setAfterId(null);
  }, [onSessionsChange]);

  const beforeSession = beforeId ? sessions.find((s) => s.id === beforeId) : null;
  const afterSession = afterId ? sessions.find((s) => s.id === afterId) : null;

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-10 bg-black/20"
        aria-label="Close sidebar"
        tabIndex={-1}
      />
      <aside
      className="fixed right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-[var(--border)] bg-white shadow-lg"
      aria-label="Bench Replay"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="card-title m-0">Bench Replay</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sessions.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-muted)]">
            No sessions yet. Run diagnostics first.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-[var(--border)] bg-[#fafaf9] p-2.5 text-sm"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text)]">
                      {session.analysisResult.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {session.boardType} · {formatSessionTime(session.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenSession(session)}
                    className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBeforeId((prev) => (prev === session.id ? null : session.id))
                    }
                    className={`rounded border px-2 py-1 text-xs ${
                      beforeId === session.id
                        ? "border-[var(--accent)] bg-ghana-green/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAfterId((prev) => (prev === session.id ? null : session.id))
                    }
                    className={`rounded border px-2 py-1 text-xs ${
                      afterId === session.id
                        ? "border-[var(--accent)] bg-ghana-green/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    After
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {beforeSession && afterSession && (
          <CompareView before={beforeSession} after={afterSession} />
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={sessions.length === 0}
          className="btn-secondary w-full text-sm"
        >
          Clear all
        </button>
      </div>
    </aside>
    </>
  );
}
