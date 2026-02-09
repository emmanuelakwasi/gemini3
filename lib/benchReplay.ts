import type { AnalysisResult, BoardType } from "@/lib/types";
import type { PowerChecklistItem } from "@/lib/quickTools";

const STORAGE_KEY = "sankofawire_sessions";
const MAX_SESSIONS = 50;

export type BenchSession = {
  id: string;
  timestamp: number;
  boardType: BoardType;
  inputs: {
    goal: string;
    issueText: string;
    imageBase64: string | null;
  };
  analysisResult: AnalysisResult;
  checklistState: {
    verification: Record<string, boolean>;
    powerChecklist: PowerChecklistItem[];
  };
  /** Set when proof-of-fix flow marks the session as resolved */
  verified?: boolean;
};

export function saveSession(session: BenchSession): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: BenchSession[] = raw ? JSON.parse(raw) : [];
    list.unshift(session);
    const trimmed = list.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or parse error
  }
}

export function getSessions(): BenchSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as BenchSession[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function updateSession(id: string, updates: Partial<BenchSession>): void {
  try {
    const list = getSessions();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = { ...list[idx], ...updates };
    const nextList = [...list];
    nextList[idx] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
  } catch {
    // Quota or parse error
  }
}

export function clearSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function formatSessionTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
