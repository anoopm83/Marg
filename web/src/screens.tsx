import { useEffect, useRef, useState } from "react";
import { api, type Option, type Profile, type Reflection, type ShortlistItem, type Pathway, type PlanReflection, type ChatMsg, type Specialized, type PersonaPublic, setToken } from "./api";
import { Icon, Compass, Bookmark } from "./icons";
import { INTERESTS, VALUES, localReflect, planLocal, expansionId, costText, checkDistress, shortName, optIconName } from "./lib";

export interface Ctx {
  go: (name: string, param?: string | null) => void;
  param: string | null;
  toast: (m: string) => void;
  openSafety: (fromDistress?: boolean) => void;
  logout: () => void;
  options: Option[];
  profile: Profile;
  setProfile: (p: Profile) => void;
  consent: { path: string; school_code?: string };
  setConsent: (c: { path: string; school_code?: string }) => void;
  shortlist: ShortlistItem[];
  setShortlist: (s: ShortlistItem[]) => void;
  scholarshipNames: Record<string, string>;
  pathways: Pathway[];
  specialized: Specialized[];
  personas: PersonaPublic[];
  persona: PersonaPublic | null;
  setPersona: (p: PersonaPublic) => void | Promise<void>;
}

function FooterLinks({ ctx }: { ctx: Ctx }) {
  return (
    <div className="footlinks">
      <button className="help-link" onClick={() => ctx.openSafety(false)}>Get help</button>
      <span>·</span>
      <button className="help-link" onClick={() => ctx.go("delete-confirm")}>Delete my data</button>
      <span>·</span>
      <button className="help-link" onClick={() => ctx.logout()}>Log out</button>
    </div>
  );
}

// Grounded, no-verdict conversational chat. Used in Mode A (about a stream) and
// Mode B (about a typed goal). Distress is caught by a client pre-check here AND
// authoritatively server-side before any model call.
export function Chat({ ctx, mode, contextId, goal, placeholder, seedAssistant }: {
  ctx: Ctx; mode: "explore" | "aspire"; contextId?: string | null; goal?: string;
  placeholder: string; seedAssistant?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(seedAssistant ? [{ role: "assistant", content: seedAssistant }] : []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (checkDistress(text)) ctx.openSafety(true); // instant local pre-check; server re-checks authoritatively
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    const res = await api.chat({ mode, contextId, goal, messages: next, persona: ctx.persona?.id });
    setBusy(false);
    if (res.data?.safety) {
      ctx.openSafety(true);
      setMsgs([...next, { role: "assistant", content: "I want to make sure you're okay before we carry on — please see the help options that just came up. I'm here when you're ready." }]);
      return;
    }
    setMsgs([...next, { role: "assistant", content: res.data?.reply || "Sorry — I couldn't answer just now. Please try again in a moment." }]);
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={scroller}>
        {msgs.length === 0 && <div className="chat-empty">Ask anything about your options. I answer from verified info, and I'll never tell you what to pick.</div>}
        {msgs.map((m, i) => <div key={i} className={"bubble " + m.role}>{m.content}</div>)}
        {busy && <div className="bubble assistant typing"><span></span><span></span><span></span></div>}
      </div>
      <div className="chat-input">
        <textarea className="ta chat-ta" rows={1} value={input} placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="chat-send" onClick={send} disabled={busy || !input.trim()} aria-label="Send"><Icon name="chev" size={19} stroke={2.4} /></button>
      </div>
      <div className="chat-disc"><Icon name="info" size={12} style={{ color: "var(--muted)" }} /> Answers come from verified info only, never a verdict — figures may still be being checked.</div>
    </div>
  );
}

export function PersonaPick({ ctx }: { ctx: Ctx }) {
  return (
    <section className="screen">
      <div className="wordmark" style={{ fontSize: 20, marginBottom: 6 }}>Marg</div>
      <h1 style={{ fontSize: 26 }}>Who is this for?</h1>
      <p className="lead" style={{ marginTop: 8 }}>Marg adapts to your stage of life. Pick one to begin.</p>
      <div className="stack" style={{ marginTop: 22, gap: 14 }}>
        {ctx.personas.map((p) => (
          <button key={p.id} className="choice" style={{ alignItems: "flex-start", textAlign: "left" }}
            onClick={async () => { await ctx.setPersona(p); ctx.go("welcome"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>{p.label}</div>
              <span className={p.experimental ? "badge-exp" : "badge-ok"}>{p.experimental ? "EXPERIMENTAL" : "READY"}</span>
            </div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{p.tagline} · ages {p.age_band}</div>
            {p.disclosure && <div className="note" style={{ marginTop: 10, fontSize: 12 }}>{p.disclosure}</div>}
          </button>
        ))}
      </div>
      <div className="disclaimer-foot" style={{ marginTop: 18 }}>Class 10 is the built, verified experience. Others are early prototypes of Marg's one-engine vision.</div>
    </section>
  );
}

export function Welcome({ ctx }: { ctx: Ctx }) {
  const p = ctx.persona;
  const adult = p?.consent_rule === "adult_self";
  const isClass10 = (p?.id ?? "class10") === "class10";
  const start = () => { if (adult) { ctx.setConsent({ path: "self_serve" }); ctx.go("register"); } else ctx.go("consent"); };
  return (
    <section className="screen">
      {ctx.personas.length > 1 && (
        <div className="topbar"><button className="back" onClick={() => ctx.go("personas")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Change stage</span></div>
      )}
      <div className="wordmark"><Compass /><span>Marg</span></div>
      <div className="spacer" />
      <div className="stack" style={{ gap: 16 }}>
        <div className="eyebrow">{p?.tagline ?? "For Class 10 · CBSE · Bengaluru"}</div>
        <h1 style={{ fontSize: 33 }}>{isClass10 ? "See all your paths after Class 10 — then choose, without being boxed in." : "See your real options — then choose your next step, without being boxed in."}</h1>
        <p className="lead">A calm way to explore your real options and plan your next steps. No pressure, no verdicts.</p>
      </div>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-primary" onClick={start}>Start</button>
        <div className="card" style={{ padding: 15 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--muted)" }}><Icon name="lock" size={16} /></span>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
              <strong style={{ color: "var(--ink)" }}>Private &amp; judgment-free.</strong> {adult ? "You're in control of your data, and you can delete everything anytime." : "A parent or guardian consents first (DPDP), and you can delete everything anytime."}
            </div>
          </div>
        </div>
        <button className="help-link" onClick={() => ctx.go("login")}>Already have an account? Log in</button>
      </div>
    </section>
  );
}

export function Consent({ ctx }: { ctx: Ctx }) {
  const school = ctx.param === "school";
  const codeRef = useRef<HTMLInputElement>(null);
  const bullet = (name: string, txt: string) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ color: "var(--primary)" }}><Icon name={name} size={18} /></span>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{txt}</div>
    </div>
  );
  const choose = (path: string) => { ctx.setConsent({ path, school_code: codeRef.current?.value }); ctx.go("register"); };
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("welcome")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Setting up safely</span></div>
      <div className="eyebrow">A quick consent step</div>
      <h1 style={{ fontSize: 26, marginTop: 12 }}>Let's set this up safely</h1>
      <p className="lead" style={{ marginTop: 10 }}>You're a student, so we need a parent or guardian's okay before we keep any of your answers. India's data-protection rules (DPDP) require this — and it protects you.</p>
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bullet("check", "We keep only what helps show your options.")}
          {bullet("lock", "Your answers are private — never sold or shared.")}
          {bullet("refresh", "You can delete everything, anytime.")}
        </div>
      </div>
      {school ? (
        <div className="card" style={{ marginTop: 16 }}>
          <label className="field-label">Your school's code</label>
          <input ref={codeRef} className="ta" placeholder="e.g. BLR-CBSE-2026" />
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => choose("school_mediated")}>Continue with school</button>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={() => choose("self_serve")}>My parent/guardian is here — they consent</button>
          <button className="btn btn-ghost" onClick={() => ctx.go("consent", "school")}>Use my school's code instead</button>
        </div>
      )}
      <button className="help-link" style={{ marginTop: 16 }} onClick={() => ctx.openSafety(false)}>Feeling low or unsafe? Talk to someone now</button>
    </section>
  );
}

export function Register({ ctx }: { ctx: Ctx }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setErr("");
    if (userId.trim().length < 3) return setErr("Pick a username of at least 3 characters.");
    if (password.length < 6) return setErr("Pick a password of at least 6 characters.");
    setBusy(true);
    const res = await api.register({ userId: userId.trim(), password, email: email.trim() || undefined, consent: ctx.consent });
    setBusy(false);
    if (res.ok && res.data?.token) { setToken(res.data.token); ctx.go("intake"); return; }
    const code = (res.data as any)?.error;
    setErr(code === "handle_taken" ? "That username is taken — log in instead, or try another." : code === "weak_password" ? "That password is too short." : "Something went wrong. Please try again.");
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("consent")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Create your login</span></div>
      <h1 style={{ fontSize: 25 }}>A login so you can come back</h1>
      <p className="lead" style={{ marginTop: 10 }}>Indecision is normal — pick a username and password so your saved options are waiting when you return.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div><label className="field-label">Username</label><input className="ta" autoCapitalize="none" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="anything you'll remember" /></div>
        <div><label className="field-label">Password</label><input className="ta" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 6 characters" /></div>
        <div><label className="field-label">Email <span className="muted" style={{ fontWeight: 400 }}>(optional — for recovery)</span></label><input className="ta" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="skip if you don't have one" /></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create account"}</button>
      <button className="help-link" style={{ marginTop: 12 }} onClick={() => ctx.go("login")}>Already registered? Log in</button>
      <div className="center-note" style={{ marginTop: 8 }}>No email needed. Nothing is shared.</div>
    </section>
  );
}

export function Login({ ctx }: { ctx: Ctx }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit() {
    if (!userId.trim() || !password) { setErr("Enter your username and password."); return; }
    setErr(""); setBusy(true);
    const res = await api.login({ userId: userId.trim(), password });
    if (!res.ok || !res.data?.token) {
      setBusy(false);
      setErr(res.status === 401 ? "Incorrect username or password." : "Something went wrong. Please try again.");
      return;
    }
    setToken(res.data.token);
    // Hydrate the returning session — same as the initial boot in App.tsx.
    const [ik, sl] = await Promise.all([api.getIntake(), api.getShortlist()]);
    if (ik.data?.intake) {
      const it = ik.data.intake;
      ctx.setProfile({ interests: it.interests ?? [], values: it.values ?? [], marks: it.marks ?? null, mind_flagged: it.mind_flagged });
    }
    if (sl.data?.shortlist) ctx.setShortlist(sl.data.shortlist);
    setBusy(false);
    ctx.go("mode");
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("welcome")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Log in</span></div>
      <h1 style={{ fontSize: 26 }}>Welcome back</h1>
      <p className="lead" style={{ marginTop: 10 }}>Log in to pick up where you left off — your options and shortlist are saved.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div><label className="field-label">Username</label><input className="ta" autoCapitalize="none" value={userId} onChange={(e) => setUserId(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="your username" /></div>
        <div><label className="field-label">Password</label><input className="ta" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="your password" /></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Logging in…" : "Log in"}</button>
      <button className="help-link" style={{ marginTop: 14 }} onClick={() => ctx.go("consent")}>New here? Create an account</button>
    </section>
  );
}

export function Intake({ ctx }: { ctx: Ctx }) {
  const [mind, setMind] = useState("");
  const [busy, setBusy] = useState(false);
  const p = ctx.profile;
  // Persona-driven intake; falls back to the Class-10 question set.
  const pi = ctx.persona?.intake ?? {
    title: "A few things about you",
    lead: "There are no right answers, and this isn't a test. It just helps me show you the right options. Skip anything you like.",
    interests: { title: "What do you enjoy right now?", options: INTERESTS },
    values: { title: "What matters most to you?", options: VALUES },
  };
  const toggle = (key: "interests" | "values", v: string) => {
    const arr = p[key];
    const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
    ctx.setProfile({ ...p, [key]: next });
  };
  const chips = (list: string[], key: "interests" | "values") =>
    list.map((x) => <button key={x} className={"chip" + (p[key].includes(x) ? " on" : "")} onClick={() => toggle(key, x)}>{x}</button>);
  const pct = Math.min(100, 30 + p.interests.length * 12 + p.values.length * 12);
  async function cont() {
    const distress = checkDistress(mind);
    const next = distress ? { ...p, mind_flagged: true } : p;
    ctx.setProfile(next);
    setBusy(true);
    await api.saveIntake(next);
    setBusy(false);
    if (distress) ctx.openSafety(true); else ctx.go("mode");
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("mode")}><Icon name="back" size={22} /></button><div className="bar"><span style={{ transform: `scaleX(${pct / 100})` }} /></div></div>
      <h1 style={{ fontSize: 25 }}>{pi.title}</h1>
      <p className="lead" style={{ marginTop: 8 }}>{pi.lead}</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{pi.interests.title}</div><div className="chips">{chips(pi.interests.options, "interests")}</div><div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>These can change over time — that's normal.</div></div>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{pi.values.title}</div><div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Pick what feels true today.</div><div className="chips">{chips(pi.values.options, "values")}</div></div>
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>Add your marks?</div><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Optional — we don't lead with these.</div></div>
          <button className={"chip" + (p.marks === "skipped" ? " on" : "")} onClick={() => ctx.setProfile({ ...p, marks: p.marks === "skipped" ? null : "skipped" })}>{p.marks === "skipped" ? "Skipped" : "Skip"}</button>
        </div>
        <div className="card"><label className="field-label">Anything on your mind? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><textarea className="ta" value={mind} onChange={(e) => setMind(e.target.value)} placeholder="Type here if you'd like…" /></div>
      </div>
      <div className="spacer" style={{ minHeight: 12 }} />
      <button className="btn btn-primary" disabled={busy} onClick={cont}>{busy ? "Saving…" : "Continue"}</button>
      <button className="help-link" style={{ marginTop: 12 }} onClick={() => ctx.openSafety(false)}>Feeling low or unsafe? Talk to someone now</button>
    </section>
  );
}

export function Mode({ ctx }: { ctx: Ctx }) {
  const f = ctx.persona?.framing;
  return (
    <section className="screen">
      <div className="wordmark" style={{ fontSize: 18, marginBottom: 24 }}>Marg</div>
      <h1 style={{ fontSize: 27 }}>How can I help today?</h1>
      <p className="lead" style={{ marginTop: 8 }}>Both are fine. You can switch anytime.</p>
      <div className="stack" style={{ marginTop: 24, gap: 16 }}>
        <button className="choice" onClick={() => ctx.go("explore")}>
          <div className="ic" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}><Icon name="search" size={24} stroke={1.8} /></div>
          <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>{f?.modeExploreLabel ?? "I'm not sure yet"}</div>
          <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>{f?.modeExploreDesc ?? "Help me explore all my options and see what fits."}</div>
        </button>
        <button className="choice" onClick={() => ctx.go("aspire")}>
          <div className="ic" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}><Icon name="target" size={24} stroke={1.8} /></div>
          <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>{f?.modeAspireLabel ?? "I have a goal in mind"}</div>
          <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>{f?.modeAspireDesc ?? "Help me plan the next steps toward it."}</div>
        </button>
      </div>
      <FooterLinks ctx={ctx} />
    </section>
  );
}

export function Explore({ ctx }: { ctx: Ctx }) {
  const academic = new Set(["pu_science", "pu_commerce", "pu_humanities"]);
  const exId = expansionId(ctx.options, ctx.profile);
  const ex = ctx.options.find((o) => o.id === exId);
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("mode")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 17 }}>Your options</div></div>
      <h1 style={{ fontSize: 24 }}>{ctx.persona?.framing.exploreTitle ?? "Everything open to you after Class 10"}</h1>
      <p className="lead" style={{ marginTop: 6 }}>{ctx.persona?.framing.exploreLead ?? "Nothing here is ranked. Look around freely."}</p>
      {ex && (
        <button className="nudge" style={{ marginTop: 16, width: "100%" }} onClick={() => ctx.go("detail", ex.id)}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--violet)" }}><Icon name="star" size={18} stroke={2} /></div>
          <div style={{ flex: 1, textAlign: "left" }}><div className="k">HAVE YOU CONSIDERED</div><div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div></div>
          <span style={{ color: "var(--violet)" }}><Icon name="chev" size={18} stroke={2} /></span>
        </button>
      )}
      <div className="grid" style={{ marginTop: 14 }}>
        {ctx.options.map((o) => {
          const alt = !academic.has(o.id);
          return (
            <button key={o.id} className={"opt" + (alt ? " alt" : "")} onClick={() => ctx.go("detail", o.id)}>
              <div className="dot" style={{ color: alt ? "#8a6d3b" : "var(--primary)" }}><Icon name={optIconName(o.id)} size={17} /></div>
              <h3>{shortName(o.name)}</h3>
              <div className="sub">{(o.leads_to || []).slice(0, 3).join(", ")}</div>
            </button>
          );
        })}
      </div>

      {ctx.specialized.length > 0 && (
        <>
          <div className="section-k" style={{ marginTop: 24, color: "var(--violet)" }}>PATHS YOU MIGHT NOT HAVE CONSIDERED</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>Less common routes, shown for breadth — not ranked. Still being verified, so explore them, but confirm details before you rely on them.</p>
          <div className="grid" style={{ marginTop: 12 }}>
            {ctx.specialized.map((s) => (
              <button key={s.id} className="opt spec" onClick={() => ctx.go("specialized", s.id)}>
                <div className="dot" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}><Icon name="star" size={16} /></div>
                <h3>{s.name}</h3>
                <div className="sub">{(s.leads_to || []).slice(0, 2).join(", ")}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => ctx.go("shortlist")}>View my shortlist ({ctx.shortlist.length})</button>
    </section>
  );
}

export function Detail({ ctx }: { ctx: Ctx }) {
  const o = ctx.options.find((x) => x.id === ctx.param);
  const [refl, setRefl] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  useEffect(() => {
    if (!o) return;
    setRefl(localReflect(o, ctx.profile));
    setLoading(true);
    let live = true;
    api.reflect(o.id, ctx.persona?.id).then((res) => {
      if (!live) return;
      if (res.ok && res.data?.reflection) setRefl(res.data.reflection);
      setLoading(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.id]);
  if (!o) return <Explore ctx={ctx} />;
  const saved = ctx.shortlist.some((s) => s.option_id === o.id);
  const where = o.where_in_bangalore?.examples?.slice(0, 3).join(", ") || "Various colleges";
  const exams = (o.entrance_exams_it_feeds || []).join(", ");
  const schs = (o.related_scholarships || []).map((id) => ctx.scholarshipNames[id] || id).join(", ");
  async function toggleSave() {
    const res = saved ? await api.removeShortlist(o!.id) : await api.addShortlist(o!.id, ctx.persona?.id);
    if (res.data?.shortlist) ctx.setShortlist(res.data.shortlist);
    ctx.toast(saved ? "Removed from shortlist" : "Added to your shortlist");
  }
  const row = (name: string, lab: string, val: string) => (
    <div className="row"><span style={{ color: "var(--primary)" }}><Icon name={name} size={18} /></span><div><div className="lab">{lab}</div><div className="val">{val}</div></div></div>
  );
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("explore")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Back to options</span></div>
      <h1 style={{ fontSize: 26 }}>{o.name}</h1>
      {o.combinations && <div className="chips" style={{ marginTop: 9 }}>{o.combinations.slice(0, 4).map((c) => <span key={c} className="pill">{c.split(" (")[0]}</span>)}</div>}
      <p style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10 }}>{o.summary}</p>
      <div className="card" style={{ marginTop: 18, paddingTop: 2, paddingBottom: 2 }}>
        {row("check", "Eligibility", o.eligibility?.text || "See college")}
        {row("clock", "Duration", o.duration || "Varies")}
        {row("pin", "In Bengaluru", where)}
        {row("rupee", "Approx. cost", costText(o))}
        {exams && row("list", "Exams / entry", exams)}
        {schs && row("sch", "Scholarships", schs)}
      </div>
      <div className="verify"><Icon name="refresh" size={14} style={{ color: "var(--muted)" }} />Figures shown are being verified — confirm before you rely on them.</div>
      {!!o.human_touchpoint && (
        <button className="touch" style={{ width: "100%" }} onClick={() => ctx.toast("Coming soon: a short, real story from someone on this path.")}>
          <span style={{ color: "var(--primary)" }}><Icon name="user" size={20} /></span><span style={{ flex: 1, textAlign: "left" }}>Hear from someone who took this path</span><span style={{ color: "var(--primary)" }}><Icon name="chev" size={18} stroke={2} /></span>
        </button>
      )}
      {refl && (
        <div className="band">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="k"><Icon name="bulb" size={15} stroke={2} /> A GENTLE READ FOR YOU</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{refl.band}</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 11 }}>{refl.why_this_connects} <span className="muted">Worth watching: {refl.what_to_watch}</span></p>
          <div className="disc"><Icon name="info" size={13} style={{ color: "var(--muted)" }} /> {loading ? "personalizing…" : "An AI suggestion, not a guarantee — you decide."}</div>
        </div>
      )}
      {!showChat ? (
        <button className="ask-open" onClick={() => setShowChat(true)}>
          <span style={{ color: "var(--primary)" }}><Icon name="bulb" size={17} stroke={2} /></span>
          <span style={{ flex: 1, textAlign: "left" }}>Have a question about {shortName(o.name)}? Ask Marg</span>
          <span style={{ color: "var(--primary)" }}><Icon name="chev" size={18} stroke={2} /></span>
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="section-k">ASK ABOUT THIS STREAM</div>
          <Chat ctx={ctx} mode="explore" contextId={o.id} placeholder={`e.g. Can I do CA after ${shortName(o.name)}?`} />
        </div>
      )}
      <div className="spacer" style={{ minHeight: 16 }} />
      <button className={"btn " + (saved ? "btn-soft" : "btn-primary")} onClick={toggleSave}>{saved ? "✓ In your shortlist" : <><Icon name="plus" size={18} style={{ color: "#fff" }} /> Add to my shortlist</>}</button>
    </section>
  );
}

// Detail view for an expansion-tier pathway. These are unverified and framing-led,
// so (unlike core options) there is no AI "fit" band and no shortlist — instead we
// lead with the honest frame and cross-link to the related core options.
export function SpecializedDetail({ ctx }: { ctx: Ctx }) {
  const s = ctx.specialized.find((x) => x.id === ctx.param);
  if (!s) return <Explore ctx={ctx} />;
  const where = s.where_in_bangalore?.examples?.slice(0, 3).join(", ") || "";
  const cost = costText(s as unknown as Option);
  const schs = (s.related_scholarships || []).map((id) => ctx.scholarshipNames[id] || id).join(", ");
  const related = (s.related_core_options || [])
    .map((id) => ctx.options.find((o) => o.id === id))
    .filter((o): o is Option => !!o);
  const row = (name: string, lab: string, val: string) => (
    <div className="row"><span style={{ color: "var(--violet)" }}><Icon name={name} size={18} /></span><div><div className="lab">{lab}</div><div className="val">{val}</div></div></div>
  );
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("explore")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Back to options</span></div>
      <div className="eyebrow" style={{ color: "var(--violet)", background: "var(--violet-tint)" }}><Icon name="star" size={14} stroke={2} /> A path worth knowing about</div>
      <h1 style={{ fontSize: 24, marginTop: 12 }}>{s.name}</h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10 }}>{s.summary}</p>

      {s.frame && (
        <div className="card" style={{ marginTop: 16, background: "var(--violet-tint)", borderColor: "var(--violet-bd)" }}>
          <div style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 11.5, fontWeight: 700, color: "var(--violet)", letterSpacing: ".3px" }}><Icon name="info" size={15} stroke={2} /> HOW TO READ THIS PATH</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>{s.frame}</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 16, paddingTop: 2, paddingBottom: 2 }}>
        {s.eligibility?.text && row("check", "Eligibility", s.eligibility.text)}
        {s.duration && row("clock", "Duration", s.duration)}
        {where && row("pin", "In Bengaluru", where)}
        {cost && cost !== "Varies" && row("rupee", "Approx. cost", cost)}
        {schs && row("sch", "Scholarships", schs)}
      </div>
      <div className="verify"><Icon name="refresh" size={14} style={{ color: "var(--muted)" }} />An unverified path — confirm details with the official source before you rely on them.</div>

      {s.honest_notes && (
        <div className="note" style={{ marginTop: 14 }}>{s.honest_notes}</div>
      )}

      {related.length > 0 && (
        <>
          <div className="section-k" style={{ marginTop: 20 }}>RELATED OPTIONS TO COMPARE</div>
          <div className="stack" style={{ marginTop: 10 }}>
            {related.map((o) => (
              <button key={o.id} className="opt" style={{ minHeight: "auto" }} onClick={() => ctx.go("detail", o.id)}>
                <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
                  <div className="dot"><Icon name={optIconName(o.id)} size={16} /></div>
                  <h3>{shortName(o.name)}</h3>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-ghost" onClick={() => ctx.go("explore")}>Back to all options</button>
    </section>
  );
}

export function Shortlist({ ctx }: { ctx: Ctx }) {
  async function remove(id: string) {
    const res = await api.removeShortlist(id);
    if (res.data?.shortlist) ctx.setShortlist(res.data.shortlist);
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("explore")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 17 }}>Your shortlist</div></div>
      <p className="lead">Keep two or three open. There's no rush, and you can change your mind anytime.</p>
      <div style={{ marginTop: 16 }}>
        {ctx.shortlist.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: "34px 18px" }}>Nothing saved yet. Explore your options and keep 2–3 that interest you.</div>
        ) : (
          <div className="stack">
            {ctx.shortlist.map((s) => {
              const o = ctx.options.find((x) => x.id === s.option_id);
              if (!o) return null;
              return (
                <div key={s.option_id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 18 }}>{o.name}</div>
                    <button className="back" title="Remove" onClick={() => remove(s.option_id)}><Bookmark /></button>
                  </div>
                  <div className="note" style={{ marginTop: 10 }}>{o.leads_to ? "Leads to: " + o.leads_to.slice(0, 3).join(", ") : ""}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="spacer" style={{ minHeight: 16 }} />
      <div className="stack">
        <button className="btn btn-ghost" onClick={() => ctx.toast("In the real product, sharing is yours to control — a family view, no rankings.")}>Save &amp; share with my family</button>
        <button className="btn btn-soft" onClick={() => ctx.toast("Saved. Come back whenever you're ready — that's a fine choice.")}>I'm not ready to choose yet — save &amp; come back</button>
      </div>
      <FooterLinks ctx={ctx} />
    </section>
  );
}

export function Aspire({ ctx }: { ctx: Ctx }) {
  const [goal, setGoal] = useState("");
  const start = () => { const g = goal.trim(); if (g) ctx.go("goalchat", g); };
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("mode")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 17 }}>A goal in mind</div></div>
      <h1 style={{ fontSize: 24 }}>Where would you like to head?</h1>
      <p className="lead" style={{ marginTop: 6 }}>Tell me your goal in your own words — or pick a common one below. We'll keep it open, not fixed.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <label className="field-label">Your goal, in your words</label>
        <textarea className="ta" value={goal} rows={2} placeholder="e.g. I want to design video games / join the army / start my own business…"
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(); } }} />
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!goal.trim()} onClick={start}>Talk it through with Marg</button>
      </div>

      <div className="section-k" style={{ marginTop: 22 }}>OR START FROM A COMMON GOAL</div>
      <div className="stack" style={{ marginTop: 12 }}>
        {ctx.pathways.map((p) => (
          <button key={p.id} className="opt" style={{ minHeight: "auto" }} onClick={() => ctx.go("why", p.id)}>
            <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
              <div className="dot" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}><Icon name="target" size={17} /></div>
              <h3>{p.ambition}</h3>
            </div>
          </button>
        ))}
      </div>
      <FooterLinks ctx={ctx} />
    </section>
  );
}

export function GoalChat({ ctx }: { ctx: Ctx }) {
  const goal = ctx.param || "";
  if (!goal) return <Aspire ctx={ctx} />;
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("aspire")}><Icon name="back" size={22} /></button><span style={{ fontSize: 12, fontWeight: 700, color: "var(--violet)", background: "var(--violet-tint)", padding: "4px 9px", borderRadius: 999 }}>PREVIEW</span></div>
      <h1 style={{ fontSize: 23, marginTop: 8 }}>“{goal}”</h1>
      <p className="lead" style={{ marginTop: 8 }}>Let's talk it through. I'll point you to real paths that fit — and be honest where a goal has no single fixed route. Goals often shift as you learn, and that's fine.</p>
      <div style={{ marginTop: 14 }}>
        <Chat ctx={ctx} mode="aspire" goal={goal}
          placeholder="Ask me how to get there, what it takes, or what else is close…"
          seedAssistant={`Tell me a little about why “${goal}” draws you, and I'll walk you through the real routes toward it after Class 10.`} />
      </div>
    </section>
  );
}

export function WhyGoal({ ctx }: { ctx: Ctx }) {
  const p = ctx.pathways.find((x) => x.id === ctx.param);
  if (!p) return <Aspire ctx={ctx} />;
  const label = p.ambition.toLowerCase().replace(/^become (a |an )?/, "").replace(/^work in /, "");
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("aspire")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>One quick reflection</span></div>
      <div className="spacer" />
      <div className="ic" style={{ background: "var(--violet-tint)", color: "var(--violet)", width: 52, height: 52 }}><Icon name="target" size={26} stroke={1.8} /></div>
      <h1 style={{ fontSize: 26, marginTop: 16 }}>Why {label}?</h1>
      <p className="lead" style={{ marginTop: 10 }}>Before we plan, it helps to know what draws you. Goals often shift as you learn more — and that's completely fine.</p>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-primary" onClick={() => ctx.go("plan", p.id)}>I've thought about it — show me the path</button>
        <button className="btn btn-ghost" onClick={() => ctx.go("explore")}>Actually, let me explore my options first</button>
      </div>
    </section>
  );
}

export function Plan({ ctx }: { ctx: Ctx }) {
  const p = ctx.pathways.find((x) => x.id === ctx.param);
  const [ai, setAi] = useState<PlanReflection | null>(null);
  useEffect(() => {
    if (!p) return;
    setAi(planLocal(p, ctx.profile));
    let live = true;
    api.plan(p.id, ctx.persona?.id).then((res) => { if (live && res.ok && res.data?.plan) setAi(res.data.plan); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);
  if (!p) return <Aspire ctx={ctx} />;
  const steps = p.next_horizon_steps || [];
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("why", p.id)}><Icon name="back" size={22} /></button><span style={{ fontSize: 12, fontWeight: 700, color: "var(--violet)", background: "var(--violet-tint)", padding: "4px 9px", borderRadius: 999 }}>PREVIEW</span></div>
      <h1 style={{ fontSize: 25 }}>{p.ambition} — a possible path</h1>
      <p className="lead" style={{ marginTop: 8 }}>This is one way there, and it can change as you do.</p>

      <div className="section-k" style={{ marginTop: 20 }}>YOUR NEXT 1–2 YEARS</div>
      <div style={{ marginTop: 12 }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div className="step" key={i}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <div className="num">{i + 1}</div>{!last && <div className="stem" />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16 }}><div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{s}</div></div>
            </div>
          );
        })}
      </div>

      {p.honest_cost_effort && (
        <div className="card band-amber" style={{ marginTop: 18 }}>
          <div style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 11.5, fontWeight: 700, color: "var(--amber)", letterSpacing: ".3px" }}><Icon name="warn" size={15} stroke={2} style={{ color: "var(--amber)" }} /> HONEST ABOUT WHAT IT TAKES</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>{p.honest_cost_effort}</p>
          {p.real_routes_through_cost && p.real_routes_through_cost.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8, marginBottom: 6 }}>Real routes through it:</div>
              <div className="chips">{p.real_routes_through_cost.map((r) => <span key={r} className="chip" style={{ cursor: "default" }}>{r}</span>)}</div>
            </>
          )}
        </div>
      )}

      {p.adjacent_destinations && p.adjacent_destinations.length > 0 && (
        <>
          <div className="section-k" style={{ marginTop: 18 }}>IF THIS CHANGES, YOU'RE NOT STUCK</div>
          <div className="chips" style={{ marginTop: 10 }}>{p.adjacent_destinations.map((a) => <span key={a} className="chip" style={{ cursor: "default" }}>{a}</span>)}</div>
        </>
      )}

      {ai && (
        <div className="card" style={{ marginTop: 18, background: "var(--violet-tint)", borderColor: "var(--violet-bd)" }}>
          <div style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 11.5, fontWeight: 700, color: "var(--violet)", letterSpacing: ".3px" }}><Icon name="star" size={15} stroke={2} /> A GENTLE READ FOR YOU</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>{ai.opening}</p>
          {ai.reconciliation && <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>{ai.reconciliation}</p>}
          {ai.watch && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Worth watching: {ai.watch}</div>}
          <div className="disc" style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", display: "flex", gap: 7, alignItems: "center" }}><Icon name="info" size={13} style={{ color: "var(--muted)" }} /> An AI suggestion, not a guarantee — you decide.</div>
        </div>
      )}

      <div className="disclaimer-foot">{p.what_if_it_changes}<br />A preview — full step-by-step planning comes later.</div>
    </section>
  );
}

export function DeleteConfirm({ ctx }: { ctx: Ctx }) {
  const [busy, setBusy] = useState(false);
  async function del() { setBusy(true); await api.deleteMe(); setBusy(false); ctx.toast("Your data has been deleted."); localStorage.removeItem("marg_token"); ctx.go("welcome"); }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("shortlist")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Delete my data</span></div>
      <div className="spacer" />
      <h1 style={{ fontSize: 26 }}>Delete everything?</h1>
      <p className="lead" style={{ marginTop: 10 }}>This removes your account, answers, and shortlist for good. It can't be undone — and that's your right.</p>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-soft" disabled={busy} onClick={del} style={{ color: "#B0261D" }}>{busy ? "Deleting…" : "Yes, delete my data"}</button>
        <button className="btn btn-ghost" onClick={() => ctx.go("shortlist")}>Keep my data</button>
      </div>
    </section>
  );
}
