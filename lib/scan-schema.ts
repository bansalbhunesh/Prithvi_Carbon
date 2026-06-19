/**
 * scan-schema.ts — input/output contracts for the /api/scan endpoint.
 * Validation lives in one place so the route stays a thin controller and
 * every boundary is type-checked (Security + Architecture).
 */
import { z } from "zod";

/** Max decoded image payload we accept (~6 MB of base64 ≈ 4.5 MB image). */
export const MAX_IMAGE_BASE64_CHARS = 6_000_000;

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** What the client may POST. Base64 is the raw payload WITHOUT the data: URL prefix. */
export const ScanRequestSchema = z.object({
  image: z
    .string()
    .min(32, "image too small")
    .max(MAX_IMAGE_BASE64_CHARS, "image too large")
    .regex(/^[A-Za-z0-9+/=\r\n]+$/, "image must be base64"),
  mime: z.enum(ALLOWED_MIME).default("image/jpeg"),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/** What we trust back from Gemini after re-validation (never trust raw LLM JSON). */
export const ScanResultSchema = z.object({
  detected: z.enum(["electricity", "fuel", "unknown"]),
  kwh: z.number().nonnegative().max(100_000).nullable().default(null),
  litres: z.number().nonnegative().max(10_000).nullable().default(null),
  fuel: z.enum(["petrol", "diesel"]).nullable().default(null),
  note: z.string().max(280).default(""),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

/** Strip a data: URL prefix if the client forgot to. */
export function stripDataUrl(s: string): string {
  const i = s.indexOf("base64,");
  return i >= 0 ? s.slice(i + "base64,".length) : s;
}
