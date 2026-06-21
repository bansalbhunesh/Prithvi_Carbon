import { NextRequest, NextResponse } from "next/server";
import { ScanRequestSchema, stripDataUrl } from "@/lib/scan-schema";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { extractFromDocument, GeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req.headers));
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many scans. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

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

  try {
    const result = await extractFromDocument(parsed.data.image, parsed.data.mime);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof GeminiError) {
      const status = e.status === 503 ? 200 : e.status;
      return NextResponse.json({ ok: false, error: e.message }, { status });
    }
    return NextResponse.json({ ok: false, error: "Scan failed" }, { status: 500 });
  }
}
