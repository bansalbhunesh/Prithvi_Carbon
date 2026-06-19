import { describe, it, expect } from "vitest";
import {
  computeActivityKg, dailyBreakdown, dailySeries, seedDemo, DEFAULT_PROFILE,
  type Activity, type Profile,
} from "@/lib/store";

const P: Profile = { ...DEFAULT_PROFILE, state: "Maharashtra", diet: "vegetarian", household: 2, onboarded: true };
const today = new Date().toISOString().slice(0, 10);

describe("computeActivityKg", () => {
  it("electricity uses the profile state factor", () => {
    expect(computeActivityKg({ type: "electricity", date: today, kwh: 10 }, "Maharashtra"))
      .toBeCloseTo(7.5, 1); // 10 * 0.71 * 1.05 = 7.455 -> 7.5
  });
  it("scanned fuel converts litres to CO2", () => {
    expect(computeActivityKg({ type: "fuel", date: today, litres: 5, fuel: "petrol" }, "Delhi"))
      .toBeCloseTo(11.6, 1); // 5 * 2.31
  });
  it("defaults fuel type to petrol when missing", () => {
    const k = computeActivityKg({ type: "fuel", date: today, litres: 2 } as any, "Delhi");
    expect(k).toBeCloseTo(4.6, 1);
  });
});

describe("dailyBreakdown", () => {
  it("splits household categories per person but keeps transport personal", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: computeActivityKg({ type: "electricity", date: today, kwh: 10 }, P.state) },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 10, kg: computeActivityKg({ type: "commute", date: today, mode: "petrol_car", km: 10 }, P.state) },
    ];
    const b = dailyBreakdown(P, acts);
    // electricity kg is rounded per-activity to 7.5, then / 2 people = 3.75 -> 3.8
    expect(b.electricity).toBeCloseTo(3.8, 1);
    expect(b.transport).toBeCloseTo(1.6, 1);
    expect(b.diet).toBe(4.6); // vegetarian baseline
    expect(b.total).toBeCloseTo(b.electricity + b.transport + b.cooking + b.diet, 1);
  });
  it("with no activity, total equals the diet baseline", () => {
    const b = dailyBreakdown(P, []);
    expect(b.total).toBe(b.diet);
  });
  it("counts fuel under transport", () => {
    const acts: Activity[] = [
      { id: "f", date: today, type: "fuel", litres: 5, fuel: "petrol", kg: 11.6 },
    ];
    expect(dailyBreakdown(P, acts).transport).toBeGreaterThan(0);
  });
});

describe("dailySeries", () => {
  it("returns N days, oldest first, newest last is today", () => {
    const s = dailySeries(P, [], 7);
    expect(s).toHaveLength(7);
    expect(s[6].date).toBe(today);
  });
  it("never returns a total below the diet baseline", () => {
    const s = dailySeries(P, [], 7);
    for (const d of s) expect(d.total).toBeGreaterThanOrEqual(P.diet === "vegetarian" ? 4.6 : 0);
  });
});

describe("seedDemo", () => {
  it("produces an onboarded profile and a populated week", () => {
    const { profile, acts } = seedDemo();
    expect(profile.onboarded).toBe(true);
    expect(acts.length).toBeGreaterThan(5);
    for (const a of acts) expect(a.kg).toBeGreaterThanOrEqual(0);
  });
  it("demo week has no runaway flight spike (chart stays readable)", () => {
    const { profile, acts } = seedDemo();
    const totals = dailySeries(profile, acts, 7).map((d) => d.total);
    const max = Math.max(...totals);
    expect(max).toBeLessThan(30); // no 150 kg flight day
  });
});
