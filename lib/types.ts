/** Board types supported by SankofaWire */
export type BoardType = "ESP32" | "STM32" | "Arduino";

/** Confidence level for the analysis */
export type ConfidenceLevel = "low" | "medium" | "high";

/** Code snippet with optional language */
export type CodeSnippet = {
  language: "cpp" | "c" | "python" | "text";
  content: string;
};

/** One zone where visual or contextual evidence is incomplete */
export type UncertaintyZone = {
  area: string;
  reason: string;
  how_to_verify: string;
};

/** Explanation level for toggling detail */
export type ExplanationLevel = "beginner" | "advanced";

/** Design intent vs wiring reality mismatch */
export type IntentMismatch = {
  expected: string;
  observed: string;
  impact: string;
};

/** Proof-of-fix status */
export type FixStatus = "pending" | "resolved";

/** Predicted failure risk (preventive, not a current error) */
export type FailureRisk = {
  risk: string;
  likelihood: "low" | "medium" | "high";
  time_horizon?: string;
  prevention: string;
};

/** Structured analysis result from /api/analyze */
export type AnalysisResult = {
  title: string;
  confidence: ConfidenceLevel;
  summary: string;
  likely_causes: string[];
  fix_steps: { step: number; action: string; why: string }[];
  verification: string[];
  explanation_beginner: string;
  explanation_advanced: string;
  explanation_beginner_sankofa?: string;
  code_snippet?: CodeSnippet;
  safety_notes?: string[];
  assumptions?: string[];
  uncertainty_zones?: UncertaintyZone[];
  intent_mismatch?: IntentMismatch[];
  /** Set by proof-of-fix flow when verification criteria are met */
  status?: FixStatus;
  /** Short explanation when status is "resolved" */
  why_this_fix_worked?: string;
  /** Predicted failure modes for preventive checks (wiring, power, board limits) */
  failure_risks?: FailureRisk[];
}
