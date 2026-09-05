import { useEffect, useRef, useState } from "react";
import { api, setAdmin, getAdmin, clearAdmin, type Option, type Profile, type Reflection, type ShortlistItem, type Pathway, type PlanReflection, type ChatMsg, type Specialized, type PersonaPublic, type AdminMetrics, type FeedbackItem } from "./api";
import { Icon, Compass, Bookmark } from "./icons";
import { INTERESTS, VALUES, localReflect, planLocal, pickNudge, costText, checkDistress, shortName, optIconName } from "./lib";
import { trackFeature, trackFlowStep, trackValueMoment } from "./analytics";

export interface Ctx {
  go: (name: string, param?: string | null) => void;
  param: string | null;
  toast: (m: string) => void;
  openSafety: (fromDistress?: boolean) => void;
  logout: () => void;
  startSession: (consent: { path: string; school_code?: string }) => void | Promise<void>;
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
  disclaimer: string;
  personas: PersonaPublic[];
  persona: PersonaPublic | null;
  setPersona: (p: PersonaPublic) => void | Promise<void>;
}

function FooterLinks({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="footlinks">
        <button className="help-link" onClick={() => setOpen(true)}>Suggest an improvement</button>
        <span>·</span>
        <button className="help-link" onClick={() => ctx.openSafety(false)}>Get help</button>
        <span>·</span>
        <button className="help-link" onClick={() => ctx.go("delete-confirm")}>Delete my data</button>
        <span>·</span>
        <button className="help-link" onClick={() => ctx.logout()}>Start over</button>
      </div>
      {open && <ImproveMarg ctx={ctx} where="footer" onClose={() => setOpen(false)} />}
    </>
  );
}

// A prominent, inviting entry point to the same feedback channel, for high-traffic
// screens (e.g. Explore) where a footer link is too easy to miss.
export function ImprovePrompt({ ctx, where }: { ctx: Ctx; where: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="improve-cta" onClick={() => setOpen(true)}>
        <span className="ic-ic"><Icon name="bulb" size={18} stroke={2} /></span>
        <span className="ic-body"><b>Spotted something wrong or missing?</b><span>Tell Marg, every note is read and helps us improve.</span></span>
        <span className="ic-chev"><Icon name="chev" size={18} stroke={2} /></span>
      </button>
      {open && <ImproveMarg ctx={ctx} where={where} onClose={() => setOpen(false)} />}
    </>
  );
}

// The deliberate "tell Marg what to improve" channel. Free text + an optional
// category. It goes to the same interpreted feedback loop as the 👍/👎 note, 
// Marg tags it for the admin; it never auto-changes the product.
const FB_CATS: { id: string; label: string }[] = [
  { id: "wrong_info", label: "Wrong or outdated info" },
  { id: "missing", label: "A missing option or path" },
  { id: "confusing", label: "Something was confusing" },
  { id: "broken", label: "Something didn't work" },
  { id: "other", label: "Something else" },
];
export function ImproveMarg({ ctx, where, onClose }: { ctx: Ctx; where: string; onClose: () => void }) {
  const [cat, setCat] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => {
    if (!text.trim()) return;
    api.feedback({ text: text.trim(), category: cat, context: where, persona: ctx.persona?.id });
    setSent(true);
  };
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Suggest an improvement">
        {sent ? (
          <div className="im-done">
            <div className="im-check"><Icon name="check" size={22} /></div>
            <h3>Thank you, Marg is listening</h3>
            <p>Your note goes straight to the people improving Marg. If it points to a fact we should fix, a human checks it before anything changes.</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 4px" }}>Help make Marg better</h3>
            <p className="im-lead">What felt off, missing, or wrong? Every note is read.</p>
            <div className="im-cats">
              {FB_CATS.map((c) => (
                <button key={c.id} className={"im-cat" + (cat === c.id ? " on" : "")} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</button>
              ))}
            </div>
            <textarea className="ta" rows={4} value={text} placeholder="Tell us in your own words…" onChange={(e) => setText(e.target.value)} style={{ marginTop: 10 }} />
            <div className="im-actions">
              <button className="help-link" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={submit} disabled={!text.trim()}>Send to Marg</button>
            </div>
          </>
        )}
      </div>
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
    trackFeature("chat", contextId ? "option_detail" : "goal", ctx.persona?.id);
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    const res = await api.chat({ mode, contextId, goal, messages: next, persona: ctx.persona?.id });
    setBusy(false);
    if (res.data?.safety) {
      ctx.openSafety(true);
      setMsgs([...next, { role: "assistant", content: "I want to make sure you're okay before we carry on, please see the help options that just came up. I'm here when you're ready." }]);
      return;
    }
    setMsgs([...next, { role: "assistant", content: res.data?.reply || "Sorry, I couldn't answer just now. Please try again in a moment." }]);
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
      <div className="chat-disc"><Icon name="info" size={12} style={{ color: "var(--muted)" }} /> Answers come from verified info only, never a verdict, figures may still be being checked.</div>
    </div>
  );
}

// Lightweight validation instrument: a 👍/👎 + optional note at key moments,
// logged to the events table (api.event) so moderated sessions produce real signal.
export function Feedback({ ctx, where, prompt }: { ctx: Ctx; where: string; prompt: string }) {
  const [rating, setRating] = useState<null | "up" | "down">(null);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  // The 👍/👎 is recorded the instant it's clicked, no Send needed. Send only
  // submits the optional free-text note. (Re-clicking the same thumb is a no-op.)
  const rate = (r: "up" | "down") => {
    if (r === rating) return;
    setRating(r);
    api.event("feedback", { where, rating: r, persona: ctx.persona?.id });
  };
  const submit = () => {
    if (!note.trim()) return;
    api.feedback({ text: note.trim(), rating, context: where, persona: ctx.persona?.id });
    setNoteSent(true);
  };
  if (noteSent) return <div className="fb-done"><Icon name="check" size={14} /> Thanks, that helps us learn.</div>;
  return (
    <div className="fb">
      <div className="fb-row">
        <span className="fb-q">{prompt}</span>
        <button className={"fb-btn" + (rating === "up" ? " on" : "")} onClick={() => rate("up")} aria-label="Helpful">👍</button>
        <button className={"fb-btn" + (rating === "down" ? " on" : "")} onClick={() => rate("down")} aria-label="Not helpful">👎</button>
      </div>
      {rating && (
        <div className="fb-note">
          <span className="fb-ok"><Icon name="check" size={13} /> Thanks, noted.</span>
          <input className="ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Want to add why? (optional)" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          <button className="fb-send" onClick={submit} disabled={!note.trim()}>Send</button>
        </div>
      )}
    </div>
  );
}

// Landing / front door, the page anyone with the app link reaches. Persuade mode:
// warm citizen-first pitch, a "Get started" CTA, and a government-alignment trust band.
// Design: "dawn over the road", the logo's sunrise mapped onto the stages of life.
function SunMark({ size = 96 }: { size?: number }) {
  return (
    <svg className="sunmark" width={size} height={size * 0.62} viewBox="0 0 120 74" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sunfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBBF3B" /><stop offset="1" stopColor="#F0872E" />
        </linearGradient>
        <linearGradient id="roadfill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3E9C63" /><stop offset="1" stopColor="#1E63C9" />
        </linearGradient>
      </defs>
      <g className="rays" stroke="#F4A62A" strokeWidth="3" strokeLinecap="round">
        <path d="M60 8V2" /><path d="M42 12l-3-5" /><path d="M78 12l3-5" /><path d="M28 24l-5-3" /><path d="M92 24l5-3" />
      </g>
      <path d="M36 40a24 24 0 0 1 48 0z" fill="url(#sunfill)" />
      <path d="M18 72c14-2 22-10 42-10s28 8 42 10" stroke="url(#roadfill)" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".9" />
    </svg>
  );
}

export function Home({ ctx }: { ctx: Ctx }) {
  const start = () => ctx.go("personas");
  const openStage = (id: string) => { const p = ctx.personas.find((x) => x.id === id); if (p) { ctx.setPersona(p); ctx.go("welcome"); } else start(); };
  const stages = [
    { id: "class10", when: "School-going", line: "Choosing a stream, a course, a direction.", ready: true },
    { id: "midcareer", when: "Mid-career", line: "A switch, growth, or more meaning at work.", ready: false },
    { id: "retiree", when: "Later life", line: "Purpose, calm and community, this chapter.", ready: false },
  ];
  const principle = (name: string, h: string, t: string) => (
    <div className="principle">
      <span className="p-ic"><Icon name={name} size={20} stroke={2} /></span>
      <div><h3>{h}</h3><p>{t}</p></div>
    </div>
  );

  return (
    <div className="home">
      <header className="home-hero">
        <div className="dawn" aria-hidden="true" />
        <div className="hero-inner">
          <SunMark size={104} />
          <h1>See every path ahead, then choose your own.</h1>
          <p className="hero-sub">Marg lays out your real options at life's crossroads, clearly and honestly. It never tells you what to pick. From school to retirement, the choice stays yours.</p>
          <button className="btn btn-primary hero-cta" onClick={start}>Explore your paths <Icon name="chev" size={18} stroke={2.4} style={{ color: "#fff" }} /></button>
          <div className="hero-trust">
            <span className="trust-chip"><Icon name="lock" size={12} /> Private &amp; secure</span>
            <span className="trust-chip"><Icon name="list" size={12} /> Nothing ranked or pushed</span>
            <span className="trust-chip"><Icon name="check" size={12} /> You decide, always</span>
          </div>
        </div>
      </header>

      <section className="home-problem">
        <div className="prob-head">
          <div className="prob-text">
            <h2>Decision fatigue is real and exhausting.</h2>
            <p className="prob-lead">When choices pile up amid constant change, people hit <strong>decision paralysis</strong>: the stuck, frozen feeling of being unable to act. At a big crossroads, you're far from alone.</p>
          </div>
          <img className="prob-illus" src="/decision-fatigue.jpg" alt="A person overwhelmed by competing choices: career, health, move, invest, which job, buy a home" loading="lazy" />
        </div>
        <div className="stat-lead">
          <b>1 in 3</b>
          <span>Indians hit <strong>decision paralysis</strong>, overwhelmed, and unable to act.</span>
        </div>
        <div className="stat-row">
          <div className="ministat"><b>69%</b><span>struggle to plan ahead</span></div>
          <div className="ministat"><b>62%</b><span>feel ill-equipped to decide</span></div>
          <div className="ministat"><b>57%</b><span>regret chances they let slip</span></div>
        </div>
        <p className="prob-src">Survey of Indian adults · reported by The Financial Express, 2024</p>
        <div className="prob-authority">
          <span className="pa-ic"><Icon name="building" size={19} stroke={2} /></span>
          <p><strong>India's own institutions now treat decision fatigue as a real problem.</strong> DARPG is delayering decision-heavy government processes, and the Ministry of Communications (Dept. of Telecom) runs cognitive-wellbeing training for clearer decision-making, the very overload Marg helps citizens navigate at life's crossroads.</p>
        </div>
      </section>

      <section className="home-intent">
        <h2>A calmer way to decide.</h2>
        <div className="principles">
          {principle("search", "The whole field, in view", "Every real option, side by side. Nothing hidden, nothing ranked for you.")}
          {principle("star", "Paths you hadn't considered", "We gently surface at least one route you might have missed, no pressure.")}
          {principle("check", "Honest about the cost", "The real effort and money each path takes and the routes through it.")}
        </div>
      </section>

      <section className="home-journey">
        <h2>One companion, every stage of life.</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>The same calm guidance, shaped to where you are.</p>
        <div className="journey">
          <div className="journey-line" aria-hidden="true" />
          {stages.map((s, i) => (
            <button key={s.id} className="stage" onClick={() => openStage(s.id)}>
              <span className={"stage-dot d" + i} aria-hidden="true" />
              <div className="stage-body">
                <div className="stage-head">
                  <h3>{s.when}</h3>
                  <span className={s.ready ? "chip-ready" : "chip-proto"}>{s.ready ? "Ready" : "Beta"}</span>
                </div>
                <p>{s.line}</p>
              </div>
              <span className="stage-chev"><Icon name="chev" size={17} stroke={2.2} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-gov">
        <div className="gov-glow" aria-hidden="true" />
        <h2>Aligned with the initiatives built to help you.</h2>
        <p className="gov-lead">Scholarships and schemes go unused because people don't know they exist. Marg connects your choices to the public programmes made for them.</p>
        <div className="pillars">
          <div className="pillar"><h3>NEP 2020</h3><p>Life-skills &amp; holistic growth</p></div>
          <div className="pillar"><h3>Skill India</h3><p>Careers &amp; employability</p></div>
          <div className="pillar"><h3>Digital India</h3><p>Citizen-first services</p></div>
        </div>
        <div className="gov-portals"><Icon name="building" size={16} /><span>Points you to real portals, the National Scholarship Portal, state education boards (DTE / PUE), and senior support like Elderline.</span></div>
      </section>

      <section className="home-cta">
        <h2>Your road, your pace.</h2>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={start}>Explore your paths <Icon name="chev" size={18} stroke={2.4} style={{ color: "#fff" }} /></button>
        <p className="home-fine">An early preview, information is provisional, so double-check the important details. Private by design (DPDP-ready), and you can delete everything anytime.</p>
      </section>

      <footer className="home-foot">
        <img className="foot-logo" src="/marg-logo.png" alt="Marg" />
        <span>Guiding India's Life Choices</span>
        <button className="home-admin" onClick={() => ctx.go("adminlogin")}>Admin</button>
      </footer>
    </div>
  );
}

export function PersonaPick({ ctx }: { ctx: Ctx }) {
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("home")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 18 }}>Marg</div></div>
      <h1 style={{ fontSize: 26 }}>Who is this for?</h1>
      <p className="lead" style={{ marginTop: 8 }}>Marg adapts to your stage of life. Pick one to begin.</p>
      <div className="stack" style={{ marginTop: 22, gap: 14 }}>
        {ctx.personas.map((p) => (
          <button key={p.id} className="choice" style={{ alignItems: "flex-start", textAlign: "left" }}
            onClick={async () => { await ctx.setPersona(p); ctx.go("welcome"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>{p.label}</div>
              <span className={p.experimental ? "badge-exp" : "badge-ok"}>{p.experimental ? "BETA" : "READY"}</span>
            </div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{p.tagline} · ages {p.age_band}</div>
            {p.disclosure && <div className="note" style={{ marginTop: 10, fontSize: 12 }}>{p.disclosure}</div>}
          </button>
        ))}
      </div>
      <div className="disclaimer-foot" style={{ marginTop: 18 }}>The school-going stage is the built, verified experience. Others are early beta versions of Marg's one-engine vision.</div>
    </section>
  );
}

export function Welcome({ ctx }: { ctx: Ctx }) {
  const p = ctx.persona;
  const adult = p?.consent_rule === "adult_self";
  const isClass10 = (p?.id ?? "class10") === "class10";
  const start = () => { if (adult) ctx.startSession({ path: "self_serve" }); else ctx.go("consent"); };
  return (
    <section className="screen">
      {ctx.personas.length > 1 && (
        <div className="topbar"><button className="back" onClick={() => ctx.go("personas")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Change stage</span></div>
      )}
      <div className="wordmark"><Compass /><span>Marg</span></div>
      <div className="spacer" />
      <div className="stack" style={{ gap: 16 }}>
        <div className="eyebrow">{p?.tagline ?? "CBSE · Bengaluru"}</div>
        <h1 style={{ fontSize: 33 }}>{isClass10 ? "See all your paths from here, then choose, without being boxed in." : "See your real options, then choose your next step, without being boxed in."}</h1>
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
  const choose = (path: string) => { ctx.startSession({ path, school_code: codeRef.current?.value }); };
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("welcome")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Setting up safely</span></div>
      <div className="eyebrow">A quick consent step</div>
      <h1 style={{ fontSize: 26, marginTop: 12 }}>Let's set this up safely</h1>
      <p className="lead" style={{ marginTop: 10 }}>You're a student, so we need a parent or guardian's okay before we keep any of your answers. India's data-protection rules (DPDP) require this and it protects you.</p>
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bullet("check", "We keep only what helps show your options.")}
          {bullet("lock", "Your answers are private, never sold or shared.")}
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
          <button className="btn btn-primary" onClick={() => choose("self_serve")}>My parent/guardian is here, they consent</button>
          <button className="btn btn-ghost" onClick={() => ctx.go("consent", "school")}>Use my school's code instead</button>
        </div>
      )}
      <button className="help-link" style={{ marginTop: 16 }} onClick={() => ctx.openSafety(false)}>Feeling low or unsafe? Talk to someone now</button>
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
    trackFlowStep("onboarding", "intake_completed", 1, ctx.persona?.id);
    if (distress) ctx.openSafety(true); else ctx.go("mode");
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("welcome")}><Icon name="back" size={22} /></button><div className="bar"><span style={{ transform: `scaleX(${pct / 100})` }} /></div></div>
      <h1 style={{ fontSize: 25 }}>{pi.title}</h1>
      <p className="lead" style={{ marginTop: 8 }}>{pi.lead}</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{pi.interests.title}</div><div className="chips">{chips(pi.interests.options, "interests")}</div><div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>These can change over time, that's normal.</div></div>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{pi.values.title}</div><div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Pick what feels true today.</div><div className="chips">{chips(pi.values.options, "values")}</div></div>
        {ctx.persona?.id === "class10" && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>Add your marks?</div><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Optional, we don't lead with these.</div></div>
              <button className={"chip" + (p.marks === "skipped" ? " on" : "")} onClick={() => ctx.setProfile({ ...p, marks: p.marks === "skipped" ? null : "skipped" })}>{p.marks === "skipped" ? "Skipped" : "Skip"}</button>
            </div>
            {p.marks !== "skipped" && (
              <input className="ta" value={p.marks ?? ""} onChange={(e) => ctx.setProfile({ ...p, marks: e.target.value || null })} placeholder="e.g. 85% or 9.2 CGPA (optional)" aria-label="Your marks" style={{ marginTop: 12 }} />
            )}
          </div>
        )}
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
  useEffect(() => { trackFlowStep("onboarding", "explore_opened", 2, ctx.persona?.id); trackFeature("explore", "mode", ctx.persona?.id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const academic = new Set(["pu_science", "pu_commerce", "pu_humanities"]);
  // Personalised "have you considered", only shows when a picked interest maps to a
  // genuinely-overlooked option; otherwise nothing (no arbitrary suggestion).
  const nudge = pickNudge(ctx.profile, ctx.options, ctx.specialized);
  const nudgeOpt = nudge ? (nudge.spec ? ctx.specialized.find((s) => s.id === nudge.id) : ctx.options.find((o) => o.id === nudge.id)) : null;
  const [showMore, setShowMore] = useState(false); // expansion tier collapsed by default, don't overwhelm
  return (
    <section className="screen wide">
      <div className="topbar"><button className="back" onClick={() => ctx.go("mode")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 17 }}>Your options</div></div>
      <h1 style={{ fontSize: 24 }}>{ctx.persona?.framing.exploreTitle ?? "Everything open to you"}</h1>
      <p className="lead" style={{ marginTop: 6 }}>{ctx.persona?.framing.exploreLead ?? "Nothing here is ranked. Look around freely."}</p>
      {ctx.disclaimer && (
        <div className="note" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: "var(--muted)", flex: "none", marginTop: 1 }}><Icon name="info" size={14} /></span>
          <span>{ctx.disclaimer}</span>
        </div>
      )}
      {nudge && nudgeOpt && (
        <button className="nudge" style={{ marginTop: 16, width: "100%", alignItems: "flex-start" }} onClick={() => { api.event("nudge_engaged", { id: nudge.id, spec: nudge.spec, persona: ctx.persona?.id }); ctx.go(nudge.spec ? "specialized" : "detail", nudge.id); }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--violet)", flex: "none", marginTop: 1 }}><Icon name="star" size={18} stroke={2} /></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div className="k">HAVE YOU CONSIDERED</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{nudgeOpt.name}</div>
            <div className="nudge-why">Because {nudge.why}</div>
          </div>
          <span style={{ color: "var(--violet)", flex: "none", alignSelf: "center" }}><Icon name="chev" size={18} stroke={2} /></span>
        </button>
      )}
      <div className="grid" style={{ marginTop: 14 }}>
        {ctx.options.map((o) => {
          const alt = !academic.has(o.id);
          return (
            <button key={o.id} className={"opt" + (alt ? " alt" : "")} onClick={() => ctx.go("detail", o.id)}>
              <div className="dot" style={{ color: alt ? "var(--alt-fg)" : "var(--primary)" }}><Icon name={optIconName(o.id)} size={17} /></div>
              <h3>{shortName(o.name)}</h3>
              <div className="sub">{(o.leads_to || []).slice(0, 3).join(", ")}</div>
            </button>
          );
        })}
      </div>

      {ctx.specialized.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button className="expand-head" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--violet)", flex: "none" }}><Icon name="star" size={17} stroke={2} /></div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div className="k" style={{ color: "var(--violet)" }}>PATHS YOU MIGHT NOT HAVE CONSIDERED</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{showMore ? "Not ranked, confirm details before you rely on them." : `${ctx.specialized.length} more paths, when you're ready, no rush`}</div>
            </div>
            <span style={{ color: "var(--violet)", flex: "none", display: "inline-flex", transform: showMore ? "rotate(90deg)" : "none", transition: "transform .18s ease" }}><Icon name="chev" size={20} stroke={2} /></span>
          </button>
          {showMore && (
            <div className="grid" style={{ marginTop: 12 }}>
              {ctx.specialized.map((s) => (
                <button key={s.id} className="opt spec" onClick={() => ctx.go("specialized", s.id)}>
                  <div className="dot" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}><Icon name="star" size={16} /></div>
                  <h3>{s.name}</h3>
                  <div className="sub">{(s.leads_to || []).slice(0, 2).join(", ")}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => ctx.go("shortlist")}>View my shortlist ({ctx.shortlist.length})</button>
      <ImprovePrompt ctx={ctx} where="explore" />
      <FooterLinks ctx={ctx} />
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
    api.event("option_viewed", { option_id: o.id, persona: ctx.persona?.id }); // North-Star: field exploration (fires even if the reflection can't load)
    trackFlowStep("onboarding", "option_detail_opened", 3, ctx.persona?.id);
    trackFeature("option_detail", "explore", ctx.persona?.id);
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
    if (!saved) { // first tangible value: kept something worth exploring
      trackFlowStep("onboarding", "shortlist_saved", 4, ctx.persona?.id);
      trackValueMoment("first_shortlist_save", ctx.persona?.id);
    }
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
        {row("pin", ctx.persona?.where_label ?? "In Bengaluru", where)}
        {row("rupee", "Approx. cost", costText(o))}
        {exams && row("list", "Exams / entry", exams)}
        {schs && row("sch", "Scholarships", schs)}
      </div>
      <div className="verify"><Icon name="refresh" size={14} style={{ color: "var(--muted)" }} />{ctx.disclaimer || "Figures shown are provisional, confirm before you rely on them."}</div>
      <OfficialLinks links={o.official_links} />
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
          <div className="disc"><Icon name="info" size={13} style={{ color: "var(--muted)" }} /> {loading ? "personalizing…" : "An AI suggestion, not a guarantee, you decide."}</div>
        </div>
      )}
      {refl && !loading && <Feedback ctx={ctx} where="reflection" prompt="Was this helpful?" />}
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
      <FooterLinks ctx={ctx} />
    </section>
  );
}

// Official "where to look" links, curated government / recognised-body portals
// only (the source of truth where the current, verified centre list lives). Marg
// never lists private coaching centres; these open the authority's own directory.
function OfficialLinks({ links, accent = "var(--primary)" }: { links?: { label: string; url: string }[]; accent?: string }) {
  if (!links || links.length === 0) return null;
  return (
    <>
      <div className="section-k" style={{ marginTop: 20 }}>WHERE TO LOOK · OFFICIAL PORTALS</div>
      <div className="offlink-note">Government &amp; recognised-body sites, the current, verified list lives here. Marg doesn't list private coaching centres or agents.</div>
      <div className="stack" style={{ marginTop: 10 }}>
        {links.map((l) => (
          <a key={l.url} className="offlink" href={l.url} target="_blank" rel="noopener noreferrer">
            <span className="offlink-ic" style={{ color: accent }}><Icon name="pin" size={16} /></span>
            <span className="offlink-label">{l.label}</span>
            <span className="offlink-ext" aria-hidden="true" style={{ color: accent }}>↗</span>
          </a>
        ))}
      </div>
    </>
  );
}

// Detail view for an expansion-tier pathway. These are unverified and framing-led,
// so (unlike core options) there is no AI "fit" band and no shortlist, instead we
// lead with the honest frame and cross-link to the related core options.
export function SpecializedDetail({ ctx }: { ctx: Ctx }) {
  const s = ctx.specialized.find((x) => x.id === ctx.param);
  // North-star signal: the user engaged an option they hadn't considered.
  useEffect(() => { if (s) { api.event("specialized_viewed", { id: s.id, persona: ctx.persona?.id }); trackFeature("specialized_path", "explore", ctx.persona?.id); } }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
        {where && row("pin", ctx.persona?.where_label ?? "In Bengaluru", where)}
        {cost && cost !== "Varies" && row("rupee", "Approx. cost", cost)}
        {schs && row("sch", "Scholarships", schs)}
      </div>
      <div className="verify"><Icon name="refresh" size={14} style={{ color: "var(--muted)" }} />{ctx.disclaimer || "An unverified path, confirm details with the official source before you rely on them."}</div>

      {s.honest_notes && (
        <div className="note" style={{ marginTop: 14 }}>{s.honest_notes}</div>
      )}

      <OfficialLinks links={s.official_links} accent="var(--violet)" />

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
      <FooterLinks ctx={ctx} />
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
        <button className="btn btn-ghost" onClick={() => ctx.toast("In the real product, sharing is yours to control, a family view, no rankings.")}>Save &amp; share with my family</button>
        <button className="btn btn-soft" onClick={() => ctx.toast("Saved. Come back whenever you're ready, that's a fine choice.")}>I'm not ready to choose yet, save &amp; come back</button>
      </div>
      <Feedback ctx={ctx} where="session" prompt="How did exploring feel?" />
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
      <p className="lead" style={{ marginTop: 6 }}>Tell me your goal in your own words or pick a common one below. We'll keep it open, not fixed.</p>

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
      <p className="lead" style={{ marginTop: 8 }}>Let's talk it through. I'll point you to real paths that fit and be honest where a goal has no single fixed route. Goals often shift as you learn, and that's fine.</p>
      <div style={{ marginTop: 14 }}>
        <Chat ctx={ctx} mode="aspire" goal={goal}
          placeholder="Ask me how to get there, what it takes, or what else is close…"
          seedAssistant={`Tell me a little about why “${goal}” draws you, and I'll walk you through the real routes toward it from here.`} />
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
      <p className="lead" style={{ marginTop: 10 }}>Before we plan, it helps to know what draws you. Goals often shift as you learn more and that's completely fine.</p>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-primary" onClick={() => ctx.go("plan", p.id)}>I've thought about it, show me the path</button>
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
      <h1 style={{ fontSize: 25 }}>{p.ambition}, a possible path</h1>
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
          <div className="disc" style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", display: "flex", gap: 7, alignItems: "center" }}><Icon name="info" size={13} style={{ color: "var(--muted)" }} /> An AI suggestion, not a guarantee, you decide.</div>
        </div>
      )}

      <div className="disclaimer-foot">{p.what_if_it_changes}<br />A preview, full step-by-step planning comes later.</div>
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
      <p className="lead" style={{ marginTop: 10 }}>This removes your account, answers, and shortlist for good. It can't be undone and that's your right.</p>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-soft" disabled={busy} onClick={del} style={{ color: "var(--danger)" }}>{busy ? "Deleting…" : "Yes, delete my data"}</button>
        <button className="btn btn-ghost" onClick={() => ctx.go("shortlist")}>Keep my data</button>
      </div>
    </section>
  );
}

// ===== Admin (metrics & KPIs), reached via the Admin link at the bottom of Home =====
export function AdminLogin({ ctx }: { ctx: Ctx }) {
  const [userId, setUserId] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function login() {
    setErr(""); setBusy(true);
    const res = await api.adminLogin(userId.trim(), password);
    setBusy(false);
    if (res.ok && res.data?.token) { setAdmin(res.data.token); ctx.go("admin"); }
    else setErr("Incorrect admin credentials.");
  }
  return (
    <section className="screen">
      <div className="topbar"><button className="back" onClick={() => ctx.go("home")}><Icon name="back" size={22} /></button><span className="muted" style={{ fontSize: 14 }}>Admin</span></div>
      <h1 style={{ fontSize: 26 }}>Admin sign-in</h1>
      <p className="lead" style={{ marginTop: 8 }}>Metrics & KPIs for the Marg team.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div><label className="field-label">User ID</label><input className="ta" autoCapitalize="none" value={userId} onChange={(e) => setUserId(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") login(); }} /></div>
        <div><label className="field-label">Password</label><input className="ta" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") login(); }} placeholder="password" /></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" disabled={busy} onClick={login}>{busy ? "Signing in…" : "Sign in"}</button>
    </section>
  );
}

export function AdminDashboard({ ctx }: { ctx: Ctx }) {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [err, setErr] = useState("");
  async function load() {
    setErr("");
    if (!getAdmin()) { ctx.go("adminlogin"); return; }
    const res = await api.adminMetrics();
    if (res.status === 401) { clearAdmin(); ctx.go("adminlogin"); return; }
    if (res.data) setM(res.data); else setErr("Couldn't load metrics.");
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const signOut = () => { clearAdmin(); ctx.go("home"); };
  const bar = (<div className="topbar"><button className="back" onClick={() => ctx.go("home")}><Icon name="back" size={22} /></button><div className="wordmark" style={{ fontSize: 17 }}>Marg · Admin</div><span style={{ flex: 1 }} /><button className="help-link" style={{ width: "auto" }} onClick={load}>Refresh</button><button className="help-link" style={{ width: "auto" }} onClick={signOut}>Sign out</button></div>);
  if (!m) return <section className="screen">{bar}<div className="spacer" /><div className="center-note">{err || "Loading metrics…"}</div><div className="spacer" /></section>;
  const pct = Math.round(m.northStar.rate * 100);
  const f = m.funnel;
  const stat = (label: string, val: number | string, warn = false, key?: string) => (
    <div key={key} className={"adm-tile" + (warn ? " adm-warn" : "")}><div className="adm-n">{val}</div><div className="adm-l">{label}</div></div>
  );
  const frow = (label: string, val: number) => {
    const w = f.entered ? Math.round((val / f.entered) * 100) : 0;
    return (
      <div className="adm-frow">
        <div className="adm-fmeta"><span className="adm-flabel">{label}</span><b>{val}</b><span className="adm-fpct">{w}%</span></div>
        <div className="adm-fbar"><span style={{ transform: `scaleX(${w / 100})` }} /></div>
      </div>
    );
  };
  return (
    <section className="screen wide">
      {bar}
      <div className="adm-nsm">
        <div className="adm-nsm-k">★ NORTH STAR</div>
        <div className="adm-nsm-n">{pct}<span>%</span></div>
        <div className="adm-nsm-name">{m.northStar.name}</div>
        <div className="adm-nsm-frac">{m.northStar.numerator} of {m.northStar.denominator} who entered</div>
        <p className="adm-nsm-def">{m.northStar.definition}</p>
      </div>

      <div className="section-k" style={{ marginTop: 22 }}>CONVERGENCE FUNNEL</div>
      <div className="adm-funnel">
        {frow("Entered", f.entered)}
        {frow("Completed intake", f.completedIntake)}
        {frow("Explored the field (new path / 2+ options)", f.exploredUnconsidered)}
        {frow("Saved a shortlist (2+)", f.savedShortlist)}
      </div>

      <div className="section-k" style={{ marginTop: 22 }}>ENGAGEMENT</div>
      <div className="adm-grid">
        {stat("Reflections shown", m.engagement.reflections)}
        {stat("Chat messages", m.engagement.chats)}
        {stat("Shortlist items", m.engagement.shortlistItems)}
        {stat("Users with a shortlist", m.engagement.usersWithShortlist)}
      </div>

      <div className="section-k" style={{ marginTop: 22 }}>HELPFULNESS & SAFETY</div>
      <div className="adm-grid">
        {stat("Helpfulness rate", m.feedback.rated ? Math.round(m.feedback.helpfulnessRate * 100) + "%" : ", ")}
        {stat("Ratings (👍 / 👎)", `${m.feedback.up} / ${m.feedback.down}`)}
        {stat("Distress flags (watched)", m.guardrail.distressFlags, m.guardrail.distressFlags > 0)}
      </div>

      <div className="section-k" style={{ marginTop: 22 }}>VOICE OF THE USER</div>
      <div className="adm-grid">
        {stat("Suggestions received", m.voice.total)}
        {stat("Open (to triage)", m.voice.open, m.voice.open > 0)}
      </div>
      {m.voice.topThemes.length > 0 && (
        <div className="adm-themes">
          {m.voice.topThemes.map((t) => (
            <span key={t.theme} className="adm-theme">{t.theme}<b>{t.count}</b></span>
          ))}
        </div>
      )}
      <FeedbackInbox onChange={load} />

      {Object.keys(m.chatsByPersona).length > 0 && (
        <>
          <div className="section-k" style={{ marginTop: 22 }}>CHATS BY PERSONA</div>
          <div className="adm-grid">{Object.entries(m.chatsByPersona).map(([k, v]) => stat(k, v, false, k))}</div>
        </>
      )}

      <div className="disclaimer-foot" style={{ marginTop: 22 }}>Live sessions (guest accounts). Generated {new Date(m.generatedAt).toLocaleString()}. Marg tags each note; a human actions anything that changes facts. Prototype login (admin/admin), not for public deploy.</div>
    </section>
  );
}

// Admin triage inbox for free-text feedback. Marg's interpretation (theme,
// severity, sentiment, a drafted suggestion) rides along; the admin sets status.
function FeedbackInbox({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const load = async () => { const r = await api.adminFeedback(filter); if (r.data) setItems(r.data.feedback); };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);
  const setStatus = async (id: string, status: string) => { await api.adminFeedbackStatus(id, status); load(); onChange(); };
  const filters = [["", "All"], ["new", "New"], ["triaged", "Triaged"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]];
  return (
    <div className="adm-inbox">
      <div className="adm-fbtabs">
        {filters.map(([v, l]) => (
          <button key={v} className={"adm-fbtab" + (filter === v ? " on" : "")} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      {items === null ? <div className="adm-l" style={{ padding: "8px 2px" }}>Loading…</div>
        : items.length === 0 ? <div className="adm-l" style={{ padding: "8px 2px" }}>No feedback in this view yet.</div>
        : items.map((it) => (
          <div key={it.id} className={"adm-fb sev-" + (it.ai_severity || "none") + " st-" + it.status}>
            <div className="adm-fb-head">
              {it.ai_theme && <span className="adm-fb-theme">{it.ai_theme}</span>}
              {it.ai_severity && <span className={"adm-fb-sev sev-" + it.ai_severity}>{it.ai_severity}</span>}
              {it.ai_sentiment && <span className="adm-fb-sent">{it.ai_sentiment}</span>}
              {it.category && <span className="adm-fb-cat">{it.category.replace(/_/g, " ")}</span>}
              <span className="adm-fb-status">{it.status}</span>
            </div>
            <div className="adm-fb-text">“{it.text}”</div>
            {it.ai_suggestion && <div className="adm-fb-sug"><b>Marg suggests (draft):</b> {it.ai_suggestion}</div>}
            <div className="adm-fb-meta">{it.persona || ", "} · {it.context || ", "} · {new Date(it.created_at).toLocaleDateString()}</div>
            <div className="adm-fb-acts">
              {it.status !== "triaged" && <button className="adm-fb-act" onClick={() => setStatus(it.id, "triaged")}>Triaged</button>}
              {it.status !== "actioned" && <button className="adm-fb-act ok" onClick={() => setStatus(it.id, "actioned")}>Actioned</button>}
              {it.status !== "dismissed" && <button className="adm-fb-act mute" onClick={() => setStatus(it.id, "dismissed")}>Dismiss</button>}
            </div>
          </div>
        ))}
    </div>
  );
}
