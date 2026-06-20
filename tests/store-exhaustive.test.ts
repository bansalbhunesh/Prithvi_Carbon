import { describe, it, expect } from "vitest";
import {
  computeActivityKg, dailyBreakdown, dailySeries, seedDemo,
  DEFAULT_PROFILE, uid, INDIAN_STATES,
  type Activity, type Profile,
} from "@/lib/store";
import { BENCHMARKS } from "@/lib/factors";

const P: Profile = { ...DEFAULT_PROFILE, state: "Maharashtra", diet: "vegetarian", household: 2, onboarded: true };
const today = new Date().toISOString().slice(0, 10);
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

/* ---- computeActivityKg ---- */
describe("computeActivityKg — all activity types", () => {
  it("electricity uses state grid factor", () => {
    const kg = computeActivityKg({ type: "electricity", date: today, kwh: 10 }, "Maharashtra");
    expect(kg).toBeCloseTo(7.5, 1);
  });
  it("electricity with zero kWh returns 0", () => {
    expect(computeActivityKg({ type: "electricity", date: today, kwh: 0 }, "Delhi")).toBe(0);
  });
  it("commute uses transport factor", () => {
    const kg = computeActivityKg({ type: "commute", date: today, mode: "petrol_car", km: 10 }, "Delhi");
    expect(kg).toBeCloseTo(1.6, 1);
  });
  it("commute with missing mode returns 0", () => {
    const kg = computeActivityKg({ type: "commute", date: today, km: 10 } as any, "Delhi");
    expect(kg).toBe(0);
  });
  it("flight uses domestic_flight factor implicitly from mode", () => {
    const kg = computeActivityKg({ type: "flight", date: today, mode: "domestic_flight", km: 100 }, "Delhi");
    expect(kg).toBeCloseTo(13.3, 1);
  });
  it("lpg converts cylinders", () => {
    const kg = computeActivityKg({ type: "lpg", date: today, cylinders: 1 }, "Delhi");
    expect(kg).toBe(42);
  });
  it("lpg with fractional cylinders", () => {
    const kg = computeActivityKg({ type: "lpg", date: today, cylinders: 0.5 }, "Delhi");
    expect(kg).toBe(21);
  });
  it("fuel petrol", () => {
    const kg = computeActivityKg({ type: "fuel", date: today, litres: 10, fuel: "petrol" }, "Delhi");
    expect(kg).toBeCloseTo(23.1, 1);
  });
  it("fuel diesel", () => {
    const kg = computeActivityKg({ type: "fuel", date: today, litres: 10, fuel: "diesel" }, "Delhi");
    expect(kg).toBeCloseTo(26.8, 1);
  });
  it("fuel defaults to petrol when fuel type missing", () => {
    const kg = computeActivityKg({ type: "fuel", date: today, litres: 10 } as any, "Delhi");
    expect(kg).toBeCloseTo(23.1, 1);
  });
  it("missing numeric fields default to 0", () => {
    expect(computeActivityKg({ type: "electricity", date: today } as any, "Delhi")).toBe(0);
    expect(computeActivityKg({ type: "lpg", date: today } as any, "Delhi")).toBe(0);
    expect(computeActivityKg({ type: "fuel", date: today } as any, "Delhi")).toBe(0);
  });
});

/* ---- dailyBreakdown ---- */
describe("dailyBreakdown — comprehensive", () => {
  it("empty activities returns diet-only total", () => {
    const b = dailyBreakdown(P, []);
    expect(b.electricity).toBe(0);
    expect(b.transport).toBe(0);
    expect(b.cooking).toBe(0);
    expect(b.diet).toBe(4.6);
    expect(b.total).toBe(4.6);
  });

  it("household splitting for electricity and cooking", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: 7.5 },
      { id: "2", date: today, type: "lpg", cylinders: 1, kg: 42 },
    ];
    const b = dailyBreakdown({ ...P, household: 2 }, acts);
    expect(b.electricity).toBeCloseTo(3.8, 1);
    expect(b.cooking).toBe(21);
  });

  it("transport is NOT split by household", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "commute", mode: "petrol_car", km: 10, kg: 1.6 },
    ];
    const b4 = dailyBreakdown({ ...P, household: 4 }, acts);
    const b1 = dailyBreakdown({ ...P, household: 1 }, acts);
    expect(b4.transport).toBe(b1.transport);
  });

  it("fuel activities count under transport", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "fuel", litres: 5, fuel: "petrol", kg: 11.6 },
    ];
    const b = dailyBreakdown(P, acts);
    expect(b.transport).toBeGreaterThan(0);
    expect(b.cooking).toBe(0);
  });

  it("flight activities count under transport", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "flight", mode: "domestic_flight", km: 1000, kg: 133 },
    ];
    const b = dailyBreakdown(P, acts);
    expect(b.transport).toBeGreaterThan(0);
  });

  it("multi-day span divides per day", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: 7.5 },
      { id: "2", date: yesterday, type: "electricity", kwh: 10, kg: 7.5 },
    ];
    const b = dailyBreakdown({ ...P, household: 1 }, acts);
    expect(b.electricity).toBeCloseTo(7.5, 1);
  });

  it("total equals sum of all categories", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: 7.5 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 10, kg: 1.6 },
      { id: "3", date: today, type: "lpg", cylinders: 0.1, kg: 4.2 },
    ];
    const b = dailyBreakdown({ ...P, household: 1 }, acts);
    expect(b.total).toBeCloseTo(b.electricity + b.transport + b.cooking + b.diet, 0.5);
  });

  it("handles household=0 gracefully (clamps to 1)", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 10, kg: 7.5 },
    ];
    const b = dailyBreakdown({ ...P, household: 0 }, acts);
    expect(b.electricity).toBeCloseTo(7.5, 1);
  });

  it("all diets produce correct baseline", () => {
    for (const diet of ["vegan", "vegetarian", "eggetarian", "nonveg_light", "nonveg_heavy"]) {
      const b = dailyBreakdown({ ...P, diet }, []);
      expect(b.diet).toBeGreaterThan(0);
      expect(b.total).toBe(b.diet);
    }
  });
});

/* ---- dailySeries ---- */
describe("dailySeries — comprehensive", () => {
  it("returns exactly N days", () => {
    expect(dailySeries(P, [], 7)).toHaveLength(7);
    expect(dailySeries(P, [], 3)).toHaveLength(3);
    expect(dailySeries(P, [], 14)).toHaveLength(14);
  });

  it("last day is today", () => {
    const s = dailySeries(P, [], 7);
    expect(s[s.length - 1].date).toBe(today);
  });

  it("dates are in ascending order", () => {
    const s = dailySeries(P, [], 7);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].date > s[i - 1].date).toBe(true);
    }
  });

  it("days with no activities still have diet baseline", () => {
    const s = dailySeries({ ...P, diet: "vegetarian" }, [], 7);
    for (const d of s) {
      expect(d.total).toBeCloseTo(4.6, 1);
    }
  });

  it("activities on today increase today's total", () => {
    const acts: Activity[] = [
      { id: "1", date: today, type: "commute", mode: "petrol_car", km: 20, kg: 3.1 },
    ];
    const s = dailySeries({ ...P, household: 1 }, acts, 7);
    const todayEntry = s[s.length - 1];
    expect(todayEntry.total).toBeGreaterThan(4.6);
  });

  it("activities on yesterday don't affect today", () => {
    const acts: Activity[] = [
      { id: "1", date: yesterday, type: "commute", mode: "petrol_car", km: 20, kg: 3.1 },
    ];
    const s = dailySeries({ ...P, household: 1 }, acts, 7);
    const todayEntry = s[s.length - 1];
    const yestEntry = s[s.length - 2];
    expect(todayEntry.total).toBeCloseTo(4.6, 1);
    expect(yestEntry.total).toBeGreaterThan(4.6);
  });

  it("each day has a label string", () => {
    const s = dailySeries(P, [], 7);
    for (const d of s) {
      expect(typeof d.label).toBe("string");
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});

/* ---- uid ---- */
describe("uid", () => {
  it("returns a string", () => {
    expect(typeof uid()).toBe("string");
  });
  it("returns non-empty strings", () => {
    expect(uid().length).toBeGreaterThan(0);
  });
  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

/* ---- seedDemo ---- */
describe("seedDemo — comprehensive", () => {
  it("profile is onboarded", () => {
    expect(seedDemo().profile.onboarded).toBe(true);
  });
  it("profile has a name", () => {
    expect(seedDemo().profile.name.length).toBeGreaterThan(0);
  });
  it("activities have positive kg values", () => {
    for (const a of seedDemo().acts) {
      expect(a.kg).toBeGreaterThanOrEqual(0);
    }
  });
  it("activities have valid types", () => {
    const validTypes = ["electricity", "commute", "lpg", "flight", "fuel"];
    for (const a of seedDemo().acts) {
      expect(validTypes).toContain(a.type);
    }
  });
  it("activities have unique ids", () => {
    const ids = seedDemo().acts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("activities span multiple days", () => {
    const dates = new Set(seedDemo().acts.map((a) => a.date));
    expect(dates.size).toBeGreaterThan(1);
  });
  it("demo produces reasonable daily totals", () => {
    const { profile, acts } = seedDemo();
    const series = dailySeries(profile, acts, 7);
    for (const d of series) {
      expect(d.total).toBeGreaterThan(0);
      expect(d.total).toBeLessThan(50);
    }
  });
});

/* ---- DEFAULT_PROFILE ---- */
describe("DEFAULT_PROFILE", () => {
  it("is not onboarded", () => {
    expect(DEFAULT_PROFILE.onboarded).toBe(false);
  });
  it("has All India as state", () => {
    expect(DEFAULT_PROFILE.state).toBe("All India");
  });
  it("has vegetarian diet", () => {
    expect(DEFAULT_PROFILE.diet).toBe("vegetarian");
  });
  it("household is positive", () => {
    expect(DEFAULT_PROFILE.household).toBeGreaterThan(0);
  });
});

/* ---- INDIAN_STATES ---- */
describe("INDIAN_STATES", () => {
  it("includes All India", () => {
    expect(INDIAN_STATES).toContain("All India");
  });
  it("has no duplicates", () => {
    expect(new Set(INDIAN_STATES).size).toBe(INDIAN_STATES.length);
  });
  it("all states with grid multipliers are listed", async () => {
    const { STATE_GRID_MULT } = await import("@/lib/factors");
    for (const state of Object.keys(STATE_GRID_MULT)) {
      expect(INDIAN_STATES).toContain(state);
    }
  });
});
