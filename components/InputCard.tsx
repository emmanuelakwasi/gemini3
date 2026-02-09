"use client";

import { useCallback, useState } from "react";
import type { BoardType } from "@/lib/types";

const BOARD_OPTIONS: BoardType[] = ["ESP32", "STM32", "Arduino"];

const DEMO_GOAL = "ESP32 + OLED (SSD1306) display";
const DEMO_ISSUE =
  "OLED stays blank; I2C scanner shows no devices.";

type InputCardProps = {
  boardType: BoardType;
  onBoardTypeChange: (boardType: BoardType) => void;
  goal: string;
  onGoalChange: (v: string) => void;
  issueText: string;
  onIssueTextChange: (v: string) => void;
  imageBase64: string | null;
  onImageBase64Change: (v: string | null) => void;
  sankofaMode: boolean;
  onSankofaModeChange: (v: boolean) => void;
  judgeMode?: boolean;
  onAnalyze: (params: {
    boardType: BoardType;
    goal: string;
    issueText: string;
    imageBase64: string | null;
    sankofaMode?: boolean;
    judgeMode?: boolean;
  }) => void;
  loading: boolean;
  error: string | null;
  imageUploadHighlight?: boolean;
};

export function InputCard({
  boardType,
  onBoardTypeChange,
  goal,
  onGoalChange,
  issueText,
  onIssueTextChange,
  imageBase64,
  onImageBase64Change,
  sankofaMode,
  onSankofaModeChange,
  judgeMode = false,
  onAnalyze,
  loading,
  error,
  imageUploadHighlight = false,
}: InputCardProps) {
  const [demoMode, setDemoMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadDemoImage = useCallback(async () => {
    try {
      const res = await fetch("/demo/demo1.jpg");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        onImageBase64Change(data);
      };
      reader.readAsDataURL(blob);
    } catch {
      onImageBase64Change(null);
    }
  }, [onImageBase64Change]);

  const applyDemoMode = useCallback(
    (on: boolean) => {
      setDemoMode(on);
      if (on) {
        onGoalChange(DEMO_GOAL);
        onIssueTextChange(DEMO_ISSUE);
        loadDemoImage();
      } else {
        onGoalChange("");
        onIssueTextChange("");
        onImageBase64Change(null);
      }
    },
    [loadDemoImage, onGoalChange, onIssueTextChange, onImageBase64Change]
  );

  const handleFile = useCallback((file: File | null) => {
    if (!file) {
      onImageBase64Change(null);
      return;
    }
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onloadend = () => onImageBase64Change(reader.result as string);
    reader.readAsDataURL(file);
  }, [onImageBase64Change]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (demoMode) return;
      const f = e.dataTransfer.files[0];
      handleFile(f ?? null);
    },
    [demoMode, handleFile]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (demoMode || judgeMode) return;
      const f = e.target.files?.[0] ?? null;
      handleFile(f);
      e.target.value = "";
    },
    [demoMode, judgeMode, handleFile]
  );

  const handleSubmit = useCallback(() => {
    const g = goal.trim();
    const i = issueText.trim();
    if (!g || !i) return;
    onAnalyze({
      boardType,
      goal: g,
      issueText: i,
      imageBase64: imageBase64 || null,
      sankofaMode,
    });
  }, [boardType, goal, issueText, imageBase64, sankofaMode, onAnalyze]);

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="card-title mb-4">Setup</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
            Board photo
            {imageUploadHighlight && (
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
                title="Upload a clear photo of your circuit for accurate diagnosis"
                aria-hidden
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </label>
          <div
            className={`dropzone ${dragOver ? "dragover" : ""} ${imageUploadHighlight ? "dropzone-highlight" : ""} ${judgeMode ? "pointer-events-none opacity-80" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !demoMode && !judgeMode && document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileInput}
            />
            {imageBase64 ? (
              <div className="flex flex-col items-center gap-2 p-2">
                <img
                  src={imageBase64}
                  alt="Uploaded setup"
                  className="max-h-24 rounded object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!demoMode) onImageBase64Change(null);
                  }}
                  className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text)]"
                >
                  {demoMode ? "Demo image" : "Remove"}
                </button>
              </div>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">
                Drop image or click
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            Board type
          </label>
          <select
            value={boardType}
            onChange={(e) => !judgeMode && onBoardTypeChange(e.target.value as BoardType)}
            className="input-field"
            disabled={judgeMode}
          >
            {BOARD_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            What you&apos;re building
          </label>
          <textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="Goal and hardware setup"
            rows={3}
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            Issue + logs
          </label>
          <textarea
            value={issueText}
            onChange={(e) => !judgeMode && onIssueTextChange(e.target.value)}
            placeholder="Serial output and what's failing"
            rows={4}
            className="input-field resize-y"
            disabled={judgeMode}
            readOnly={judgeMode}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => applyDemoMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-[var(--text)]">Demo</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={sankofaMode}
              onChange={(e) => onSankofaModeChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              aria-describedby="sankofa-tooltip"
            />
            <span className="text-sm text-[var(--text)]">Sankofa Mode</span>
            <span
              id="sankofa-tooltip"
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] text-[var(--text-muted)]"
              title="Sankofa: learning from the past to move forward. When on, beginner explanations use relatable metaphors (shared paths, checkpoints)—kept professional and subtle."
            >
              ?
            </span>
          </label>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !goal.trim() || !issueText.trim()}
            className="btn-primary"
            aria-busy={loading}
          >
            {loading ? "Running diagnostics…" : "Run Diagnostics"}
          </button>
          {demoMode && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !goal.trim() || !issueText.trim()}
              className="btn-secondary"
              aria-busy={loading}
            >
              {loading ? "Running…" : "Run Demo Analysis"}
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
