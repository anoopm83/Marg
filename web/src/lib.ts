import type { Option, Profile, Reflection, Pathway, PlanReflection, Specialized } from "./api";

export const INTERESTS = ["Making & art", "Numbers", "Biology", "Building things", "Helping people", "Business"];
export const VALUES = ["A steady income", "Doing work I love", "Helping my family soon", "Making an impact"];

// interest -> option ids it resonates with (drives the humble local fallback only)
const FIT: Record<string, string[]> = {
  "Making & art": ["pu_humanities", "vocational"],
  "Numbers": ["pu_commerce", "pu_science"],
  "Biology": ["pu_science"],
  "Building things": ["polytechnic_diploma", "iti"],
  "Helping people": ["pu_science", "pu_humanities"],
  "Business": ["pu_commerce"],
};

// Local fallback reflection, used only until the server-side Claude call answers
// (e.g. when no API key is set). Same shape as the real reflection.
export function localReflect(option: Option, profile: Profile): Reflection {
  const hits = profile.interests.filter((i) => (FIT[i] || []).includes(option.id));
  const band = hits.length >= 2 ? "Strong fit" : hits.length === 1 ? "Worth exploring" : "A stretch";
  let why = hits.length
    ? `You said you enjoy ${hits.join(" and ")}, which connects well with this path.`
    : "This isn't an obvious match for what you told me, which is exactly why it's worth a look, so you choose from the whole field.";
  if (profile.values.includes("Doing work I love") && hits.length) why += " It also fits wanting work you love.";
  const watch = option.honest_notes ? option.honest_notes.split(".")[0] + "." : "Keep your other options open while you look.";
  return { band, why_this_connects: why, what_to_watch: watch, confidence: "low" };
}

// Local fallback for the Mode B plan framing (used until /api/plan answers).
export function planLocal(pathway: Pathway, profile: Profile): PlanReflection {
  const creative = profile.interests.includes("Making & art");
  const sciencey = /science|doctor|engineer/i.test(pathway.ambition + " " + (pathway.next_horizon_steps || []).join(" "));
  return {
    opening: `This is one way toward ${pathway.ambition.toLowerCase().replace(/^become /, "")}, and it can change as you do.`,
    reconciliation: creative && sciencey
      ? "Earlier you leaned toward creative subjects, and this path leans Science, worth sitting with that trade-off, and the adjacent paths below stay open to you."
      : "Keep the adjacent paths below in view too, choosing this now doesn't close the others.",
    watch: pathway.honest_cost_effort ? pathway.honest_cost_effort.split(".")[0] + "." : "",
    confidence: "low",
  };
}

// The "have you considered" nudge: surface ONE strong-but-overlooked option that
// genuinely connects to an interest the student actually picked, WITH the reason.
// Each maps an interest to a non-obvious route (not the default PU stream) + why.
// If nothing maps to their interests, we return null and show no nudge, better
// nothing than an arbitrary suggestion.
export type Nudge = { id: string; spec: boolean; why: string };
const NUDGE_MAP: Record<string, Nudge> = {
  "Building things": { id: "polytechnic_diploma", spec: false, why: "you like building things, a Polytechnic diploma is hands-on and employable, and it bridges into BTech a year early." },
  "Biology": { id: "paramedical_allied_health", spec: true, why: "you're drawn to Biology, paramedical & allied-health diplomas open real healthcare careers without the NEET marathon." },
  "Making & art": { id: "creative_design_school", spec: true, why: "you enjoy making & art, early-entry design and animation courses are a direct, portfolio-led route many overlook." },
  "Business": { id: "entrepreneurship_startup", spec: true, why: "you're drawn to business, an early entrepreneurship track builds real venture experience while you study." },
  "Helping people": { id: "paramedical_allied_health", spec: true, why: "you want to help people, paramedical & allied-health roles are an employable care career beyond just medicine." },
  "Numbers": { id: "polytechnic_diploma", spec: false, why: "you like numbers, a Polytechnic in computer science or electronics is a hands-on, employable route with a BTech bridge." },
};
export function pickNudge(profile: Profile, options: Option[], specialized: Specialized[]): Nudge | null {
  for (const interest of profile.interests) {
    const n = NUDGE_MAP[interest];
    if (!n) continue;
    const exists = n.spec ? specialized.some((s) => s.id === n.id) : options.some((o) => o.id === n.id);
    if (exists) return n;
  }
  return null;
}

export function costText(o: Option): string {
  const c = o.approx_cost_per_year_inr ? { c: o.approx_cost_per_year_inr, per: " / year" } : { c: o.approx_cost_inr, per: "" };
  if (!c.c) return "Varies";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(c.c)) {
    if (k === "needs_verification" || k === "note" || k === "verified_note") continue;
    parts.push(`${k.replace(/_/g, " ")}: ₹${v}`);
  }
  if (!parts.length && (c.c as any).note) parts.push((c.c as any).note);
  return parts.join(" · ") + (parts.length ? c.per : "");
}

export const HELPLINES = [
  { name: "Tele-MANAS (mental health)", num: "14416", tel: "14416" },
  { name: "KIRAN helpline", num: "1800-599-0019", tel: "18005990019" },
  { name: "Childline (for under-18s)", num: "1098", tel: "1098" },
];

export function checkDistress(t: string): boolean {
  if (!t) return false;
  return /(kill myself|suicid|end my life|end it all|don'?t want to live|want to die|hurt myself|self ?-?harm|hopeless|worthless|no point in|can'?t go on|cutting myself)/i.test(t);
}

export const shortName = (name: string) => name.replace("Pre-University (PU), ", "PU, ");
export const optIconName = (id: string) =>
  ({ pu_science: "sciences", pu_commerce: "commerce", pu_humanities: "humanities", polytechnic_diploma: "building", iti: "gear", nios: "list", vocational: "star" } as Record<string, string>)[id] || "info";
