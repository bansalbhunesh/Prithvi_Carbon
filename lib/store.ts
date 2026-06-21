import {
  electricityKg, transportKg, lpgKg, dietDailyKg, round1, FUEL_PER_LITRE,
} from "./factors";

export type Profile = {
  name: string;
  state: string;
  diet: string;
  household: number;
  onboarded: boolean;
};

export type Activity = {
  id: string;
  date: string;
  type: "electricity" | "commute" | "lpg" | "flight" | "fuel";
  kwh?: number;
  mode?: string;
  km?: number;
  cylinders?: number;
  litres?: number;
  fuel?: string;
  kg: number;
  scanned?: boolean;
};

const PKEY = "prithvi.profile.v1";
const AKEY = "prithvi.activities.v1";

export const DEFAULT_PROFILE: Profile = {
  name: "",
  state: "All India",
  diet: "vegetarian",
  household: 3,
  onboarded: false,
};

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PKEY);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
  } catch { return DEFAULT_PROFILE; }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* quota */ }
}

export function loadActivities(): Activity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AKEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveActivities(a: Activity[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(AKEY, JSON.stringify(a)); } catch { /* quota */ }
}

export function computeActivityKg(a: Omit<Activity, "kg" | "id">, state: string): number {
  if (a.type === "electricity") return round1(electricityKg(a.kwh ?? 0, state));
  if (a.type === "commute" || a.type === "flight")
    return round1(transportKg(a.mode ?? "", a.km ?? 0));
  if (a.type === "lpg") return round1(lpgKg(a.cylinders ?? 0));
  if (a.type === "fuel") {
    const f = FUEL_PER_LITRE[a.fuel ?? "petrol"] ?? FUEL_PER_LITRE.petrol;
    return round1((a.litres ?? 0) * f.value);
  }
  return 0;
}

export type Breakdown = {
  electricity: number;
  transport: number;
  cooking: number;
  diet: number;
  total: number;
};

export function dailyBreakdown(profile: Profile, acts: Activity[]): Breakdown {
  const days = new Set(acts.map((a) => a.date));
  const span = Math.max(days.size, 1);

  let electricity = 0, transport = 0, cooking = 0;
  for (const a of acts) {
    if (a.type === "electricity") electricity += a.kg;
    else if (a.type === "commute" || a.type === "flight" || a.type === "fuel") transport += a.kg;
    else if (a.type === "lpg") cooking += a.kg;
  }
  const hh = Math.max(profile.household, 1);
  const elecPP = electricity / hh / span;
  const cookPP = cooking / hh / span;
  const transPP = transport / span;
  const diet = dietDailyKg(profile.diet);

  const total = elecPP + transPP + cookPP + diet;
  return {
    electricity: round1(elecPP),
    transport: round1(transPP),
    cooking: round1(cookPP),
    diet: round1(diet),
    total: round1(total),
  };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function dailySeries(profile: Profile, acts: Activity[], n = 7) {
  const hh = Math.max(profile.household, 1);
  const diet = dietDailyKg(profile.diet);
  const out: { date: string; label: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayActs = acts.filter((a) => a.date === iso);
    let elec = 0, trans = 0, cook = 0;
    for (const a of dayActs) {
      if (a.type === "electricity") elec += a.kg;
      else if (a.type === "commute" || a.type === "flight" || a.type === "fuel") trans += a.kg;
      else if (a.type === "lpg") cook += a.kg;
    }
    const total = round1(elec / hh + cook / hh + trans + diet);
    out.push({ date: iso, label: d.toLocaleDateString("en-IN", { weekday: "short" }), total });
  }
  return out;
}

export function seedDemo(): { profile: Profile; acts: Activity[] } {
  const profile: Profile = {
    name: "Bhunesh", state: "Maharashtra", diet: "nonveg_light",
    household: 3, onboarded: true,
  };
  const today = new Date();
  const iso = (back: number) => {
    const d = new Date(today); d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const raw: Omit<Activity, "id" | "kg">[] = [
    { type: "commute", date: iso(0), mode: "petrol_car", km: 14 },
    { type: "electricity", date: iso(0), kwh: 9 },
    { type: "commute", date: iso(1), mode: "petrol_car", km: 14 },
    { type: "electricity", date: iso(1), kwh: 11 },
    { type: "commute", date: iso(2), mode: "metro", km: 16 },
    { type: "electricity", date: iso(2), kwh: 8 },
    { type: "commute", date: iso(3), mode: "petrol_car", km: 14 },
    { type: "electricity", date: iso(3), kwh: 12 },
    { type: "commute", date: iso(4), mode: "two_wheeler", km: 9 },
    { type: "lpg", date: iso(4), cylinders: 0.3 },
    { type: "commute", date: iso(5), mode: "metro", km: 16 },
    { type: "electricity", date: iso(5), kwh: 7 },
    { type: "commute", date: iso(6), mode: "petrol_car", km: 14 },
    { type: "electricity", date: iso(6), kwh: 10 },
  ];
  const acts: Activity[] = raw.map((r) => ({
    ...r, id: uid(), kg: computeActivityKg(r, profile.state),
  }));
  return { profile, acts };
}

export const INDIAN_STATES = [
  "All India", "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Kerala",
  "Gujarat", "Uttar Pradesh", "Rajasthan", "Telangana", "West Bengal",
  "Madhya Pradesh", "Chhattisgarh", "Himachal Pradesh",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];
