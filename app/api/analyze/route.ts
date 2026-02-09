import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { analyzeRequestSchema } from "@/lib/schemas";
import { validateAnalysisResult } from "@/lib/validation";
import type { AnalysisResult } from "@/lib/types";

const MAX_IMAGE_WIDTH = 1280;
const JPEG_QUALITY = 80;

/** Parse data: URL, validate base64, convert to JPEG with sharp. Returns { mimeType, data } or throws. */
async function processImageForGemini(
  imageBase64: string
): Promise<{ mimeType: string; data: string; originalBytes: number; processedBytes: number }> {
  const dataUrlMatch = /^data:(image\/\w+);base64,([\s\S]*)$/i.exec(imageBase64);
  let mimeType = "image/jpeg";
  let b64 = imageBase64;
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1] ?? "image/jpeg";
    b64 = dataUrlMatch[2] ?? "";
  } else if (imageBase64.startsWith("data:")) {
    const semi = imageBase64.indexOf(";");
    const comma = imageBase64.indexOf(",");
    if (semi !== -1 && comma !== -1 && comma > semi) {
      const typePart = imageBase64.slice(5, semi).trim();
      const m = /^image\/(\w+)$/i.exec(typePart);
      if (m) mimeType = `image/${m[1].toLowerCase()}`;
      b64 = imageBase64.slice(comma + 1);
    }
  }

  b64 = b64.replace(/\s/g, "");
  if (!b64 || b64.length === 0) {
    throw new Error("Image data is empty after stripping.");
  }

  const originalBuffer = Buffer.from(b64, "base64");
  const originalBytes = originalBuffer.length;

  const processedBuffer = await sharp(originalBuffer)
    .resize(MAX_IMAGE_WIDTH, undefined, { fit: "inside" })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const processedBytes = processedBuffer.length;
  const processedB64 = processedBuffer.toString("base64");

  console.log("[analyze] Image: original", originalBytes, "bytes, processed", processedBytes, "bytes, mimeType", "image/jpeg");

  return { mimeType: "image/jpeg", data: processedB64, originalBytes, processedBytes };
}

/** Cached model name after ListModels fallback */
let cachedModelName: string | null = null;

/** True if error is 404 model not found / not supported (triggers ListModels fallback) */
function isModelNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const s = msg.toLowerCase();
  return s.includes("404") || s.includes("not found") || s.includes("not supported");
}

/** Fetch available models from ListModels API */
async function fetchAvailableModels(apiKey: string): Promise<Array<{ name: string; id: string }>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ListModels failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  const models = data.models ?? [];
  return models
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => ({
      name: m.name ?? "",
      id: (m.name ?? "").replace(/^models\//, ""),
    }))
    .filter((m) => m.id);
}

/** Select best model: prefer Flash (lowest latency), else first available */
function selectBestModel(models: Array<{ name: string; id: string }>): string | null {
  const flash = models.find((m) => /flash/i.test(m.id));
  return flash?.id ?? models[0]?.id ?? null;
}

/** Demo inputs from InputCard / Judge Mode — used to detect demo requests */
const DEMO_GOAL = "ESP32 + OLED (SSD1306) display";
const DEMO_ISSUE = "OLED stays blank; I2C scanner shows no devices.";

function isDemoRequest(goal: string, issueText: string): boolean {
  const g = (goal ?? "").trim();
  const i = (issueText ?? "").trim();
  return g === DEMO_GOAL && i === DEMO_ISSUE;
}

/** Deterministic mock for Demo Mode when API key missing or Gemini fails */
function getDemoFallbackResult(): AnalysisResult {
  return {
    title: "I2C bus not detected — check wiring and address",
    confidence: "medium",
    summary:
      "The I2C scanner shows no devices. This typically means wiring (SDA/SCL), power, or address mismatch. Verify connections and pull-ups.",
    likely_causes: [
      "SDA or SCL swapped or disconnected",
      "Missing or wrong I2C pull-up resistors (typically 4.7kΩ on SDA and SCL)",
      "Wrong I2C address (SSD1306 often 0x3C or 0x3D)",
    ],
    fix_steps: [
      { step: 1, action: "Verify SDA and SCL connections to correct ESP32 pins (e.g. GPIO 21/22)", why: "Wrong pins yield no bus." },
      { step: 2, action: "Add 4.7kΩ pull-ups on SDA and SCL to VCC if not on board", why: "I2C needs pull-ups to work." },
      { step: 3, action: "Confirm OLED VCC/GND and try address 0x3C or 0x3D in code", why: "Power or address mismatch prevents detection." },
    ],
    verification: ["Check power rail", "Confirm shared ground", "Scan I2C bus", "Verify pin map"],
    explanation_beginner:
      "I2C is a bus that lets your board talk to displays and sensors. If the scanner finds nothing, the wiring or power is usually the issue. Check SDA and SCL connections and make sure pull-up resistors are present.",
    explanation_advanced:
      "ESP32 I2C uses GPIO 21 (SDA) and 22 (SCL) by default. SSD1306 requires pull-ups (~4.7kΩ) and typically uses 0x3C or 0x3D. Verify continuity, voltage, and address in your code.",
    uncertainty_zones: [
      { area: "Actual wiring", reason: "Image or description may be incomplete", how_to_verify: "Measure continuity SDA/SCL to pins" },
    ],
    intent_mismatch: [
      { expected: "I2C SDA/SCL on correct pins with pull-ups", observed: "No devices on bus", impact: "OLED not detected" },
    ],
  };
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error("GEMINI_API_KEY is not set in .env.local");
  }
  return key.trim();
}

function getGeminiClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(getApiKey());
}

function buildPrompt(
  boardType: string,
  goal: string,
  issueText: string,
  hasImage: boolean,
  sankofaMode: boolean
): string {
  const sankofaBlock = sankofaMode
    ? `
- Sankofa Mode (when true, also provide "explanation_beginner_sankofa"): Rewrite the beginner explanation using culturally neutral, relatable metaphors—e.g. shared paths, checkpoints, community of components working together. Keep it professional and subtle; never stereotype or overdo it. Same technical content as explanation_beginner, just framed in these accessible images.`
    : "";

  const sankofaJson = sankofaMode
    ? ', "explanation_beginner_sankofa": "Same as explanation_beginner but with subtle, relatable metaphors (shared paths, checkpoints). Professional tone; no stereotyping."'
    : "";

  return `You are an expert embedded systems engineer. Analyze this setup and respond with a single JSON object only. No markdown, no code fences, no explanation before or after — just the JSON. Use calm, direct engineering language. No apologetic or hedging phrasing.

RULES (follow strictly):
- Uncertainty: If visual evidence is incomplete (no image, blurry image, wiring not visible, board not identifiable, or key areas obscured), you MUST populate "uncertainty_zones". Each zone has: "area" (what is unclear), "reason" (why it is unclear), "how_to_verify" (one concrete physical action, e.g. "Touch probe to GND", "Measure voltage at pin 4", "Inspect solder joint under magnifier").
- Confidence: When "uncertainty_zones" has one or more entries, set "confidence" to "medium" or "low" only — never "high". Use "low" when multiple critical areas are unverified.
- Design intent vs wiring reality: Infer the INTENDED signal flow from the user's goal (e.g. "I2C sensor on SDA/SCL", "UART TX→RX"). Infer the ACTUAL signal flow from the wiring (and image if provided). Compare the two. For each mismatch, add one entry to "intent_mismatch" with: "expected" (what the goal implies), "observed" (what the wiring shows), "impact" (brief consequence, e.g. "No I2C traffic", "Wrong baud"). Omit "intent_mismatch" or use [] when there are no mismatches.
- Safety: Consider power rails, shared GND, 3.3V vs 5V, shorts, reverse polarity. Include safety_notes when relevant.
- Failure risks: Predict likely failure modes based on (1) wiring (loose connections, wrong pins, no pull-ups), (2) power assumptions (voltage mismatch, current limits, brownout), (3) board limits (pin current, total I/O, thermal). For each risk add one entry to "failure_risks" with: "risk" (short description), "likelihood" ("low" | "medium" | "high"), optional "time_horizon" (e.g. "under load", "over time"), "prevention" (one concrete action). These are preventive checks, not current errors. Omit or use [] when none apply.
- Use "confidence" only as: "low" | "medium" | "high".
- Use bench language in verification: "Check power rail", "Confirm shared ground", "Scan I2C bus", "Verify pin map", "Measure voltage", "Test continuity".
- Explanations: Always include BOTH "explanation_beginner" and "explanation_advanced":
  - "explanation_beginner": 2–4 sentences for someone new to electronics. Avoid acronyms; if you must use one (e.g. I2C, GND), explain it in parentheses. Focus on what the issue means and the key fix.${sankofaBlock}
  - "explanation_advanced": 2–4 sentences for experienced engineers. Use technical terms freely: pin numbers, voltage levels, protocols (I2C, SPI, UART), register names, timing, pull-up/down resistors, etc.

Input:
- Board: ${boardType}
- Goal: ${goal}
- Observed issue / serial logs: ${issueText}
- Image provided: ${hasImage ? "yes" : "no"}
- Sankofa Mode: ${sankofaMode ? "yes" : "no"}

Respond with exactly this JSON shape (snake_case keys only). Output nothing else:
{
  "title": "Short diagnostic title",
  "confidence": "low" | "medium" | "high",
  "summary": "One or two sentence summary of the diagnosis.",
  "likely_causes": ["cause1", "cause2"],
  "fix_steps": [
    { "step": 1, "action": "what to do", "why": "why it helps" }
  ],
  "verification": ["Check power rail", "Confirm shared ground", "Scan I2C bus"],
  "explanation_beginner": "Plain-language explanation for beginners (no unexplained acronyms).",
  "explanation_advanced": "Technical explanation with pins, voltages, protocols."${sankofaJson}
  ,
  "uncertainty_zones": [
    { "area": "what is unclear", "reason": "why unclear", "how_to_verify": "concrete physical action" }
  ],
  "intent_mismatch": [
    { "expected": "intended signal/pin from goal", "observed": "what wiring actually shows", "impact": "brief consequence" }
  ],
  "code_snippet": { "language": "cpp" | "c" | "python" | "text", "content": "code here" },
  "safety_notes": ["Optional safety warning"],
  "assumptions": ["What you assumed if image was unclear or info missing"]
}

Include "uncertainty_zones" whenever visual or contextual evidence is incomplete; omit only when the setup is fully visible and unambiguous. Populate "intent_mismatch" only when goal and wiring disagree; use [] or omit when they align. Populate "failure_risks" with predicted failure modes from wiring, power, and board limits; use [] or omit when none. When Sankofa Mode is yes, always include "explanation_beginner_sankofa". Omit code_snippet, safety_notes, or assumptions if empty. Always include title, confidence, summary, likely_causes, fix_steps, verification, explanation_beginner, and explanation_advanced.`;
}

/**
 * Extract a JSON object from model text: strip markdown fences and find first { ... }.
 */
function extractJsonFromText(text: string): string | null {
  let s = text.trim();
  const codeFence = /^```(?:json)?\s*([\s\S]*?)```\s*$/i;
  const match = s.match(codeFence);
  if (match) s = match[1].trim();
  else {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  return s.slice(start, end + 1);
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parseResult = analyzeRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      const msg = parseResult.error.flatten().formErrors.join("; ") || "Invalid request body";
      console.log("[analyze] Error: 400", msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { boardType, goal, issueText, imageBase64, sankofaMode } = parseResult.data;
    const demoMode = isDemoRequest(goal, issueText);
    console.log("[analyze] Request start:", { boardType, demoMode });

    let genAI: GoogleGenerativeAI;
    try {
      genAI = getGeminiClient();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.log("[analyze] Missing GEMINI_API_KEY" + (demoMode ? " -> fallback" : ""));
      console.error("[analyze] GEMINI_API_KEY missing or client init failed:", err.message);
      if (demoMode) {
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = err.message || "Missing GEMINI_API_KEY";
      console.log("[analyze] Error: 500", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const hasImage = !!(imageBase64 && imageBase64.trim());
    const prompt = buildPrompt(boardType, goal, issueText, hasImage, !!sankofaMode);

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (hasImage) {
      try {
        const processed = await processImageForGemini(imageBase64!.trim());
        parts.push({ inlineData: { mimeType: processed.mimeType, data: processed.data } });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[analyze] Image processing failed:", err.message);
        if (demoMode) {
          return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
        }
        const msg = "Could not process image. Use a valid JPEG or PNG under 3MB.";
        console.log("[analyze] Error: 400", msg);
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    parts.push({ text: prompt });

    const preferredModel = process.env.GEMINI_MODEL?.trim() || null;
    let modelName = preferredModel || cachedModelName || "gemini-2.0-flash";
    let usedFallback = false;
    let text = "";

    try {
      console.log("[analyze] Calling Gemini...");
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      const response = result.response;
      text = response.text() ?? "";
      if (usedFallback) {
        console.log("[analyze] Model not available, auto-selected:", modelName);
      }
      cachedModelName = modelName;
      console.log("[analyze] Using model:", modelName);
      console.log("[analyze] Gemini success");
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (isModelNotFoundError(e)) {
        try {
          const apiKey = getApiKey();
          const available = await fetchAvailableModels(apiKey);
          const selected = selectBestModel(available);
          if (selected) {
            cachedModelName = selected;
            usedFallback = true;
            modelName = selected;
            console.log("[analyze] Model not available, auto-selected:", modelName);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(parts);
            const response = result.response;
            text = response.text() ?? "";
            cachedModelName = modelName;
            console.log("[analyze] Using model:", modelName);
            console.log("[analyze] Gemini success");
          } else {
            throw new Error("No model with generateContent support found");
          }
        } catch (fallbackErr) {
          const fallback = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
          console.error("[analyze] ListModels fallback failed:", fallback.message);
          if (demoMode) {
            return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
          }
          const msg = "No supported model available. Check connection and retry.";
          console.log("[analyze] Error: 500", msg);
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      } else {
        console.error("[analyze] Gemini API call failed:", err.message);
        if (demoMode) {
          return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
        }
        const msg = "Analysis failed. Check connection and retry.";
        console.log("[analyze] Error: 500", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    if (!text.trim()) {
      if (demoMode) {
        console.error("[analyze] Gemini returned empty text (demo mode)");
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = "Model returned no text. Adjust input and retry.";
      console.log("[analyze] Error: 502", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const jsonStr = extractJsonFromText(text);
    if (!jsonStr) {
      if (demoMode) {
        console.error("[analyze] Could not extract JSON from Gemini response (demo mode)");
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = "Could not parse model response. Retry.";
      console.log("[analyze] Error: 502", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr) as unknown;
    } catch {
      if (demoMode) {
        console.error("[analyze] Gemini response was not valid JSON (demo mode)");
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = "Model response was not valid JSON. Retry.";
      console.log("[analyze] Error: 502", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let validation;
    try {
      validation = validateAnalysisResult(parsed);
    } catch {
      if (demoMode) {
        console.error("[analyze] Model response validation failed (demo mode)");
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = "Model response could not be validated. Retry.";
      console.log("[analyze] Error: 502", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    if (!validation.ok) {
      if (demoMode) {
        console.error("[analyze] Model response shape invalid (demo mode):", validation.errors);
        return NextResponse.json({ ...getDemoFallbackResult(), fallback: true });
      }
      const msg = "Model response shape invalid.";
      console.log("[analyze] Error: 502", msg);
      return NextResponse.json(
        { error: msg, details: validation.errors },
        { status: 502 }
      );
    }

    const payload: AnalysisResult = validation.result!;
    return NextResponse.json(payload);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[analyze] Unexpected error:", err.message);
    if (e instanceof SyntaxError) {
      const msg = "Invalid JSON in request body.";
      console.log("[analyze] Error: 400", msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const msg = "Analysis failed. Check connection and retry.";
    console.log("[analyze] Error: 500", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
