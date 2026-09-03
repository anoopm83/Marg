// Loads the curated options/pathways dataset (single source of truth for content).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// api/src -> project root
const raw = JSON.parse(readFileSync(join(here, "..", "..", "marg-dataset-v0.json"), "utf-8"));

export const dataset = raw;
export const options: any[] = raw.options;
export const pathways: any[] = raw.pathways;
export const scholarships: any[] = raw.scholarships;
export const specializedPathways: any[] = raw.specialized_pathways || [];
export const optById = new Map<string, any>(raw.options.map((o: any) => [o.id, o]));
export const pathById = new Map<string, any>(raw.pathways.map((p: any) => [p.id, p]));

// Grounding for the chat. The model may cite ONLY from what we send it. Because
// Groq's free tier caps at ~8k tokens/min and a multi-turn chat re-sends grounding
// every turn, we send the SMALLEST slice each mode needs (trimmed fields), not the
// whole dataset — Explore doesn't need the ambition-pathways; Aspire doesn't need
// each option's full record. This keeps full breadth while staying under budget.
const trimOption = (o: any) => ({
  id: o.id, name: o.name, type: o.type, summary: o.summary, leads_to: o.leads_to,
  eligibility: o.eligibility?.text, duration: o.duration,
  approx_cost: o.approx_cost_per_year_inr || o.approx_cost_inr,
  exams: o.entrance_exams_it_feeds, scholarships: o.related_scholarships,
});
const trimSpecial = (p: any) => ({
  id: p.id, name: p.name, summary: p.summary, frame: p.frame, leads_to: p.leads_to,
  eligibility: p.eligibility?.text, needs_verification: p.needs_verification,
});
const trimAmbition = (p: any) => ({
  id: p.id, ambition: p.ambition, next_horizon_steps: p.next_horizon_steps,
  honest_cost_effort: p.honest_cost_effort, real_routes_through_cost: p.real_routes_through_cost,
  adjacent_destinations: p.adjacent_destinations, what_if_it_changes: p.what_if_it_changes,
});
const schIndex = raw.scholarships.map((s: any) => ({ id: s.id, name: s.name, amount: s.amount, needs_verification: s.needs_verification }));

export function groundingFor(mode: "explore" | "aspire"): Record<string, unknown> {
  const context = raw.meta?.context;
  if (mode === "aspire") {
    return {
      context,
      ambition_pathways: raw.pathways.map(trimAmbition),
      specialized_pathways: specializedPathways.map(trimSpecial),
      options_index: raw.options.map((o: any) => ({ id: o.id, name: o.name, summary: o.summary })),
      scholarships: schIndex,
    };
  }
  return {
    context,
    options: raw.options.map(trimOption),
    specialized_pathways: specializedPathways.map(trimSpecial),
    scholarships: schIndex,
  };
}
