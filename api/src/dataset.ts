// Turns a raw persona data pack (options/pathways/scholarships/specialized) into the
// shape the engine consumes. The SAME factory serves every persona — a new persona
// is a new pack, not new engine code. Class-10 remains the default pack so existing
// callers keep working unchanged.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export function loadRaw(relPathFromRoot: string): any {
  return JSON.parse(readFileSync(join(here, "..", "..", relPathFromRoot), "utf-8"));
}

export interface Pack {
  raw: any;
  disclaimer: string;
  options: any[];
  pathways: any[];
  scholarships: any[];
  specializedPathways: any[];
  optById: Map<string, any>;
  pathById: Map<string, any>;
  groundingFor: (mode: "explore" | "aspire") => Record<string, unknown>;
}

const trimOption = (o: any) => ({
  id: o.id, name: o.name, type: o.type, summary: o.summary, leads_to: o.leads_to,
  eligibility: o.eligibility?.text, duration: o.duration,
  approx_cost: o.approx_cost_per_year_inr || o.approx_cost_inr,
  exams: o.entrance_exams_it_feeds, scholarships: o.related_scholarships,
});
const trimSpecial = (p: any) => ({
  id: p.id, name: p.name, summary: p.summary, frame: p.frame, leads_to: p.leads_to,
  eligibility: p.eligibility?.text,
});
const trimAmbition = (p: any) => ({
  id: p.id, ambition: p.ambition, next_horizon_steps: p.next_horizon_steps,
  honest_cost_effort: p.honest_cost_effort, real_routes_through_cost: p.real_routes_through_cost,
  adjacent_destinations: p.adjacent_destinations, what_if_it_changes: p.what_if_it_changes,
});

// Build a Pack from raw JSON. Grounding sends the SMALLEST slice each mode needs
// (trimmed fields) so the chat stays under provider token budgets.
export function buildPack(raw: any): Pack {
  const options: any[] = raw.options || [];
  const pathways: any[] = raw.pathways || [];
  const scholarships: any[] = raw.scholarships || [];
  const specializedPathways: any[] = raw.specialized_pathways || [];
  const schIndex = scholarships.map((s: any) => ({ id: s.id, name: s.name, amount: s.amount }));
  const context = raw.meta?.context;
  const groundingFor = (mode: "explore" | "aspire"): Record<string, unknown> => {
    if (mode === "aspire") {
      return {
        context,
        ambition_pathways: pathways.map(trimAmbition),
        specialized_pathways: specializedPathways.map(trimSpecial),
        options_index: options.map((o: any) => ({ id: o.id, name: o.name, summary: o.summary })),
        scholarships: schIndex,
      };
    }
    return {
      context,
      options: options.map(trimOption),
      specialized_pathways: specializedPathways.map(trimSpecial),
      scholarships: schIndex,
    };
  };
  return {
    raw, disclaimer: raw.meta?.disclaimer ?? "", options, pathways, scholarships, specializedPathways,
    optById: new Map(options.map((o: any) => [o.id, o])),
    pathById: new Map(pathways.map((p: any) => [p.id, p])),
    groundingFor,
  };
}

// ---- default (Class-10) pack + backward-compatible exports ----
const rawClass10 = loadRaw("marg-dataset-v0.json");
const class10 = buildPack(rawClass10);

export const dataset = rawClass10;
export const options = class10.options;
export const pathways = class10.pathways;
export const scholarships = class10.scholarships;
export const specializedPathways = class10.specializedPathways;
export const optById = class10.optById;
export const pathById = class10.pathById;
export const groundingFor = class10.groundingFor;
