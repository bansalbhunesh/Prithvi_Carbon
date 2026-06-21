import { Breakdown, Profile } from "./store";
import { dietDailyKg } from "./factors";

/** A single, actionable reduction suggestion ranked for one user's footprint. */
export type Reco = {
  /** Short imperative headline, e.g. "Cut AC runtime by 2 hrs/day". */
  title: string;
  /** One-sentence rationale shown beneath the title. */
  detail: string;
  /** Estimated daily CO2 saving in kg if the user adopts this action. */
  saveKgDay: number;
  /** How realistic the action is to adopt, 0–1 (higher = easier). */
  feasibility: number;
  /** Which footprint category the action targets. */
  category: "electricity" | "transport" | "cooking" | "diet";
  /** Ranking key: saveKgDay × feasibility (impact weighted by realism). */
  score: number;
};

/**
 * Build a ranked, personalised reduction plan from a user's daily breakdown.
 *
 * Suggestions are gated by category thresholds so users only see levers that
 * are actually material for them, then ranked by `saveKgDay × feasibility` so
 * the highest-impact yet realistic action surfaces first. Returns at most five.
 *
 * @param profile - The user's profile (used for diet-shift suggestions).
 * @param b - The user's computed daily breakdown.
 * @returns Up to five recommendations, highest score first.
 */
export function recommend(profile: Profile, b: Breakdown): Reco[] {
  const out: Reco[] = [];
  const push = (r: Omit<Reco, "score">) =>
    out.push({ ...r, score: r.saveKgDay * r.feasibility });

  if (b.electricity > 1.5) {
    push({
      category: "electricity",
      title: "Cut AC runtime by 2 hrs/day",
      detail: "Raising the set point to 26°C and using a timer trims a large slice of grid load.",
      saveKgDay: Math.min(b.electricity * 0.25, 2.0),
      feasibility: 0.8,
    });
    push({
      category: "electricity",
      title: "Rooftop solar / green tariff",
      detail: "Shifts your highest-emitting category off coal. Bigger payoff in coal-heavy states.",
      saveKgDay: b.electricity * 0.55,
      feasibility: 0.35,
    });
  }
  if (b.electricity > 0.6) {
    push({
      category: "electricity",
      title: "Swap remaining bulbs to LED",
      detail: "One-time change, runs every evening. Small per-unit, steady daily saving.",
      saveKgDay: Math.min(b.electricity * 0.1, 0.4),
      feasibility: 0.95,
    });
  }

  if (b.transport > 2.0) {
    push({
      category: "transport",
      title: "Shift 2 commute days to metro/train",
      detail: "Rail is ~10x lower per km than a petrol car. Two days a week is a realistic start.",
      saveKgDay: b.transport * 0.28,
      feasibility: 0.6,
    });
  }
  if (b.transport > 1.0) {
    push({
      category: "transport",
      title: "Replace short car trips with two-wheeler",
      detail: "For trips under 5 km, a two-wheeler cuts roughly two-thirds of the per-km emissions.",
      saveKgDay: b.transport * 0.18,
      feasibility: 0.75,
    });
    push({
      category: "transport",
      title: "Carpool one direction daily",
      detail: "Splitting a car commute halves the per-person footprint of that leg.",
      saveKgDay: b.transport * 0.2,
      feasibility: 0.55,
    });
  }

  if (b.cooking > 0.8) {
    push({
      category: "cooking",
      title: "Induction for daily boiling/reheating",
      detail: "Moves part of cooking off LPG. Cleaner where your state grid is greener.",
      saveKgDay: b.cooking * 0.3,
      feasibility: 0.5,
    });
  }

  const dietOrder = ["nonveg_heavy", "nonveg_light", "eggetarian", "vegetarian", "vegan"];
  const idx = dietOrder.indexOf(profile.diet);
  if (idx >= 0 && idx < dietOrder.length - 1) {
    const next = dietOrder[idx + 1];
    const save = dietDailyKg(profile.diet) - dietDailyKg(next);
    if (save > 0.3) {
      push({
        category: "diet",
        title: `Try 2 ${labelFor(next)} days a week`,
        detail: `Moving toward ${labelFor(next).toLowerCase()} a couple of days lowers food emissions without an all-or-nothing switch.`,
        saveKgDay: (save * 2) / 7,
        feasibility: 0.65,
      });
    }
  }

  return out.sort((a, b2) => b2.score - a.score).slice(0, 5);
}

/** Human-readable label for a diet key, used inside suggestion copy. */
function labelFor(diet: string): string {
  const m: Record<string, string> = {
    vegan: "Vegan", vegetarian: "Vegetarian", eggetarian: "Eggetarian",
    nonveg_light: "Lighter non-veg", nonveg_heavy: "Non-veg",
  };
  return m[diet] ?? diet;
}
