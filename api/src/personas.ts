// Persona registry. A persona is a DECLARATIVE config + a data pack — adding one is
// a config entry + a JSON pack, no engine code (the "zero-engine-code" rule). The
// engine reads config; it never branches on persona id.
//
// PROTOTYPE SCOPE: this proves the config-driven persona switch and the FEEL of a
// second life-stage. It deliberately STUBS the launch-gating hardening we agreed on
// — real per-persona crisis classifier, verified/RAG sourcing, real consent
// branching. Class-10 is the default + fallback and behaves exactly as before.
import { buildPack, loadRaw, type Pack, dataset as class10Raw } from "./dataset.js";

export interface IntakeGroup { title: string; options: string[] }
export interface PersonaConfig {
  id: string;
  label: string;
  age_band: string;
  category: string;
  experimental: boolean;
  audience: string;              // how the LLM should address this persona (interpolated into prompts)
  tagline: string;               // welcome/selector copy
  framing: {
    exploreTitle: string;
    exploreLead: string;
    modeExploreLabel: string;
    modeExploreDesc: string;
    modeAspireLabel: string;
    modeAspireDesc: string;
  };
  intake: { title: string; lead: string; interests: IntakeGroup; values: IntakeGroup };
  helplines: { name: string; num: string; tel: string }[];
  consent_rule: "minor_parental" | "adult_self";
  success_metric: string;        // recorded for the design; not computed in the prototype
  disclosure: string | null;     // banner text; null = none (verified persona)
}

// India helplines are shared where appropriate; a real build would tailor per domain.
const HELP_GENERAL = [
  { name: "Tele-MANAS (mental health)", num: "14416", tel: "14416" },
  { name: "KIRAN helpline", num: "1800-599-0019", tel: "18005990019" },
];
const HELP_TEEN = [
  ...HELP_GENERAL,
  { name: "Childline (for under-18s)", num: "1098", tel: "1098" },
];

const CONFIGS: Record<string, PersonaConfig> = {
  class10: {
    id: "class10",
    label: "Class 10 student",
    age_band: "13-16",
    category: "school-to-stream",
    experimental: false,
    audience: "an Indian Class 10 student (Bengaluru, CBSE) choosing what to do after Class 10",
    tagline: "After Class 10 · CBSE · Bengaluru",
    framing: {
      exploreTitle: "Everything open to you after Class 10",
      exploreLead: "Nothing here is ranked. Look around freely.",
      modeExploreLabel: "I'm not sure yet",
      modeExploreDesc: "Help me explore all my options and see what fits.",
      modeAspireLabel: "I have a goal in mind",
      modeAspireDesc: "I know where I want to head — help me plan.",
    },
    intake: {
      title: "A few things about you",
      lead: "There are no right answers, and this isn't a test. It just helps me show you the right options. Skip anything you like.",
      interests: { title: "What do you enjoy right now?", options: ["Making & art", "Numbers", "Biology", "Building things", "Helping people", "Business"] },
      values: { title: "What matters most to you?", options: ["A steady income", "Doing work I love", "Helping my family soon", "Making an impact"] },
    },
    helplines: HELP_TEEN,
    consent_rule: "minor_parental",
    success_metric: "Informed-Convergence Rate (complete intake → explore incl. an unconsidered option → save a 2-3 shortlist)",
    disclosure: null,
  },
  midcareer: {
    id: "midcareer",
    label: "Mid-career (prototype)",
    age_band: "25-45",
    category: "career-change",
    experimental: true,
    audience: "an Indian mid-career professional (around 25-45) rethinking their work — a switch, growth, or more meaning",
    tagline: "Rethinking work · a switch, or growth",
    framing: {
      exploreTitle: "Ways forward from where you are",
      exploreLead: "Nothing here is ranked, and none of it is 'too late'. Look around freely.",
      modeExploreLabel: "I'm weighing my options",
      modeExploreDesc: "Help me see the realistic routes from where I am now.",
      modeAspireLabel: "I have a direction in mind",
      modeAspireDesc: "I know roughly where I want to head — help me think it through.",
    },
    intake: {
      title: "A little about where you are",
      lead: "No right answers. This just helps me show routes that fit your situation. Skip anything you like.",
      interests: { title: "What's pulling you right now?", options: ["Growth & pay", "A change of field", "More meaning", "More flexibility", "Leadership", "Building something of my own"] },
      values: { title: "What matters most right now?", options: ["Financial security", "Doing work I care about", "Time & balance", "Autonomy", "Impact"] },
    },
    helplines: HELP_GENERAL,
    consent_rule: "adult_self",
    success_metric: "Informed next-step rate (explore realistic routes → reach a considered, self-owned direction) — prototype, not computed",
    disclosure: "Experimental prototype — this persona's information is illustrative and unverified. Don't rely on any figure or route here.",
  },
};

const PACKS: Record<string, Pack> = {
  class10: buildPack(class10Raw),
  midcareer: buildPack(loadRaw("api/personas/midcareer.json")),
};

export const DEFAULT_PERSONA = "class10";

export function resolvePersonaId(id: unknown): string {
  return typeof id === "string" && CONFIGS[id] ? id : DEFAULT_PERSONA; // unknown → safe fallback
}
export function getConfig(id: unknown): PersonaConfig {
  return CONFIGS[resolvePersonaId(id)];
}
export function getPack(id: unknown): Pack {
  return PACKS[resolvePersonaId(id)];
}
// Public list for the persona picker (config only, no data pack).
export const personaList = Object.values(CONFIGS).map((c) => ({
  id: c.id, label: c.label, age_band: c.age_band, category: c.category,
  experimental: c.experimental, tagline: c.tagline, framing: c.framing,
  intake: c.intake, consent_rule: c.consent_rule, disclosure: c.disclosure,
}));
