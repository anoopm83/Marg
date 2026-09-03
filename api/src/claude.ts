// Grounded Claude reflections. Structured output makes a verdict structurally
// impossible; the prompt carries only the one relevant record + the student's inputs.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5";
export const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_AUTH_TOKEN;
const client = new Anthropic();

const ReflectionSchema = z.object({
  band: z.enum(["Worth exploring", "Strong fit", "A stretch"]),
  why_this_connects: z.string(),
  what_to_watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const SYSTEM_REFLECT = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE) choosing what to do after Class 10.",
  "You are given ONE option's verified data and the student's self-described interests and values.",
  "Write a short, warm reflection connecting THIS option to what the student told you.",
  "HARD RULES:",
  "- Never issue a verdict or tell them what to choose. You rate the OPTION's fit, never the child.",
  "- Use ONLY the provided option data. Never invent colleges, fees, schemes, eligibility, or any fact.",
  "- Growth-framed: interests can change; nothing is permanent.",
  "- If the option is not an obvious match, frame exploring it positively (widening the field is good).",
  "- why_this_connects: at most 2 sentences. what_to_watch: exactly 1 sentence.",
].join("\n");

export async function reflect(profile: any, option: any) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    option: {
      name: option.name,
      summary: option.summary,
      leads_to: option.leads_to,
      keeps_open: option.keeps_open,
      honest_notes: option.honest_notes,
    },
  };
  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_REFLECT,
    output_format: betaZodOutputFormat(ReflectionSchema),
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  if (!resp.parsed) throw new Error("reflection could not be parsed");
  return resp.parsed;
}

const PlanSchema = z.object({
  opening: z.string(),
  reconciliation: z.string(),
  watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const SYSTEM_PLAN = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE).",
  "The student has named an ambition. You are given that pathway's verified data and the student's interests and values.",
  "Write a short, warm framing for pursuing this ambition — never a plan to commit to.",
  "HARD RULES:",
  "- Never tell them to commit. An ambition at this age can and should stay open.",
  "- Use ONLY the provided pathway data. Invent nothing.",
  "- opening: one encouraging sentence framing this as 'a possible path'.",
  "- reconciliation: if the student's stated interests diverge from what this path needs, name that trade-off honestly and kindly and point them to keeping options open; otherwise gently encourage looking at the adjacent paths too. 1-2 sentences.",
  "- watch: one honest sentence about the effort/cost — remembering there are real routes through it.",
].join("\n");

export async function planReflect(profile: any, pathway: any) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    pathway: {
      ambition: pathway.ambition,
      next_horizon_steps: pathway.next_horizon_steps,
      honest_cost_effort: pathway.honest_cost_effort,
      real_routes_through_cost: pathway.real_routes_through_cost,
      adjacent_destinations: pathway.adjacent_destinations,
      what_if_it_changes: pathway.what_if_it_changes,
    },
  };
  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PLAN,
    output_format: betaZodOutputFormat(PlanSchema),
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  if (!resp.parsed) throw new Error("plan reflection could not be parsed");
  return resp.parsed;
}
