import { useEffect, useRef, useState } from "react";
import { api, type Option, type Profile, type Reflection, type ShortlistItem, setToken } from "./api";
import { Icon, Compass, Bookmark } from "./icons";
import { INTERESTS, VALUES, localReflect, expansionId, costText, checkDistress, shortName, optIconName } from "./lib";

export interface Ctx {
  go: (name: string, param?: string | null) => void;
  param: string | null;
  toast: (m: string) => void;
  openSafety: (fromDistress?: boolean) => void;
  options: Option[];
  profile: Profile;
  setProfile: (p: Profile) => void;
  consent: { path: string; school_code?: string };
  setConsent: (c: { path: string; school_code?: string }) => void;
  shortlist: ShortlistItem[];
  setShortlist: (s: ShortlistItem[]) => void;
  scholarshipNames: Record<string, string>;
}

function FooterLinks({ ctx }: { ctx: Ctx }) {
  return (
    <div className="footlinks">
      <button className="help-link" onClick={() => ctx.openSafety(false)}>Get help</button>
      <span>·</span>
      <button className="help-link" onClick={() => ctx.go("delete-confirm")}>Delete my data</button>
    </div>
  );
}

export function Welcome({ ctx }: { ctx: Ctx }) {
  return (
    <section className="screen">
      <div className="wordmark"><Compass /><span>Marg</span></div>
      <div className="spacer" />
      <div className="stack" style={{ gap: 16 }}>
        <div className="eyebrow">For Class 10 · CBSE · Bengaluru</div>
        <h1 style={{ fontSize: 33 }}>See all your paths after Class 10 — then choose, without being boxed in.</h1>
        <p className="lead">A calm way to explore your real options and plan your next steps. No pressure, no verdicts.</p>
      </div>
      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-primary" onClick={() => ctx.go("consent")}>Start</button>
        <div className="card" style={{ padding: 15 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--muted)" }}><Icon name="lock" size={16} /></span>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
              <strong style={{ color: "var(--ink)" }}>Private &amp; judgment-free.</strong> A parent or guardian consents first (DPDP), and you can delete everything anytime.
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
    setErr(code === "handle_taken" ? "That username is taken — try another." : code === "weak_password" ? "That password is too short." : "Something went wrong. Please try again.");
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
      <div className="center-note" style={{ marginTop: 12 }}>No email needed. Nothing is shared.</div>
    </section>
  );
}

export function Intake({ ctx }: { ctx: Ctx }) {
  const [mind, setMind] = useState("");
  const [busy, setBusy] = useState(false);
  const p = ctx.profile;
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
      <h1 style={{ fontSize: 25 }}>A few things about you</h1>
      <p className="lead" style={{ marginTop: 8 }}>There are no right answers, and this isn't a test. It just helps me show you the right options. Skip anything you like.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>What do you enjoy right now?</div><div className="chips">{chips(INTERESTS, "interests")}</div><div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>These can change over time — that's normal.</div></div>
        <div className="card"><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>What matters most to you?</div><div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Pick what feels true today.</div><div className="chips">{chips(VALUES, "values")}</div></div>
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
  return (
    <section className="screen">
      <div className="wordmark" style={{ fontSize: 18, marginBottom: 24 }}>Marg</div>
      <h1 style={{ fontSize: 27 }}>How can I help today?</h1>
      <p className="lead" style={{ marginTop: 8 }}>Both are fine. You can switch anytime.</p>
      <div className="stack" style={{ marginTop: 24, gap: 16 }}>
        <button className="choice" onClick={() => ctx.go("explore")}>
          <div className="ic" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}><Icon name="search" size={24} stroke={1.8} /></div>
          <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>I'm not sure yet</div>
          <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>Help me explore all my options and see what fits.</div>
        </button>
        <button className="choice" onClick={() => ctx.toast("The goal-planning mode is coming next — explore is ready now.")}>
          <div className="ic" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}><Icon name="target" size={24} stroke={1.8} /></div>
          <div style={{ fontFamily: "Spectral, Georgia, serif", fontWeight: 600, fontSize: 19 }}>I have a goal in mind</div>
          <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>Help me plan the next steps toward it. <span style={{ color: "var(--violet)", fontWeight: 600 }}>(coming soon)</span></div>
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
      <h1 style={{ fontSize: 24 }}>Everything open to you after Class 10</h1>
      <p className="lead" style={{ marginTop: 6 }}>Nothing here is ranked. Look around freely.</p>
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
      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => ctx.go("shortlist")}>View my shortlist ({ctx.shortlist.length})</button>
    </section>
  );
}

export function Detail({ ctx }: { ctx: Ctx }) {
  const o = ctx.options.find((x) => x.id === ctx.param);
  const [refl, setRefl] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!o) return;
    setRefl(localReflect(o, ctx.profile));
    setLoading(true);
    let live = true;
    api.reflect(o.id).then((res) => {
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
    const res = saved ? await api.removeShortlist(o!.id) : await api.addShortlist(o!.id);
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
      <div className="spacer" style={{ minHeight: 16 }} />
      <button className={"btn " + (saved ? "btn-soft" : "btn-primary")} onClick={toggleSave}>{saved ? "✓ In your shortlist" : <><Icon name="plus" size={18} style={{ color: "#fff" }} /> Add to my shortlist</>}</button>
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
