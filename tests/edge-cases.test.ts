import { describe, it, expect, beforeEach } from "vitest";
import {
  computeActivityKg, dailyBreakdown, dailySeries,
  type Profile, type Activity,
} from "@/lib/store";
import { rateLimit, __resetRateLimit } from "@/lib/rate-limit";
import { round1, electricityKg, transportKg, lpgKg, dietDailyKg } from "@/lib/factors";
import { ScanRequestSchema, ScanResultSchema } from "@/lib/scan-schema";
import { parseGeminiJson, GeminiError } from "@/lib/gemini";

const today = new Date().toISOString().slice(0, 10);
const P: Profile = { name: "Edge", state: "All India", diet: "vegetarian", household: 1, onboarded: true };

describe("edge cases — extreme numeric values", () => {
  it("very large kWh doesn't crash", () => {
    const kg = computeActivityKg({ type: "electricity", date: today, kwh: 99999 }, "All India");
    expect(kg).toBeGreaterThan(0);
    expect(isFinite(kg)).toBe(true);
  });

  it("very large km doesn't crash", () => {
    const kg = computeActivityKg({ type: "commute", date: today, mode: "petrol_car", km: 100000 }, "All India");
    expect(kg).toBeGreaterThan(0);
    expect(isFinite(kg)).toBe(true);
  });

  it("very small fractional values", () => {
    expect(electricityKg(0.001, "Delhi")).toBeGreaterThan(0);
    expect(transportKg("petrol_car", 0.001)).toBeGreaterThan(0);
    expect(lpgKg(0.001)).toBeGreaterThan(0);
  });

  it("round1 handles Infinity gracefully", () => {
    expect(round1(Infinity)).toBe(Infinity);
    expect(round1(-Infinity)).toBe(-Infinity);
  });

  it("round1 handles NaN", () => {
    expect(isNaN(round1(NaN))).toBe(true);
  });
});

describe("edge cases — boundary conditions in breakdown", () => {
  it("100 activities doesn't crash", () => {
    const acts: Activity[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(i), date: today, type: "electricity" as const, kwh: 1, kg: 0.7,
    }));
    const b = dailyBreakdown(P, acts);
    expect(b.electricity).toBeGreaterThan(0);
    expect(isFinite(b.total)).toBe(true);
  });

  it("activities spanning 365 days", () => {
    const acts: Activity[] = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return { id: String(i), date: d.toISOString().slice(0, 10), type: "electricity" as const, kwh: 5, kg: 3.6 };
    });
    const b = dailyBreakdown(P, acts);
    expect(isFinite(b.total)).toBe(true);
    expect(b.electricity).toBeGreaterThan(0);
  });

  it("dailySeries with 1 day", () => {
    const s = dailySeries(P, [], 1);
    expect(s).toHaveLength(1);
    expect(s[0].date).toBe(today);
  });

  it("dailySeries with 30 days", () => {
    const s = dailySeries(P, [], 30);
    expect(s).toHaveLength(30);
    expect(s[29].date).toBe(today);
  });
});

describe("edge cases — special string inputs", () => {
  it("state with special characters falls back safely", () => {
    expect(electricityKg(10, "<script>")).toBeCloseTo(7.1, 1);
  });

  it("empty state string falls back to national", () => {
    expect(electricityKg(10, "")).toBeCloseTo(7.1, 1);
  });

  it("diet with empty string defaults to vegetarian", () => {
    expect(dietDailyKg("")).toBe(dietDailyKg("vegetarian"));
  });
});

describe("rate limiter — stress", () => {
  beforeEach(() => __resetRateLimit());

  it("handles 100 different IPs without issue", () => {
    for (let i = 0; i < 100; i++) {
      const r = rateLimit(`ip-${i}`, 5, 60_000);
      expect(r.ok).toBe(true);
    }
  });

  it("rapid successive calls to same IP", () => {
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 100; i++) {
      const r = rateLimit("rapid-ip", 12, 60_000);
      if (r.ok) allowed++;
      else blocked++;
    }
    expect(allowed).toBe(12);
    expect(blocked).toBe(88);
  });
});

describe("schema — boundary values", () => {
  it("ScanResult kwh at max boundary (100000)", () => {
    const r = ScanResultSchema.safeParse({
      detected: "electricity", kwh: 100000, litres: null, fuel: null, note: "",
    });
    expect(r.success).toBe(true);
  });

  it("ScanResult litres at max boundary (10000)", () => {
    const r = ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: 10000, fuel: "diesel", note: "",
    });
    expect(r.success).toBe(true);
  });

  it("ScanRequest image at minimum length (32)", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(32) });
    expect(r.success).toBe(true);
  });

  it("ScanRequest image at length 31 is rejected", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(31) });
    expect(r.success).toBe(false);
  });
});

describe("parseGeminiJson — edge cases", () => {
  it("handles newlines in note field", () => {
    const json = '{"detected":"unknown","kwh":null,"litres":null,"fuel":null,"note":"line1\\nline2"}';
    const r = parseGeminiJson(json);
    expect(r.note).toContain("line1");
  });

  it("handles unicode in note field", () => {
    const json = '{"detected":"unknown","kwh":null,"litres":null,"fuel":null,"note":"बिजली बिल"}';
    const r = parseGeminiJson(json);
    expect(r.note).toContain("बिजली");
  });

  it("handles kwh with decimal precision", () => {
    const r = parseGeminiJson('{"detected":"electricity","kwh":214.567,"litres":null,"fuel":null,"note":""}');
    expect(r.kwh).toBeCloseTo(214.567, 3);
  });

  it("rejects when JSON is valid but schema fails", () => {
    expect(() => parseGeminiJson('{"foo":"bar"}')).toThrow(GeminiError);
  });

  it("rejects nested objects", () => {
    expect(() => parseGeminiJson('{"detected":{"value":"electricity"}}')).toThrow(GeminiError);
  });
});

describe("data consistency invariants", () => {
  it("breakdown total is never negative with valid inputs", () => {
    const diets = ["vegan", "vegetarian", "eggetarian", "nonveg_light", "nonveg_heavy"];
    for (const diet of diets) {
      const b = dailyBreakdown({ ...P, diet }, []);
      expect(b.total).toBeGreaterThan(0);
    }
  });

  it("computeActivityKg is deterministic", () => {
    const input = { type: "electricity" as const, date: today, kwh: 10 };
    const r1 = computeActivityKg(input, "Delhi");
    const r2 = computeActivityKg(input, "Delhi");
    expect(r1).toBe(r2);
  });

  it("daily series totals are always finite", () => {
    const s = dailySeries(P, [], 7);
    for (const d of s) {
      expect(isFinite(d.total)).toBe(true);
    }
  });

  it("recommendation scores are finite and non-negative", async () => {
    const { recommend } = await import("@/lib/recommend");
    const b = dailyBreakdown({ ...P, diet: "nonveg_heavy" }, [
      { id: "1", date: today, type: "electricity", kwh: 20, kg: 14 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 30, kg: 4.7 },
    ]);
    const recos = recommend({ ...P, diet: "nonveg_heavy" }, b);
    for (const r of recos) {
      expect(isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
    }
  });
});
