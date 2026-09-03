// Server-side crisis / distress detection for ALL free-text entering the system.
// This is deliberately centralized: every free-text route (intake "mind" field,
// the Mode A / Mode B chat) must pass through here BEFORE any LLM call, so the
// safety gate cannot be bypassed by a modified client.
//
// NOTE (still an open item before real students — see Architecture §8): this is a
// keyword pre-filter, not a real classifier. It is intentionally high-recall
// (better a false alarm than a miss). A production build should back this with a
// proper distress classifier + a real human hand-off. Keep this as the fast gate.

const DISTRESS = /(kill(ing)? myself|commit suicide|suicid|end my life|end it all|don'?t want to live|do ?n'?t want to be here|want to die|wanna die|better off dead|hurt(ing)? myself|self ?-?harm|harm myself|hopeless|worthless|no point in (living|anything)|can'?t go on|can'?t take (it|this) anymore|cutting myself|nobody would miss me|no reason to live)/i;

export function checkDistress(text: string | undefined | null): boolean {
  if (!text) return false;
  return DISTRESS.test(text);
}

// Real, current India helplines — surfaced verbatim to the student on a positive flag.
export const HELPLINES = [
  { name: "Tele-MANAS (mental health)", num: "14416", tel: "14416" },
  { name: "KIRAN helpline", num: "1800-599-0019", tel: "18005990019" },
  { name: "Childline (for under-18s)", num: "1098", tel: "1098" },
];
