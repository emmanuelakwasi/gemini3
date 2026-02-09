"use client";

import { useCallback, useState } from "react";
import type { BoardType } from "@/lib/types";
import {
  generateI2CScanner,
  powerChecklistToMarkdown,
  POWER_CHECKLIST_DEFAULTS,
  type PowerChecklistItem,
} from "@/lib/quickTools";

type QuickToolsProps = {
  boardType: BoardType;
  powerChecklist: PowerChecklistItem[];
  onPowerChecklistChange: (items: PowerChecklistItem[]) => void;
};

const ESP32_DEFAULT_SDA = 21;
const ESP32_DEFAULT_SCL = 22;

export function QuickTools({
  boardType,
  powerChecklist,
  onPowerChecklistChange,
}: QuickToolsProps) {
  const [sda, setSda] = useState(ESP32_DEFAULT_SDA);
  const [scl, setScl] = useState(ESP32_DEFAULT_SCL);
  const [i2cCode, setI2cCode] = useState<string | null>(null);
  const [i2cCopied, setI2cCopied] = useState(false);
  const [checklistCopied, setChecklistCopied] = useState(false);

  const handleGenerateI2C = useCallback(() => {
    const code = generateI2CScanner(boardType, sda, scl);
    setI2cCode(code);
  }, [boardType, sda, scl]);

  const copyI2C = useCallback(() => {
    if (!i2cCode) return;
    void navigator.clipboard.writeText(i2cCode).then(() => {
      setI2cCopied(true);
      setTimeout(() => setI2cCopied(false), 2000);
    });
  }, [i2cCode]);

  const togglePowerItem = useCallback(
    (id: string) => {
      onPowerChecklistChange(
        powerChecklist.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        )
      );
    },
    [powerChecklist, onPowerChecklistChange]
  );

  const copyChecklist = useCallback(() => {
    const text = powerChecklistToMarkdown(powerChecklist);
    void navigator.clipboard.writeText(text).then(() => {
      setChecklistCopied(true);
      setTimeout(() => setChecklistCopied(false), 2000);
    });
  }, [powerChecklist]);

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="card-title mb-4">Quick Tools</h2>

      <div className="space-y-6">
        {/* Generate I2C Scanner */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Generate I2C Scanner
          </h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Uses board: <strong className="text-[var(--text)]">{boardType}</strong>
          </p>
          {boardType === "ESP32" && (
            <div className="mb-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">SDA</span>
                <input
                  type="number"
                  min={0}
                  max={39}
                  value={sda}
                  onChange={(e) => setSda(Number(e.target.value) || 0)}
                  className="input-field w-16 py-1.5 text-xs"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">SCL</span>
                <input
                  type="number"
                  min={0}
                  max={39}
                  value={scl}
                  onChange={(e) => setScl(Number(e.target.value) || 0)}
                  className="input-field w-16 py-1.5 text-xs"
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleGenerateI2C} className="btn-secondary text-sm">
              Generate
            </button>
          </div>
          {i2cCode && (
            <div className="relative mt-3">
              <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[#f8f7f5] p-3 pr-20 text-xs">
                <code>{i2cCode}</code>
              </pre>
              <button
                type="button"
                onClick={copyI2C}
                className="btn-secondary absolute right-2 top-2 text-xs"
              >
                {i2cCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {/* Power Checklist */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Power Checklist
          </h3>
          <ul className="space-y-2">
            {powerChecklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`power-${item.id}`}
                  checked={item.checked}
                  onChange={() => togglePowerItem(item.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label
                  htmlFor={`power-${item.id}`}
                  className="cursor-pointer text-sm text-[var(--text)]"
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={copyChecklist}
            className="btn-secondary mt-2 text-xs"
          >
            {checklistCopied ? "Copied!" : "Copy checklist"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function getInitialPowerChecklist(): PowerChecklistItem[] {
  return POWER_CHECKLIST_DEFAULTS.map((item) => ({ ...item, checked: false }));
}
