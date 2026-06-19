import { describe, it, expect } from "vitest";
import {
  GRID, gridFactor, electricityKg, transportKg, dietDailyKg, lpgKg,
  FUEL_PER_LITRE, STATE_GRID_MULT, round1,
} from "@/lib/factors";

describe("grid factor", () => {
  it("uses national average for All India", () => {
    expect(gridFactor("All India")).toBeCloseTo(GRID.value, 5);
  });
  it("applies state multipliers (coal-heavy > national)", () => {
    expect(gridFactor("Madhya Pradesh")).toBeGreaterThan(gridFactor("All India"));
    expect(gridFactor("Himachal Pradesh")).toBeLessThan(gridFactor("All India"));
  });
  it("falls back to 1.0 for unknown states", () => {
    expect(gridFactor("Atlantis")).toBeCloseTo(GRID.value, 5);
  });
});

describe("electricity", () => {
  it("multiplies kWh by the state-adjusted factor", () => {
    // 8 kWh in Maharashtra (mult 1.05): 8 * 0.71 * 1.05 = 5.964
    expect(electricityKg(8, "Maharashtra")).toBeCloseTo(5.964, 3);
  });
  it("returns 0 for 0 kWh", () => {
    expect(electricityKg(0, "Delhi")).toBe(0);
  });
});

describe("transport", () => {
  it("computes petrol car per-km", () => {
    expect(transportKg("petrol_car", 12)).toBeCloseTo(1.86, 2);
  });
  it("rail is far lower than car for the same distance", () => {
    expect(transportKg("local_train", 12)).toBeLessThan(transportKg("petrol_car", 12) / 5);
  });
  it("unknown mode contributes nothing", () => {
    expect(transportKg("teleport", 100)).toBe(0);
  });
  it("walk/cycle is zero", () => {
    expect(transportKg("walk_cycle", 5)).toBe(0);
  });
});

describe("fuel & cooking", () => {
  it("petrol litres use the IPCC factor", () => {
    expect(10 * FUEL_PER_LITRE.petrol.value).toBeCloseTo(23.1, 2);
  });
  it("diesel emits more per litre than petrol", () => {
    expect(FUEL_PER_LITRE.diesel.value).toBeGreaterThan(FUEL_PER_LITRE.petrol.value);
  });
  it("one LPG cylinder is 42 kg", () => {
    expect(lpgKg(1)).toBe(42);
  });
});

describe("diet ordering", () => {
  it("non-veg heavy > vegetarian > vegan", () => {
    expect(dietDailyKg("nonveg_heavy")).toBeGreaterThan(dietDailyKg("vegetarian"));
    expect(dietDailyKg("vegetarian")).toBeGreaterThan(dietDailyKg("vegan"));
  });
  it("defaults to vegetarian for unknown diet", () => {
    expect(dietDailyKg("carnivore-deluxe")).toBe(dietDailyKg("vegetarian"));
  });
});

describe("invariants", () => {
  it("every state multiplier is positive", () => {
    for (const m of Object.values(STATE_GRID_MULT)) expect(m).toBeGreaterThan(0);
  });
  it("round1 keeps one decimal", () => {
    expect(round1(1.234)).toBe(1.2);
    expect(round1(1.96)).toBe(2);
  });
});
