import type { Option, Profile, Reflection } from "./api";

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

// Local fallback reflection — used only until the server-side Claude call answers
// (e.g. when no API key is set). Same shape as the real reflection.
export function localReflect(option: Option, profile: Profile): Reflection {
  const hits = profile.interests.filter((i) => (FIT[i] || []).includes(option.id));
  const band = hits.length >= 2 ? "Strong fit" : hits.length === 1 ? "Worth exploring" : "A stretch";
  let why = hits.length
    ? `You said you enjoy ${hits.join(" and ")}, which connects well with this path.`
    : "This isn't an obvious match for what you told me — which is exactly why it's worth a look, so you choose from the whole field.";
  if (profile.values.includes("Doing work I love") && hits.length) why += " It also fits wanting work you love.";
  const watch = option.honest_notes ? option.honest_notes.split(".")[0] + "." : "Keep your other options open while you look.";
  return { band, why_this_connects: why, what_to_watch: watch, confidence: "low" };
}

// surface a legitimate option the student's stated interests did NOT point to
export function expansionId(options: Option[], profile: Profile): string {
  const pointed = new Set<string>();
  profile.interests.forEach((i) => (FIT[i] || []).forEach((id) => pointed.add(id)));
  const prefer = ["polytechnic_diploma", "nios", "iti", "vocational", "pu_humanities"];
  return prefer.find((id) => !pointed.has(id) && options.some((o) => o.id === id)) || "polytechnic_diploma";
}

export function costText(o: Option): string {
  const c = o.approx_cost_per_year_inr ? { c: o.approx_cost_per_year_inr, per: " / year" } : { c: o.approx_cost_inr, per: "" };
  if (!c.c) return "Varies";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(c.c)) {
    if (k === "needs_verification" || k === "note") continue;
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

export const shortName = (name: string) => name.replace("Pre-University (PU) — ", "PU — ");
export const optIconName = (id: string) =>
  ({ pu_science: "sciences", pu_commerce: "commerce", pu_humanities: "humanities", polytechnic_diploma: "building", iti: "gear", nios: "list", vocational: "star" } as Record<string, string>)[id] || "info";
