import { useCallback, useEffect, useState } from "react";
import { api, getToken, clearToken, type Option, type Profile, type ShortlistItem, type Pathway, type Specialized, type PersonaPublic } from "./api";
import { HELPLINES } from "./lib";
import {
  Home, Welcome, Consent, Register, Login, Intake, Mode, Explore, Detail, SpecializedDetail, Shortlist, DeleteConfirm,
  Aspire, WhyGoal, Plan, GoalChat, PersonaPick, type Ctx,
} from "./screens";

type View = { name: string; param: string | null };

const THEMES = ["dark", "light", "contrast"] as const;
type Theme = (typeof THEMES)[number];
const THEME_LABEL: Record<Theme, string> = { dark: "Dark", light: "Light", contrast: "Contrast" };
const SCALES = [0.9, 1, 1.15, 1.3, 1.5]; // text-size steps (zoom on the content)

const MoonIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6 6 0 0 0 10.5 10.5z" /></svg>);
const SunIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.3" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5" /></svg>);
const ContrastIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></svg>);

export default function App() {
  const [view, setView] = useState<View>({ name: "home", param: null });
  const [options, setOptions] = useState<Option[]>([]);
  const [profile, setProfile] = useState<Profile>({ interests: [], values: [], marks: null });
  const [consent, setConsent] = useState<{ path: string; school_code?: string }>({ path: "self_serve" });
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [scholarshipNames, setScholarshipNames] = useState<Record<string, string>>({});
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [specialized, setSpecialized] = useState<Specialized[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>("");
  const [personas, setPersonas] = useState<PersonaPublic[]>([]);
  const [persona, setPersonaState] = useState<PersonaPublic | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [safety, setSafety] = useState<{ open: boolean; distress: boolean }>({ open: false, distress: false });
  const [booted, setBooted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("dark"); // dark is the default
  const [fontStep, setFontStep] = useState(1);            // index into SCALES (1 = 1.0×)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("marg_theme", t); } catch { /* private mode */ }
  }, []);
  const cycleFont = useCallback(() => setFontStep((s) => {
    const n = (s + 1) % SCALES.length; // one button: step up, wrap to smallest
    try { localStorage.setItem("marg_fontstep", String(n)); } catch { /* private mode */ }
    return n;
  }), []);
  const cycleTheme = useCallback(() => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  }, [theme, setTheme]);
  // Restore saved preferences on first load (default: dark, 1.0×).
  useEffect(() => {
    try {
      const t = localStorage.getItem("marg_theme");
      if (t && (THEMES as readonly string[]).includes(t)) { setThemeState(t as Theme); document.documentElement.setAttribute("data-theme", t); }
      const f = parseInt(localStorage.getItem("marg_fontstep") || "", 10);
      if (!Number.isNaN(f) && f >= 0 && f < SCALES.length) setFontStep(f);
    } catch { /* private mode — keep defaults */ }
  }, []);

  const go = useCallback((name: string, param: string | null = null) => { setView({ name, param }); window.scrollTo(0, 0); }, []);
  const toast = useCallback((m: string) => setToastMsg(m), []);
  const openSafety = useCallback((d = false) => setSafety({ open: true, distress: d }), []);

  // Load a persona's data pack (options/pathways/specialized/scholarships).
  const loadPacks = useCallback(async (personaId: string) => {
    const opt = await api.getOptions(personaId);
    setOptions(opt.data?.options ?? []);
    setScholarshipNames(Object.fromEntries((opt.data?.scholarships ?? []).map((s) => [s.id, s.name])));
    setPathways(opt.data?.pathways ?? []);
    setSpecialized(opt.data?.specialized ?? []);
    setDisclaimer(opt.data?.disclaimer ?? "");
  }, []);

  const setPersona = useCallback(async (p: PersonaPublic) => {
    setPersonaState(p);
    try { localStorage.setItem("marg_persona", p.id); } catch { /* private mode */ }
    await loadPacks(p.id);
  }, [loadPacks]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* best-effort; clear locally regardless */ }
    clearToken();
    try { localStorage.removeItem("marg_persona"); } catch { /* private mode */ }
    setProfile({ interests: [], values: [], marks: null });
    setShortlist([]);
    go("home");
  }, [go]);

  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 1900); return () => clearTimeout(t); }, [toastMsg]);

  useEffect(() => {
    (async () => {
      const pr = await api.getPersonas();
      const list = pr.data?.personas ?? [];
      setPersonas(list);
      // Restore the last-chosen persona (so a returning user keeps their stage);
      // fall back to Class-10 as the default.
      let chosen = list.find((p) => p.id === "class10") ?? list[0] ?? null;
      try { const sp = localStorage.getItem("marg_persona"); const f = sp && list.find((p) => p.id === sp); if (f) chosen = f; } catch { /* private mode */ }
      if (chosen) { setPersonaState(chosen); await loadPacks(chosen.id); }
      if (getToken()) {
        const [ik, sl] = await Promise.all([api.getIntake(), api.getShortlist()]);
        if (ik.status === 401) {
          clearToken();
        } else {
          if (ik.data?.intake) {
            const it = ik.data.intake;
            setProfile({ interests: it.interests ?? [], values: it.values ?? [], marks: it.marks ?? null, mind_flagged: it.mind_flagged });
          }
          if (sl.data?.shortlist) setShortlist(sl.data.shortlist);
          setView({ name: "mode", param: null }); // returning user keeps the default persona
        }
      }
      setBooted(true);
    })();
  }, [loadPacks]);

  const ctx: Ctx = { go, param: view.param, toast, openSafety, logout, options, profile, setProfile, consent, setConsent, shortlist, setShortlist, scholarshipNames, pathways, specialized, disclaimer, personas, persona, setPersona };

  function screen() {
    switch (view.name) {
      case "home": return <Home ctx={ctx} />;
      case "personas": return <PersonaPick ctx={ctx} />;
      case "welcome": return <Welcome ctx={ctx} />;
      case "consent": return <Consent ctx={ctx} />;
      case "register": return <Register ctx={ctx} />;
      case "login": return <Login ctx={ctx} />;
      case "intake": return <Intake ctx={ctx} />;
      case "mode": return <Mode ctx={ctx} />;
      case "explore": return <Explore ctx={ctx} />;
      case "detail": return <Detail ctx={ctx} />;
      case "specialized": return <SpecializedDetail ctx={ctx} />;
      case "shortlist": return <Shortlist ctx={ctx} />;
      case "aspire": return <Aspire ctx={ctx} />;
      case "goalchat": return <GoalChat ctx={ctx} />;
      case "why": return <WhyGoal ctx={ctx} />;
      case "plan": return <Plan ctx={ctx} />;
      case "delete-confirm": return <DeleteConfirm ctx={ctx} />;
      default: return <Home ctx={ctx} />;
    }
  }

  const showRibbon = booted && persona?.experimental && view.name !== "personas";

  return (
    <div className="frame">
      <div className="a11y">
        <button className="a11y-btn wide" onClick={cycleFont} title="Text size — tap to change" aria-label={`Text size ${Math.round(SCALES[fontStep] * 100)} percent, tap to change`}>
          <span className="ab-a">A</span><span className="ab-v">{Math.round(SCALES[fontStep] * 100)}%</span>
        </button>
        <button className="a11y-btn wide" onClick={cycleTheme} title="Contrast — tap to change" aria-label={`Contrast: ${THEME_LABEL[theme]}, tap to change`}>
          {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <ContrastIcon />}
          <span className="ab-v">{THEME_LABEL[theme]}</span>
        </button>
      </div>
      {showRibbon && (
        <div className="exp-ribbon">⚗ Experimental persona ({persona!.label}) — illustrative &amp; unverified. Class 10 stays the safe default.</div>
      )}
      <main style={{ zoom: SCALES[fontStep] }}>
        {booted ? screen() : (
          <section className="screen"><div className="spacer" /><div className="center-note">Loading…</div><div className="spacer" /></section>
        )}
      </main>
      {toastMsg && <div className="toast">{toastMsg}</div>}
      {safety.open && (
        <Safety
          distress={safety.distress}
          onClose={() => setSafety({ open: false, distress: false })}
          onContinue={() => { setSafety({ open: false, distress: false }); go("mode"); }}
        />
      )}
    </div>
  );
}

function Safety({ distress, onClose, onContinue }: { distress: boolean; onClose: () => void; onContinue: () => void }) {
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-h">You matter. Talk to someone.</div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>
          {distress
            ? "It sounds like things feel heavy right now. You don't have to carry this alone — these people are here to listen, free and confidential."
            : "If you're feeling low, anxious or unsafe, please reach out. Free and confidential."}
        </p>
        {HELPLINES.map((h) => (
          <a key={h.tel} className="tel" href={"tel:" + h.tel}><span>{h.name}</span><b>{h.num}</b></a>
        ))}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>In immediate danger, call 112.</p>
        <div className="stack" style={{ marginTop: 14 }}>
          {distress && <button className="btn btn-primary" onClick={onContinue}>I'm okay — continue</button>}
          <button className="btn btn-soft" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
