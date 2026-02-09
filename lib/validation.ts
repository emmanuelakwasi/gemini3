import type { AnalysisResult, CodeSnippet, FailureRisk } from "@/lib/types";

const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
const CODE_LANGUAGES = ["cpp", "c", "python", "text"] as const;

export function validateAnalysisResult(data: unknown): {
  ok: boolean;
  errors: string[];
  result?: AnalysisResult;
} {
  const errors: string[] = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["Response is not a JSON object."] };
  }

  const obj = data as Record<string, unknown>;

  // title
  if (typeof obj.title !== "string" || !obj.title.trim()) {
    errors.push("'title' must be a non-empty string.");
  }

  // confidence
  if (
    typeof obj.confidence !== "string" ||
    !CONFIDENCE_LEVELS.includes(obj.confidence as (typeof CONFIDENCE_LEVELS)[number])
  ) {
    errors.push("'confidence' must be one of: low, medium, high.");
  }

  // summary
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    errors.push("'summary' must be a non-empty string.");
  }

  // likely_causes
  if (!Array.isArray(obj.likely_causes)) {
    errors.push("'likely_causes' must be an array of strings.");
  } else {
    const invalid = obj.likely_causes.some((c: unknown) => typeof c !== "string");
    if (invalid) errors.push("'likely_causes' must contain only strings.");
  }

  // fix_steps
  if (!Array.isArray(obj.fix_steps)) {
    errors.push("'fix_steps' must be an array of objects with step, action, why.");
  } else {
    obj.fix_steps.forEach((item: unknown, i: number) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`fix_steps[${i}] must be an object.`);
      } else {
        const step = item as Record<string, unknown>;
        if (typeof step.step !== "number") errors.push(`fix_steps[${i}].step must be a number.`);
        if (typeof step.action !== "string") errors.push(`fix_steps[${i}].action must be a string.`);
        if (typeof step.why !== "string") errors.push(`fix_steps[${i}].why must be a string.`);
      }
    });
  }

  // verification
  if (!Array.isArray(obj.verification)) {
    errors.push("'verification' must be an array of strings.");
  } else {
    const invalid = obj.verification.some((v: unknown) => typeof v !== "string");
    if (invalid) errors.push("'verification' must contain only strings.");
  }

  // explanation_beginner (required)
  if (typeof obj.explanation_beginner !== "string" || !obj.explanation_beginner.trim()) {
    errors.push("'explanation_beginner' must be a non-empty string.");
  }

  // explanation_advanced (required)
  if (typeof obj.explanation_advanced !== "string" || !obj.explanation_advanced.trim()) {
    errors.push("'explanation_advanced' must be a non-empty string.");
  }

  // explanation_beginner_sankofa (optional; if present must be string)
  if (obj.explanation_beginner_sankofa !== undefined && obj.explanation_beginner_sankofa !== null) {
    if (typeof obj.explanation_beginner_sankofa !== "string") {
      errors.push("'explanation_beginner_sankofa' must be a string when present.");
    }
  }

  // code_snippet (optional)
  if (obj.code_snippet !== undefined && obj.code_snippet !== null) {
    if (typeof obj.code_snippet !== "object" || Array.isArray(obj.code_snippet)) {
      errors.push("'code_snippet' must be an object with language and content.");
    } else {
      const cs = obj.code_snippet as Record<string, unknown>;
      if (
        typeof cs.language !== "string" ||
        !CODE_LANGUAGES.includes(cs.language as (typeof CODE_LANGUAGES)[number])
      ) {
        errors.push("'code_snippet.language' must be one of: cpp, c, python, text.");
      }
      if (typeof cs.content !== "string") {
        errors.push("'code_snippet.content' must be a string.");
      }
    }
  }

  // safety_notes (optional)
  if (obj.safety_notes !== undefined && obj.safety_notes !== null) {
    if (!Array.isArray(obj.safety_notes)) {
      errors.push("'safety_notes' must be an array of strings.");
    } else {
      const invalid = obj.safety_notes.some((s: unknown) => typeof s !== "string");
      if (invalid) errors.push("'safety_notes' must contain only strings.");
    }
  }

  // assumptions (optional)
  if (obj.assumptions !== undefined && obj.assumptions !== null) {
    if (!Array.isArray(obj.assumptions)) {
      errors.push("'assumptions' must be an array of strings.");
    } else {
      const invalid = obj.assumptions.some((a: unknown) => typeof a !== "string");
      if (invalid) errors.push("'assumptions' must contain only strings.");
    }
  }

  // uncertainty_zones (optional)
  if (obj.uncertainty_zones !== undefined && obj.uncertainty_zones !== null) {
    if (!Array.isArray(obj.uncertainty_zones)) {
      errors.push("'uncertainty_zones' must be an array of objects.");
    } else {
      obj.uncertainty_zones.forEach((item: unknown, i: number) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          errors.push(`uncertainty_zones[${i}] must be an object.`);
        } else {
          const z = item as Record<string, unknown>;
          if (typeof z.area !== "string") errors.push(`uncertainty_zones[${i}].area must be a string.`);
          if (typeof z.reason !== "string") errors.push(`uncertainty_zones[${i}].reason must be a string.`);
          if (typeof z.how_to_verify !== "string") errors.push(`uncertainty_zones[${i}].how_to_verify must be a string.`);
        }
      });
    }
  }

  // intent_mismatch (optional)
  if (obj.intent_mismatch !== undefined && obj.intent_mismatch !== null) {
    if (!Array.isArray(obj.intent_mismatch)) {
      errors.push("'intent_mismatch' must be an array of objects.");
    } else {
      obj.intent_mismatch.forEach((item: unknown, i: number) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          errors.push(`intent_mismatch[${i}] must be an object.`);
        } else {
          const m = item as Record<string, unknown>;
          if (typeof m.expected !== "string") errors.push(`intent_mismatch[${i}].expected must be a string.`);
          if (typeof m.observed !== "string") errors.push(`intent_mismatch[${i}].observed must be a string.`);
          if (typeof m.impact !== "string") errors.push(`intent_mismatch[${i}].impact must be a string.`);
        }
      });
    }
  }

  // failure_risks (optional)
  if (obj.failure_risks !== undefined && obj.failure_risks !== null) {
    if (!Array.isArray(obj.failure_risks)) {
      errors.push("'failure_risks' must be an array of objects.");
    } else {
      obj.failure_risks.forEach((item: unknown, i: number) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          errors.push(`failure_risks[${i}] must be an object.`);
        } else {
          const r = item as Record<string, unknown>;
          if (typeof r.risk !== "string") errors.push(`failure_risks[${i}].risk must be a string.`);
          if (
            typeof r.likelihood !== "string" ||
            !["low", "medium", "high"].includes(r.likelihood as string)
          ) {
            errors.push(`failure_risks[${i}].likelihood must be one of: low, medium, high.`);
          }
          if (typeof r.prevention !== "string") errors.push(`failure_risks[${i}].prevention must be a string.`);
          if (r.time_horizon !== undefined && r.time_horizon !== null && typeof r.time_horizon !== "string") {
            errors.push(`failure_risks[${i}].time_horizon must be a string when present.`);
          }
        }
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const result: AnalysisResult = {
    title: String(obj.title).trim(),
    confidence: obj.confidence as AnalysisResult["confidence"],
    summary: String(obj.summary).trim(),
    likely_causes: Array.isArray(obj.likely_causes)
      ? obj.likely_causes.map((c) => String(c))
      : [],
    fix_steps: Array.isArray(obj.fix_steps)
      ? obj.fix_steps.map((s: Record<string, unknown>) => ({
          step: Number((s.step as number) ?? 0),
          action: String(s.action ?? ""),
          why: String(s.why ?? ""),
        }))
      : [],
    verification: Array.isArray(obj.verification)
      ? obj.verification.map((v) => String(v))
      : [],
    explanation_beginner: String(obj.explanation_beginner ?? "").trim(),
    explanation_advanced: String(obj.explanation_advanced ?? "").trim(),
  };

  if (
    typeof obj.explanation_beginner_sankofa === "string" &&
    obj.explanation_beginner_sankofa.trim().length > 0
  ) {
    result.explanation_beginner_sankofa = obj.explanation_beginner_sankofa.trim();
  }

  if (
    obj.code_snippet &&
    typeof obj.code_snippet === "object" &&
    !Array.isArray(obj.code_snippet)
  ) {
    const cs = obj.code_snippet as Record<string, unknown>;
    result.code_snippet = {
      language: (typeof cs.language === "string" &&
      CODE_LANGUAGES.includes(cs.language as (typeof CODE_LANGUAGES)[number])
        ? cs.language
        : "text") as CodeSnippet["language"],
      content: String(cs.content ?? ""),
    };
  }

  if (Array.isArray(obj.safety_notes)) {
    result.safety_notes = obj.safety_notes.map((s) => String(s));
  }

  if (Array.isArray(obj.assumptions)) {
    result.assumptions = obj.assumptions.map((a) => String(a));
  }

  if (Array.isArray(obj.uncertainty_zones)) {
    result.uncertainty_zones = obj.uncertainty_zones.map((z: Record<string, unknown>) => ({
      area: String(z.area ?? ""),
      reason: String(z.reason ?? ""),
      how_to_verify: String(z.how_to_verify ?? ""),
    }));
    // Enforce: confidence must be medium or low when uncertainty_zones exist
    if (
      result.uncertainty_zones.length > 0 &&
      (result.confidence === "high" as const)
    ) {
      result.confidence = "medium";
    }
  }

  if (Array.isArray(obj.intent_mismatch)) {
    result.intent_mismatch = obj.intent_mismatch.map((m: Record<string, unknown>) => ({
      expected: String(m.expected ?? ""),
      observed: String(m.observed ?? ""),
      impact: String(m.impact ?? ""),
    }));
  }

  if (obj.status !== undefined && obj.status !== null) {
    if (obj.status === "pending" || obj.status === "resolved") {
      result.status = obj.status;
    }
  }

  if (typeof obj.why_this_fix_worked === "string" && obj.why_this_fix_worked.trim().length > 0) {
    result.why_this_fix_worked = obj.why_this_fix_worked.trim();
  }

  if (Array.isArray(obj.failure_risks)) {
    try {
      result.failure_risks = obj.failure_risks.map((r: Record<string, unknown>): FailureRisk => {
        let likelihood: FailureRisk["likelihood"] = "medium";
        const raw = String(r?.likelihood ?? "");
        if (raw === "low" || raw === "medium" || raw === "high") {
          likelihood = raw;
        }
        const risk = String(r?.risk ?? "");
        const prevention = String(r?.prevention ?? "");
        const item: FailureRisk = { risk, likelihood, prevention };
        const th = r?.time_horizon;
        if (typeof th === "string" && th.trim()) {
          item.time_horizon = th.trim();
        }
        return item;
      });
    } catch {
      result.failure_risks = [];
    }
  }

  return { ok: true, errors: [], result };
}
