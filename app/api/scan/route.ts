/**
 * POST /api/scan — hardened controller. Pipeline:
 *   rate-limit  ->  validate input  ->  Gemini service  ->  respond
 * Each concern lives in its own module; this file only orchestrates.
 *
 * Security: API key is server-only (never shipped to the client); inputs are
 * Zod-validated and size-capped; the endpoint is rate-limited; the model's
 * output is re-validated; image text is treated as untrusted data.
 */
import { NextRequest, NextResponse } from "next/server";
import { ScanRequestSchema, stripDataUrl } from "@/lib/scan-schema";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { extractFromDocument, GeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 1) rate limit (protect the paid AI endpoint)
  const rl = rateLimit(clientKey(req.headers));
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many scans. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 2) parse + validate input
  let json: unknown;
  try { json = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = ScanRequestSchema.safeParse(
    typeof json === "object" && json
      ? { ...json, image: stripDataUrl(String((json as any).image ?? "")) }
      : {},
  );
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 422 },
    );
  }

  // 3) call the isolated Gemini service
  try {
    const result = await extractFromDocument(parsed.data.image, parsed.data.mime);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof GeminiError) {
      // soft-fail (200) for "no key" so the UI can fall back to manual entry
      const status = e.status === 503 ? 200 : e.status;
      return NextResponse.json({ ok: false, error: e.message }, { status });
    }
    return NextResponse.json({ ok: false, error: "Scan failed" }, { status: 500 });
  }
}
