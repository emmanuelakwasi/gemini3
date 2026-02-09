import { z } from "zod";

const boardTypeEnum = z.enum(["ESP32", "STM32", "Arduino"]);

export const analyzeRequestSchema = z.object({
  boardType: boardTypeEnum,
  goal: z.string().min(1, "Goal is required").max(4000),
  issueText: z.string().min(1, "Observed issue / serial logs are required").max(8000),
  imageBase64: z
    .string()
    .max(4_500_000) // ~3MB base64
    .optional()
    .nullable(),
  sankofaMode: z.boolean().optional(),
});

export type AnalyzeRequestInput = z.infer<typeof analyzeRequestSchema>;

const fixStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  why: z.string(),
});

export const verifyFixRequestSchema = z.object({
  boardType: boardTypeEnum,
  goal: z.string().min(1).max(4000),
  originalIssueText: z.string().min(1).max(8000),
  previousResult: z.object({
    title: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    summary: z.string(),
    likely_causes: z.array(z.string()),
    fix_steps: z.array(fixStepSchema),
    verification: z.array(z.string()),
    explanation_beginner: z.string(),
    explanation_advanced: z.string(),
  }).passthrough(),
  newImageBase64: z.string().max(4_500_000).optional().nullable(),
  newSerialOutput: z.string().max(8000).optional(),
  confirmations: z.array(z.string()),
});

export type VerifyFixRequestInput = z.infer<typeof verifyFixRequestSchema>;
