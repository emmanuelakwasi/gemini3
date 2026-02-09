import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyFixRequestSchema } from "@/lib/schemas";
import type { AnalysisResult } from "@/lib/types";

const MODEL = "gemini-1.5-flash";

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error("GEMINI_API_KEY is not set in .env.local");
  }
  return new GoogleGenerativeAI(key.trim());
}

function buildVerifyPrompt(
  boardType: string,
  goal: string,
  originalIssueText: string,
  previousResult: AnalysisResult,
  newSerialOutput: string,
  confirmations: string[]
): string {
  const fixStepsText = previousResult.fix_steps
    .map((s) => `Step ${s.step}: ${s.action} (why: ${s.why})`)
    .join("\n");

  return `You are an expert embedded systems engineer. A user received a diagnosis and fix steps. They have applied the fix and are providing new evidence to verify it. Determine if the fix is verified.

Previous diagnosis:
- Board: ${boardType}
- Goal: ${goal}
- Original issue: ${originalIssueText}
- Title: ${previousResult.title}
- Summary: ${previousResult.summary}

Fix steps that were suggested:
${fixStepsText}

New evidence from the user:
- New serial output: ${newSerialOutput || "(none provided)"}
- User confirmations (checkboxes they checked): ${confirmations.length > 0 ? confirmations.join("; ") : "(none)"}

Respond with a single JSON object only. No markdown, no code fences. Use exactly these keys:
{
  "status": "resolved" | "pending",
  "why_this_fix_worked": "One or two sentences explaining why the fix worked, only when status is resolved. Be specific to the evidence (e.g. I2C address in serial, wiring in image). Omit or empty string when status is pending."
}

Rules:
- Set "status" to "resolved" only when the new evidence (serial output and/or confirmations) clearly indicates the fix worked (e.g. I2C scanner shows device, serial shows expected output). If evidence is missing or ambiguous, use "pending".
- When status is "resolved", "why_this_fix_worked" must be a short, concrete explanation (1-2 sentences).
- When status is "pending", set "why_this_fix_worked" to "" or omit it.
Output nothing else.`;
}

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
    const parseResult = verifyFixRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      const msg = parseResult.error.flatten().formErrors.join("; ") || "Invalid request body";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const {
      boardType,
      goal,
      originalIssueText,
      previousResult,
      newImageBase64,
      newSerialOutput = "",
      confirmations,
    } = parseResult.data;

    let genAI: GoogleGenerativeAI;
    try {
      genAI = getGeminiClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Missing GEMINI_API_KEY";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const prompt = buildVerifyPrompt(
      boardType,
      goal,
      originalIssueText,
      previousResult as AnalysisResult,
      newSerialOutput,
      confirmations
    );

    const model = genAI.getGenerativeModel({ model: MODEL });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (newImageBase64 && newImageBase64.trim()) {
      const match = /^data:(image\/\w+);base64,/.exec(newImageBase64);
      const mime = match?.[1] ?? "image/jpeg";
      const b64 = newImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ inlineData: { mimeType: mime, data: b64 } });
    }
    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text() ?? "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Model returned no text. Retry." },
        { status: 502 }
      );
    }

    const jsonStr = extractJsonFromText(text);
    if (!jsonStr) {
      return NextResponse.json(
        { error: "Could not find valid JSON in the response." },
        { status: 502 }
      );
    }

    let parsed: { status?: string; why_this_fix_worked?: string };
    try {
      parsed = JSON.parse(jsonStr) as { status?: string; why_this_fix_worked?: string };
    } catch {
      return NextResponse.json(
        { error: "Model response was not valid JSON." },
        { status: 502 }
      );
    }

    const status =
      parsed.status === "resolved" || parsed.status === "pending" ? parsed.status : "pending";
    const why_this_fix_worked =
      typeof parsed.why_this_fix_worked === "string" ? parsed.why_this_fix_worked.trim() : "";

    const merged: AnalysisResult = {
      ...(previousResult as AnalysisResult),
      status,
      confidence: status === "resolved" ? "high" : (previousResult as AnalysisResult).confidence,
      why_this_fix_worked: status === "resolved" && why_this_fix_worked ? why_this_fix_worked : undefined,
    };

    return NextResponse.json(merged);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Verify fix failed. Check connection and retry." },
      { status: 500 }
    );
  }
}
