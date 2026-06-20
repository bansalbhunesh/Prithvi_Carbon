import { describe, it, expect } from "vitest";
import {
  GRID, gridFactor, electricityKg, transportKg, dietDailyKg, lpgKg,
  FUEL_PER_LITRE, STATE_GRID_MULT, TRANSPORT, DIET, BENCHMARKS,
  DIET_LABELS, TRANSPORT_LABELS, LPG_CYLINDER, PNG_PER_KWH,
  round1,
} from "@/lib/factors";

describe("gridFactor — exhaustive", () => {
  it("returns GRID.value for All India", () => {
    expect(gridFactor("All India")).toBe(GRID.value);
  });
  it("returns correct value for every known state", () => {
    for (const [state, mult] of Object.entries(STATE_GRID_MULT)) {
      expect(gridFactor(state)).toBeCloseTo(GRID.value * mult, 6);
    }
  });
  it("unknown state defaults to national average (mult=1.0)", () => {
    expect(gridFactor("Narnia")).toBe(GRID.value);
    expect(gridFactor("")).toBe(GRID.value);
  });
});

describe("electricityKg — edge cases", () => {
  it("zero kWh returns zero for any state", () => {
    for (const state of Object.keys(STATE_GRID_MULT)) {
      expect(electricityKg(0, state)).toBe(0);
    }
  });
  it("negative kWh returns negative (no clamping at this layer)", () => {
    expect(electricityKg(-5, "Delhi")).toBeLessThan(0);
  });
  it("large kWh scales linearly", () => {
    const base = electricityKg(1, "Delhi");
    expect(electricityKg(1000, "Delhi")).toBeCloseTo(base * 1000, 3);
  });
  it("cleanest state (Himachal) produces least CO2", () => {
    const states = Object.keys(STATE_GRID_MULT);
    const emissions = states.map((s) => ({ s, e: electricityKg(100, s) }));
    const min = emissions.reduce((a, b) => (a.e < b.e ? a : b));
    expect(min.s).toBe("Himachal Pradesh");
  });
  it("dirtiest state (Chhattisgarh) produces most CO2", () => {
    const states = Object.keys(STATE_GRID_MULT);
    const emissions = states.map((s) => ({ s, e: electricityKg(100, s) }));
    const max = emissions.reduce((a, b) => (a.e > b.e ? a : b));
    expect(max.s).toBe("Chhattisgarh");
  });
});

describe("transportKg — every mode", () => {
  it("all known modes produce non-negative for positive distance", () => {
    for (const mode of Object.keys(TRANSPORT)) {
      expect(transportKg(mode, 10)).toBeGreaterThanOrEqual(0);
    }
  });
  it("walk_cycle is exactly zero", () => {
    expect(transportKg("walk_cycle", 100)).toBe(0);
  });
  it("domestic_flight is higher than all public transit modes", () => {
    const publicModes = ["city_bus", "metro", "local_train"];
    for (const mode of publicModes) {
      expect(TRANSPORT.domestic_flight.value).toBeGreaterThan(TRANSPORT[mode].value);
    }
  });
  it("public transit (metro, bus, train) is lower than car", () => {
    const publicModes = ["metro", "local_train", "city_bus"];
    for (const m of publicModes) {
      expect(transportKg(m, 10)).toBeLessThan(transportKg("petrol_car", 10));
    }
  });
  it("zero km returns zero for all modes", () => {
    for (const mode of Object.keys(TRANSPORT)) {
      expect(transportKg(mode, 0)).toBe(0);
    }
  });
  it("unknown mode returns zero", () => {
    expect(transportKg("hoverboard", 50)).toBe(0);
  });
  it("ev_car is lower than petrol_car", () => {
    expect(transportKg("ev_car", 10)).toBeLessThan(transportKg("petrol_car", 10));
  });
  it("diesel_car emits more than petrol_car", () => {
    expect(transportKg("diesel_car", 10)).toBeGreaterThan(transportKg("petrol_car", 10));
  });
});

describe("dietDailyKg — every diet", () => {
  it("all known diets return positive values", () => {
    for (const diet of Object.keys(DIET)) {
      expect(dietDailyKg(diet)).toBeGreaterThan(0);
    }
  });
  it("strict ordering: vegan < vegetarian < eggetarian < nonveg_light < nonveg_heavy", () => {
    const order = ["vegan", "vegetarian", "eggetarian", "nonveg_light", "nonveg_heavy"];
    for (let i = 1; i < order.length; i++) {
      expect(dietDailyKg(order[i])).toBeGreaterThan(dietDailyKg(order[i - 1]));
    }
  });
  it("unknown diet defaults to vegetarian", () => {
    expect(dietDailyKg("fruitarian")).toBe(dietDailyKg("vegetarian"));
    expect(dietDailyKg("")).toBe(dietDailyKg("vegetarian"));
  });
});

describe("lpgKg", () => {
  it("one cylinder = 42 kg", () => {
    expect(lpgKg(1)).toBe(LPG_CYLINDER.value);
  });
  it("fractional cylinders scale linearly", () => {
    expect(lpgKg(0.5)).toBeCloseTo(21, 1);
    expect(lpgKg(0.3)).toBeCloseTo(12.6, 1);
  });
  it("zero cylinders = zero", () => {
    expect(lpgKg(0)).toBe(0);
  });
  it("multiple cylinders scale linearly", () => {
    expect(lpgKg(3)).toBe(126);
  });
});

describe("fuel per litre", () => {
  it("petrol and diesel are both defined", () => {
    expect(FUEL_PER_LITRE.petrol).toBeDefined();
    expect(FUEL_PER_LITRE.diesel).toBeDefined();
  });
  it("diesel emits more than petrol per litre", () => {
    expect(FUEL_PER_LITRE.diesel.value).toBeGreaterThan(FUEL_PER_LITRE.petrol.value);
  });
  it("both are positive", () => {
    expect(FUEL_PER_LITRE.petrol.value).toBeGreaterThan(0);
    expect(FUEL_PER_LITRE.diesel.value).toBeGreaterThan(0);
  });
});

describe("BENCHMARKS consistency", () => {
  it("india_avg < world_avg", () => {
    expect(BENCHMARKS.india_avg).toBeLessThan(BENCHMARKS.world_avg);
  });
  it("all benchmarks are positive", () => {
    expect(BENCHMARKS.india_avg).toBeGreaterThan(0);
    expect(BENCHMARKS.world_avg).toBeGreaterThan(0);
    expect(BENCHMARKS.target_2030).toBeGreaterThan(0);
  });
  it("india_avg matches roughly 2 t/yr", () => {
    const annual = BENCHMARKS.india_avg * 365 / 1000;
    expect(annual).toBeCloseTo(2.0, 0);
  });
  it("world_avg matches roughly 4.7 t/yr", () => {
    const annual = BENCHMARKS.world_avg * 365 / 1000;
    expect(annual).toBeCloseTo(4.7, 0);
  });
});

describe("labels completeness", () => {
  it("every TRANSPORT mode has a TRANSPORT_LABELS entry", () => {
    for (const mode of Object.keys(TRANSPORT)) {
      expect(TRANSPORT_LABELS[mode]).toBeDefined();
    }
  });
  it("every DIET has a DIET_LABELS entry", () => {
    for (const diet of Object.keys(DIET)) {
      expect(DIET_LABELS[diet]).toBeDefined();
    }
  });
});

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(1.234)).toBe(1.2);
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.96)).toBe(2);
    expect(round1(0)).toBe(0);
  });
  it("handles negative numbers", () => {
    expect(round1(-1.234)).toBe(-1.2);
    expect(round1(-1.96)).toBe(-2);
  });
  it("handles very large numbers", () => {
    expect(round1(99999.99)).toBe(100000);
  });
  it("handles very small numbers", () => {
    expect(round1(0.04)).toBe(0);
    expect(round1(0.05)).toBe(0.1);
  });
});

describe("PNG_PER_KWH factor", () => {
  it("is defined and positive", () => {
    expect(PNG_PER_KWH.value).toBeGreaterThan(0);
  });
  it("is lower than LPG equivalent per-energy-unit", () => {
    expect(PNG_PER_KWH.value).toBeLessThan(1);
  });
});
