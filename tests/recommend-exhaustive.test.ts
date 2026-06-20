import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/recommend";
import { dailyBreakdown, DEFAULT_PROFILE, type Profile, type Activity } from "@/lib/store";

const today = new Date().toISOString().slice(0, 10);

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...DEFAULT_PROFILE, onboarded: true, household: 1, ...overrides };
}

function makeBreakdown(profile: Profile, acts: Activity[]) {
  return dailyBreakdown(profile, acts);
}

describe("recommend — electricity recommendations", () => {
  it("gives electricity reco when electricity > 1.5 kg/day", () => {
    const P = makeProfile({ state: "Delhi" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 30, kg: 21 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "electricity")).toBe(true);
  });

  it("gives LED reco for moderate electricity (>0.6)", () => {
    const P = makeProfile({ state: "Delhi" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 3, kg: 2.1 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.title.includes("LED"))).toBe(true);
  });

  it("no electricity reco when electricity is very low", () => {
    const P = makeProfile({ state: "Himachal Pradesh" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 1, kg: 0.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.filter((r) => r.category === "electricity").length).toBe(0);
  });
});

describe("recommend — transport recommendations", () => {
  it("gives transport reco when transport > 2.0 kg/day", () => {
    const P = makeProfile();
    const acts: Activity[] = [
      { id: "1", date: today, type: "commute", mode: "petrol_car", km: 40, kg: 6.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "transport")).toBe(true);
  });

  it("gives carpool/two-wheeler reco for moderate transport (>1.0)", () => {
    const P = makeProfile();
    const acts: Activity[] = [
      { id: "1", date: today, type: "commute", mode: "petrol_car", km: 10, kg: 1.6 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "transport")).toBe(true);
  });

  it("no transport reco when transport is very low", () => {
    const P = makeProfile();
    const acts: Activity[] = [
      { id: "1", date: today, type: "commute", mode: "metro", km: 5, kg: 0.1 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.filter((r) => r.category === "transport").length).toBe(0);
  });
});

describe("recommend — cooking recommendations", () => {
  it("gives cooking reco when cooking > 0.8 kg/day", () => {
    const P = makeProfile();
    const acts: Activity[] = [
      { id: "1", date: today, type: "lpg", cylinders: 0.1, kg: 4.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "cooking")).toBe(true);
  });

  it("no cooking reco when cooking is low", () => {
    const P = makeProfile();
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.filter((r) => r.category === "cooking").length).toBe(0);
  });
});

describe("recommend — diet recommendations", () => {
  it("suggests diet shift for nonveg_heavy", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "diet")).toBe(true);
  });

  it("suggests diet shift for nonveg_light", () => {
    const P = makeProfile({ diet: "nonveg_light" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "diet")).toBe(true);
  });

  it("suggests diet shift for eggetarian", () => {
    const P = makeProfile({ diet: "eggetarian" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "diet")).toBe(true);
  });

  it("suggests diet shift for vegetarian -> vegan", () => {
    const P = makeProfile({ diet: "vegetarian" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.some((r) => r.category === "diet")).toBe(true);
  });

  it("no diet reco for vegan (already at bottom)", () => {
    const P = makeProfile({ diet: "vegan" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.filter((r) => r.category === "diet").length).toBe(0);
  });
});

describe("recommend — scoring and caps", () => {
  it("results are sorted by score descending", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 30, kg: 21 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 40, kg: 6.2 },
      { id: "3", date: today, type: "lpg", cylinders: 0.1, kg: 4.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    for (let i = 1; i < recos.length; i++) {
      expect(recos[i - 1].score).toBeGreaterThanOrEqual(recos[i].score);
    }
  });

  it("capped at 5 recommendations", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 50, kg: 35 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 60, kg: 9.3 },
      { id: "3", date: today, type: "lpg", cylinders: 0.2, kg: 8.4 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    expect(recos.length).toBeLessThanOrEqual(5);
  });

  it("all recos have positive saveKgDay", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 30, kg: 21 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 40, kg: 6.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    for (const r of recos) {
      expect(r.saveKgDay).toBeGreaterThan(0);
    }
  });

  it("all recos have valid categories", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 30, kg: 21 },
      { id: "2", date: today, type: "commute", mode: "petrol_car", km: 40, kg: 6.2 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    const validCats = ["electricity", "transport", "cooking", "diet"];
    for (const r of recos) {
      expect(validCats).toContain(r.category);
    }
  });

  it("empty breakdown with vegan diet yields zero recos", () => {
    const P = makeProfile({ diet: "vegan" });
    const b = makeBreakdown(P, []);
    const recos = recommend(P, b);
    expect(recos.length).toBe(0);
  });

  it("score = saveKgDay * feasibility", () => {
    const P = makeProfile({ diet: "nonveg_heavy" });
    const acts: Activity[] = [
      { id: "1", date: today, type: "electricity", kwh: 30, kg: 21 },
    ];
    const b = makeBreakdown(P, acts);
    const recos = recommend(P, b);
    for (const r of recos) {
      expect(r.score).toBeCloseTo(r.saveKgDay * r.feasibility, 5);
    }
  });
});
