import { describe, it, expect, beforeEach } from "vitest";
import { ScanRequestSchema, ScanResultSchema, stripDataUrl, MAX_IMAGE_BASE64_CHARS } from "@/lib/scan-schema";
import { parseGeminiJson, GeminiError } from "@/lib/gemini";
import { rateLimit, clientKey, __resetRateLimit } from "@/lib/rate-limit";
import { recommend } from "@/lib/recommend";
import { dailyBreakdown, DEFAULT_PROFILE, type Profile, type Activity } from "@/lib/store";

describe("scan input validation (security)", () => {
  it("accepts clean base64", () => {
    const r = ScanRequestSchema.safeParse({ image: "AAAA".repeat(10), mime: "image/png" });
    expect(r.success).toBe(true);
  });
  it("rejects non-base64 payloads", () => {
    const r = ScanRequestSchema.safeParse({ image: "<script>alert(1)</script>" });
    expect(r.success).toBe(false);
  });
  it("rejects oversized images", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(MAX_IMAGE_BASE64_CHARS + 1) });
    expect(r.success).toBe(false);
  });
  it("rejects disallowed mime types", () => {
    const r = ScanRequestSchema.safeParse({ image: "AAAA".repeat(10), mime: "image/svg+xml" });
    expect(r.success).toBe(false);
  });
  it("strips data: URL prefixes", () => {
    expect(stripDataUrl("data:image/jpeg;base64,QUJD")).toBe("QUJD");
    expect(stripDataUrl("QUJD")).toBe("QUJD");
  });
});

describe("Gemini output is never trusted blindly", () => {
  it("parses valid model JSON", () => {
    const out = parseGeminiJson('{"detected":"electricity","kwh":214,"litres":null,"fuel":null,"note":"ok"}');
    expect(out.detected).toBe("electricity");
    expect(out.kwh).toBe(214);
  });
  it("tolerates markdown fences", () => {
    const out = parseGeminiJson('```json\n{"detected":"unknown","kwh":null,"litres":null,"fuel":null,"note":"x"}\n```');
    expect(out.detected).toBe("unknown");
  });
  it("throws on non-JSON", () => {
    expect(() => parseGeminiJson("totally not json")).toThrow(GeminiError);
  });
  it("rejects out-of-range / malformed values", () => {
    expect(() => parseGeminiJson('{"detected":"electricity","kwh":-5,"litres":null,"fuel":null,"note":""}')).toThrow();
    const bad = ScanResultSchema.safeParse({ detected: "banana", kwh: null, litres: null, fuel: null, note: "" });
    expect(bad.success).toBe(false);
  });
});

describe("rate limiter", () => {
  beforeEach(() => __resetRateLimit());
  it("allows up to the limit then blocks", () => {
    let blocked = false;
    for (let i = 0; i < 13; i++) {
      const r = rateLimit("1.2.3.4", 12, 60_000);
      if (!r.ok) blocked = true;
    }
    expect(blocked).toBe(true);
  });
  it("keys are isolated per client", () => {
    for (let i = 0; i < 12; i++) rateLimit("a", 12);
    expect(rateLimit("b", 12).ok).toBe(true);
  });
  it("derives a client key from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientKey(h)).toBe("9.9.9.9");
  });
});

describe("recommendation engine (functionality)", () => {
  const P: Profile = { ...DEFAULT_PROFILE, diet: "nonveg_heavy", household: 1, onboarded: true };
  it("ranks by impact x feasibility and caps at 5", () => {
    const acts: Activity[] = [
      { id: "1", date: "2026-06-01", type: "electricity", kwh: 30, kg: 21 },
      { id: "2", date: "2026-06-01", type: "commute", mode: "petrol_car", km: 40, kg: 6.2 },
    ];
    const b = dailyBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.length).toBeGreaterThan(0);
    expect(recos.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < recos.length; i++) {
      expect(recos[i - 1].score).toBeGreaterThanOrEqual(recos[i].score);
    }
  });
  it("suggests a realistic one-step diet shift for heavy non-veg", () => {
    const b = dailyBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "diet")).toBe(true);
  });
});
