// Product analytics via PostHog — the engagement/session/activation layer that
// complements the first-party North-Star events. Privacy-first: no autocapture,
// no session recording, and we NEVER send PII (interests, values, free text) —
// only event names + non-sensitive props (role, feature ids, timings, booleans).
// The PostHog key is fetched at runtime from /api/config (set POSTHOG_KEY in the
// host env), so no rebuild is needed to enable it.
// posthog-js is loaded lazily (only when a key is configured) so it never bloats
// the initial bundle for viewers, and isn't fetched at all when analytics is off.
type PostHog = typeof import("posthog-js").default;
let ph: PostHog | null = null;
let enabled = false;
let ready = false;
let appVersion = "0.1.0";
const openedAt = Date.now();
let lastStepAt = openedAt;
let valueReached = false;
const usedFeatures = new Set<string>();
const queue: Array<[string, Record<string, unknown>]> = [];

function isReturning(): boolean {
  try {
    if (localStorage.getItem("marg_seen")) return true;
    localStorage.setItem("marg_seen", "1");
    return false;
  } catch { return false; }
}

function sessionId(): string | undefined {
  try { return ph ? (ph as any).get_session_id?.() : undefined; } catch { return undefined; }
}

export function track(event: string, props: Record<string, unknown> = {}) {
  const p = { app_version: appVersion, ...props };
  if (!ready) { queue.push([event, p]); return; }
  if (enabled && ph) { try { ph.capture(event, p); } catch { /* ignore */ } }
}

export async function initAnalytics(role?: string) {
  const returning = isReturning();
  try {
    const cfg = await (await fetch("/api/config")).json();
    appVersion = cfg?.appVersion || appVersion;
    if (cfg?.posthog?.key) {
      ph = (await import("posthog-js")).default;
      ph.init(cfg.posthog.key, {
        api_host: cfg.posthog.host,
        autocapture: false,             // no automatic click/form capture (privacy)
        capture_pageview: true,         // gives sessions + returning-user via distinct_id
        disable_session_recording: true,
        persistence: "localStorage+cookie",
      });
      enabled = true;
    }
  } catch { /* analytics stays off */ }
  ready = true;
  for (const [e, p] of queue.splice(0)) { if (enabled && ph) { try { ph.capture(e, p); } catch { /* ignore */ } } }
  track("app_opened", { user_id_type: "guest_anonymous", source: document.referrer ? "referral" : "direct", platform: "web" });
  track("engagement_session_started", { role: role ?? "unknown", is_returning_user: returning, referrer_screen: document.referrer || "direct" });
}

// A specific value-delivering feature was used (first + subsequent).
export function trackFeature(featureId: string, entryPoint: string, role?: string) {
  const first = !usedFeatures.has(featureId);
  usedFeatures.add(featureId);
  track("feature_used", { feature_id: featureId, first_time: first, feature_entry_point: entryPoint, session_id: sessionId(), role });
}

// Progression through the core workflow (to see where users drop off).
export function trackFlowStep(featureId: string, step: string, order: number, role?: string) {
  const now = Date.now();
  track("feature_flow_progressed", { feature_id: featureId, workflow_step: step, workflow_step_order: order, workflow_step_duration_seconds: Math.round((now - lastStepAt) / 1000), role });
  lastStepAt = now;
}

// The primary time-to-value moment (fires once per session).
export function trackValueMoment(valueMomentId: string, role?: string) {
  if (valueReached) return;
  valueReached = true;
  track("value_moment_reached", { value_moment_id: valueMomentId, time_to_value_seconds: Math.round((Date.now() - openedAt) / 1000), device_context: "web", role });
}
