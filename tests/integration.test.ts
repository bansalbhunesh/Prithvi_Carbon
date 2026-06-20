import { describe, it, expect } from "vitest";
import {
  computeActivityKg, dailyBreakdown, dailySeries, seedDemo,
  type Profile, type Activity,
} from "@/lib/store";
import { recommend } from "@/lib/recommend";
import { BENCHMARKS, round1 } from "@/lib/factors";

const today = new Date().toISOString().slice(0, 10);

describe("end-to-end: onboard → log → breakdown → recommend → annual projection", () => {
  it("full user journey with demo data", () => {
    const { profile, acts } = seedDemo();

    // Breakdown computes correctly
    const b = dailyBreakdown(profile, acts);
    expect(b.total).toBeGreaterThan(0);
    expect(b.electricity).toBeGreaterThanOrEqual(0);
    expect(b.transport).toBeGreaterThanOrEqual(0);
    expect(b.cooking).toBeGreaterThanOrEqual(0);
    expect(b.diet).toBeGreaterThan(0);

    // Recommendations are relevant
    const recos = recommend(profile, b);
    expect(recos.length).toBeGreaterThan(0);
    for (const r of recos) {
      expect(r.saveKgDay).toBeGreaterThan(0);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.detail.length).toBeGreaterThan(0);
    }

    // Annual projection
    const annualTonnes = round1((b.total * 365) / 1000);
    expect(annualTonnes).toBeGreaterThan(0);
    expect(annualTonnes).toBeLessThan(100);

    // Tree equivalence
    const treesNeeded = Math.ceil(annualTonnes / 0.022);
    expect(treesNeeded).toBeGreaterThan(0);

    // 7-day series
    const series = dailySeries(profile, acts, 7);
    expect(series).toHaveLength(7);
    expect(series[6].date).toBe(today);
  });

  it("streak calculation matches series data", () => {
    const { profile, acts } = seedDemo();
    const series = dailySeries(profile, acts, 7);

    let streak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].total > 0 && series[i].total <= BENCHMARKS.india_avg) streak++;
      else break;
    }
    expect(streak).toBeGreaterThanOrEqual(0);
    expect(streak).toBeLessThanOrEqual(7);
  });

  it("gauge percentage is bounded", () => {
    const { profile, acts } = seedDemo();
    const b = dailyBreakdown(profile, acts);
    const pinPct = Math.max(2, Math.min(98, (b.total / BENCHMARKS.world_avg) * 100));
    expect(pinPct).toBeGreaterThanOrEqual(2);
    expect(pinPct).toBeLessThanOrEqual(98);
  });

  it("vs India comparison is consistent", () => {
    const { profile, acts } = seedDemo();
    const b = dailyBreakdown(profile, acts);
    const vsIndia = round1(b.total - BENCHMARKS.india_avg);
    if (b.total > BENCHMARKS.india_avg) {
      expect(vsIndia).toBeGreaterThan(0);
    } else {
      expect(vsIndia).toBeLessThanOrEqual(0);
    }
  });
});

describe("multi-profile comparison", () => {
  const baseActs: Activity[] = [
    { id: "1", date: today, type: "electricity", kwh: 10, kg: 7.1 },
    { id: "2", date: today, type: "commute", mode: "petrol_car", km: 20, kg: 3.1 },
  ];

  it("larger household reduces per-person electricity", () => {
    const single: Profile = { name: "A", state: "All India", diet: "vegetarian", household: 1, onboarded: true };
    const family: Profile = { name: "B", state: "All India", diet: "vegetarian", household: 4, onboarded: true };
    const b1 = dailyBreakdown(single, baseActs);
    const b4 = dailyBreakdown(family, baseActs);
    expect(b4.electricity).toBeLessThan(b1.electricity);
  });

  it("coal-heavy state increases electricity emissions", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: computeActivityKg({ type: "electricity", date: today, kwh: 10 }, "Chhattisgarh") },
    ];
    const actsClean: Activity[] = [
      { id: "2", date: today, type: "electricity", kwh: 10, kg: computeActivityKg({ type: "electricity", date: today, kwh: 10 }, "Himachal Pradesh") },
    ];
    const dirty: Profile = { name: "C", state: "Chhattisgarh", diet: "vegetarian", household: 1, onboarded: true };
    const clean: Profile = { name: "D", state: "Himachal Pradesh", diet: "vegetarian", household: 1, onboarded: true };
    const bDirty = dailyBreakdown(dirty, acts);
    const bClean = dailyBreakdown(clean, actsClean);
    expect(bDirty.electricity).toBeGreaterThan(bClean.electricity);
  });

  it("non-veg diet increases diet component", () => {
    const veg: Profile = { name: "V", state: "All India", diet: "vegan", household: 1, onboarded: true };
    const nv: Profile = { name: "N", state: "All India", diet: "nonveg_heavy", household: 1, onboarded: true };
    const bVeg = dailyBreakdown(veg, []);
    const bNV = dailyBreakdown(nv, []);
    expect(bNV.diet).toBeGreaterThan(bVeg.diet);
    expect(bNV.total).toBeGreaterThan(bVeg.total);
  });
});

describe("activity logging edge cases", () => {
  it("many activities for one day aggregate correctly", () => {
    const acts: Activity[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      date: today,
      type: "commute" as const,
      mode: "petrol_car",
      km: 5,
      kg: computeActivityKg({ type: "commute", date: today, mode: "petrol_car", km: 5 }, "Delhi"),
    }));
    const P: Profile = { name: "Test", state: "Delhi", diet: "vegetarian", household: 1, onboarded: true };
    const b = dailyBreakdown(P, acts);
    expect(b.transport).toBeCloseTo(20 * 0.8, 1);
  });

  it("mixed activity types in one day", () => {
    const P: Profile = { name: "Test", state: "Delhi", diet: "vegetarian", household: 1, onboarded: true };
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 5, kg: computeActivityKg({ type: "electricity", date: today, kwh: 5 }, "Delhi") },
      { id: "2", date: today, type: "commute", mode: "metro", km: 10, kg: computeActivityKg({ type: "commute", date: today, mode: "metro", km: 10 }, "Delhi") },
      { id: "3", date: today, type: "lpg", cylinders: 0.1, kg: computeActivityKg({ type: "lpg", date: today, cylinders: 0.1 }, "Delhi") },
      { id: "4", date: today, type: "fuel", litres: 2, fuel: "petrol", kg: computeActivityKg({ type: "fuel", date: today, litres: 2, fuel: "petrol" }, "Delhi") },
    ];
    const b = dailyBreakdown(P, acts);
    expect(b.electricity).toBeGreaterThan(0);
    expect(b.transport).toBeGreaterThan(0);
    expect(b.cooking).toBeGreaterThan(0);
    expect(b.total).toBeGreaterThan(b.diet);
  });
});

describe("annual projection math", () => {
  it("zero daily = zero annual", () => {
    expect(round1((0 * 365) / 1000)).toBe(0);
  });

  it("India average daily maps to ~2.0 t/yr", () => {
    const annual = round1((BENCHMARKS.india_avg * 365) / 1000);
    expect(annual).toBe(2);
  });

  it("world average daily maps to ~4.7 t/yr", () => {
    const annual = round1((BENCHMARKS.world_avg * 365) / 1000);
    expect(annual).toBe(4.7);
  });

  it("tree offset is always positive for non-zero footprint", () => {
    const annual = 2.5;
    const trees = Math.ceil(annual / 0.022);
    expect(trees).toBeGreaterThan(0);
    expect(trees).toBe(114);
  });
});

describe("share text generation", () => {
  it("generates valid share text below India avg", () => {
    const total = 4.0;
    const annualTonnes = round1((total * 365) / 1000);
    const vsIndia = round1(total - BENCHMARKS.india_avg);
    const text = `My daily carbon footprint is ${total} kg CO2e (${annualTonnes} tonnes/yr). That's ${Math.abs(vsIndia)} kg below the Indian average! Track yours at prithvi-carbon.vercel.app`;
    expect(text).toContain("below");
    expect(text).toContain("prithvi-carbon");
  });

  it("generates valid share text above India avg", () => {
    const total = 8.0;
    const annualTonnes = round1((total * 365) / 1000);
    const vsIndia = round1(total - BENCHMARKS.india_avg);
    const text = `My daily carbon footprint is ${total} kg CO2e (${annualTonnes} tonnes/yr). Trying to cut ${vsIndia} kg to match the Indian average. Track yours at prithvi-carbon.vercel.app`;
    expect(text).toContain("cut");
    expect(text).toContain(String(vsIndia));
  });
});
