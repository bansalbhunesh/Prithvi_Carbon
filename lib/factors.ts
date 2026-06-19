/**
 * factors.ts — Prithvi emission engine
 * ------------------------------------------------------------------
 * DETERMINISTIC. No ML, no black box. Every number below is traceable
 * to a named source so any output can be audited back to its factor.
 * All factors are India-calibrated (not US/EU defaults).
 *
 * Units: kg CO2e unless stated. "pkm" = per passenger-km.
 */

export type FactorSource = { value: number; unit: string; source: string };

/* ---- ELECTRICITY -------------------------------------------------
 * CEA CO2 Baseline Database for the Indian Power Sector, Version 21.0
 * (Nov 2025, FY 2024-25): weighted-average grid emission factor.
 */
export const GRID: FactorSource = {
  value: 0.71,
  unit: "kg CO2 / kWh",
  source: "CEA Baseline Database v21.0 (Nov 2025), FY2024-25",
};

/* State-level multipliers vs national average (coal-heavy > 1, hydro/RE < 1).
 * Approximate, directional — lets users see their grid is dirtier/cleaner. */
export const STATE_GRID_MULT: Record<string, number> = {
  "All India": 1.0,
  "Delhi": 0.98,
  "Maharashtra": 1.05,
  "Madhya Pradesh": 1.18,
  "Chhattisgarh": 1.22,
  "Karnataka": 0.74,
  "Tamil Nadu": 0.86,
  "Kerala": 0.62,
  "Himachal Pradesh": 0.30,
  "Gujarat": 1.02,
  "Uttar Pradesh": 1.12,
  "Rajasthan": 0.92,
  "Telangana": 1.04,
  "West Bengal": 1.15,
};

/* ---- COOKING FUEL ------------------------------------------------ */
export const LPG_CYLINDER: FactorSource = {
  value: 42, // one standard 14.2 kg domestic cylinder, fully combusted
  unit: "kg CO2 / cylinder",
  source: "CarbonCrux India sector factors 2026 (14.2 kg LPG)",
};

/* ---- FUEL (for receipt scanning) -------------------------------- */
export const FUEL_PER_LITRE: Record<string, FactorSource> = {
  petrol: { value: 2.31, unit: "kg CO2 / litre", source: "IPCC/DEFRA petrol combustion" },
  diesel: { value: 2.68, unit: "kg CO2 / litre", source: "IPCC/DEFRA diesel combustion" },
};
export const PNG_PER_KWH: FactorSource = {
  value: 0.203, // piped natural gas, ~18% lower than LPG per unit energy
  unit: "kg CO2 / kWh-equivalent",
  source: "Derived from LPG, PNG ~15-20% lower",
};

/* ---- TRANSPORT (tailpipe / per passenger-km where shared) -------- */
export const TRANSPORT: Record<string, FactorSource> = {
  petrol_car:    { value: 0.155, unit: "kg CO2 / km",  source: "ICCT / India mid-size petrol avg" },
  diesel_car:    { value: 0.171, unit: "kg CO2 / km",  source: "India diesel car avg" },
  two_wheeler:   { value: 0.050, unit: "kg CO2 / km",  source: "India 2W study (0.0516 kg/km)" },
  auto_rickshaw: { value: 0.107, unit: "kg CO2 / km",  source: "India CNG 3-wheeler EF" },
  city_bus:      { value: 0.030, unit: "kg CO2 / pkm", source: "Per passenger-km, urban bus" },
  metro:         { value: 0.018, unit: "kg CO2 / pkm", source: "Electric metro, grid-adjusted" },
  local_train:   { value: 0.012, unit: "kg CO2 / pkm", source: "Indian Railways electric" },
  domestic_flight:{value: 0.133, unit: "kg CO2 / pkm", source: "DEFRA short-haul domestic" },
  ev_car:        { value: 0.071, unit: "kg CO2 / km",  source: "0.10 kWh/km x grid EF" },
  walk_cycle:    { value: 0.0,   unit: "kg CO2 / km",  source: "Zero tailpipe" },
};

export const TRANSPORT_LABELS: Record<string, string> = {
  petrol_car: "Petrol car",
  diesel_car: "Diesel car",
  two_wheeler: "Two-wheeler",
  auto_rickshaw: "Auto-rickshaw",
  city_bus: "City bus",
  metro: "Metro",
  local_train: "Local train",
  domestic_flight: "Domestic flight",
  ev_car: "Electric car",
  walk_cycle: "Walk / cycle",
};

/* ---- DIET (per day, lifecycle) ----------------------------------
 * ICAR-IARI per-meal study + CarbonCrux India annual ranges.
 * Lacto-veg Indian diet ~1.7 t/yr (4.6 kg/day); mutton-heavy ~1.8x veg.
 */
export const DIET: Record<string, FactorSource> = {
  vegan:        { value: 3.0, unit: "kg CO2 / day", source: "Plant-only, India lifecycle" },
  vegetarian:   { value: 4.6, unit: "kg CO2 / day", source: "Lacto-veg, ICAR + CarbonCrux (~1.7 t/yr)" },
  eggetarian:   { value: 5.5, unit: "kg CO2 / day", source: "Veg + eggs" },
  nonveg_light: { value: 6.8, unit: "kg CO2 / day", source: "Chicken 2-3x/week" },
  nonveg_heavy: { value: 8.3, unit: "kg CO2 / day", source: "Regular mutton/red meat (1.8x veg)" },
};

export const DIET_LABELS: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  eggetarian: "Eggetarian",
  nonveg_light: "Non-veg (light)",
  nonveg_heavy: "Non-veg (heavy)",
};

/* ---- BENCHMARKS (kg CO2 per person per day) ---------------------- */
export const BENCHMARKS = {
  india_avg: 5.5,   // ~2.0 t/yr per capita
  world_avg: 12.9,  // ~4.7 t/yr
  target_2030: 5.5, // ~2 t/yr, 1.5C-aligned per-capita budget
};

/* ================================================================
 * Calculation helpers — pure functions, fully traceable.
 * ================================================================ */
export function gridFactor(state: string): number {
  const mult = STATE_GRID_MULT[state] ?? 1.0;
  return GRID.value * mult;
}

export function electricityKg(kwh: number, state: string): number {
  return kwh * gridFactor(state);
}

export function transportKg(mode: string, km: number): number {
  return (TRANSPORT[mode]?.value ?? 0) * km;
}

export function dietDailyKg(diet: string): number {
  return DIET[diet]?.value ?? DIET.vegetarian.value;
}

export function lpgKg(cylinders: number): number {
  return cylinders * LPG_CYLINDER.value;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
