// Typed client for the Marg API (proxied through Vite at /api).
export interface Option {
  id: string; name: string; type: string; summary: string;
  combinations?: string[]; leads_to?: string[]; keeps_open?: string;
  eligibility?: { text: string }; duration?: string;
  where_in_bangalore?: { examples?: string[] };
  approx_cost_per_year_inr?: Record<string, string>;
  approx_cost_inr?: Record<string, string>;
  entrance_exams_it_feeds?: string[]; related_scholarships?: string[];
  honest_notes?: string; human_touchpoint?: unknown;
}
export interface Reflection {
  band: "Worth exploring" | "Strong fit" | "A stretch";
  why_this_connects: string; what_to_watch: string; confidence: string;
}
export interface Specialized {
  id: string; name: string; type?: string; summary: string; frame?: string;
  leads_to?: string[]; eligibility?: { text: string }; duration?: string;
  where_in_bangalore?: { examples?: string[]; note?: string };
  approx_cost_inr?: Record<string, string>; approx_cost_per_year_inr?: Record<string, string>;
  related_scholarships?: string[]; related_core_options?: string[];
  honest_notes?: string; needs_verification?: boolean; human_touchpoint?: unknown;
}
export interface Pathway {
  id: string; ambition: string;
  next_horizon_steps?: string[]; honest_cost_effort?: string;
  real_routes_through_cost?: string[]; adjacent_destinations?: string[]; what_if_it_changes?: string;
}
export interface PlanReflection { opening: string; reconciliation: string; watch: string; confidence: string }
export interface ChatMsg { role: "user" | "assistant"; content: string }
export interface ChatReply { reply?: string; safety?: boolean; helplines?: { name: string; num: string; tel: string }[] }
export interface Profile { interests: string[]; values: string[]; marks?: string | null; mind_flagged?: boolean }
export interface ShortlistItem { option_id: string; note: string | null; added_at: string }

const TOKEN_KEY = "marg_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

interface Res<T> { status: number; data: T | null; ok: boolean }
async function req<T = any>(path: string, opts: RequestInit = {}): Promise<Res<T>> {
  const t = getToken();
  const r = await fetch("/api" + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: "Bearer " + t } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data, ok: r.ok };
}

export const api = {
  health: () => req("/health"),
  register: (body: { userId: string; password: string; email?: string; consent: { path: string; school_code?: string } }) =>
    req<{ token: string; userId: string }>("/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { userId: string; password: string }) =>
    req<{ token: string; userId: string }>("/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => req("/logout", { method: "POST" }),
  getOptions: () => req<{ options: Option[]; scholarships: { id: string; name: string }[]; pathways: Pathway[]; specialized: Specialized[] }>("/options"),
  getIntake: () => req<{ intake: Profile | null }>("/intake"),
  saveIntake: (data: Profile) => req("/intake", { method: "POST", body: JSON.stringify(data) }),
  reflect: (optionId: string) => req<{ reflection: Reflection }>("/reflect", { method: "POST", body: JSON.stringify({ optionId }) }),
  plan: (pathwayId: string) => req<{ plan: PlanReflection }>("/plan", { method: "POST", body: JSON.stringify({ pathwayId }) }),
  chat: (body: { mode: "explore" | "aspire"; contextId?: string | null; goal?: string; messages: ChatMsg[] }) =>
    req<ChatReply>("/chat", { method: "POST", body: JSON.stringify(body) }),
  getShortlist: () => req<{ shortlist: ShortlistItem[] }>("/shortlist"),
  addShortlist: (optionId: string, note?: string) => req<{ shortlist: ShortlistItem[] }>("/shortlist", { method: "POST", body: JSON.stringify({ optionId, note }) }),
  removeShortlist: (optionId: string) => req<{ shortlist: ShortlistItem[] }>("/shortlist/" + optionId, { method: "DELETE" }),
  deleteMe: () => req("/me", { method: "DELETE" }),
  event: (name: string, props?: unknown) => req("/event", { method: "POST", body: JSON.stringify({ name, props }) }),
};
