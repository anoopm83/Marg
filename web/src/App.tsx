import { useCallback, useEffect, useState } from "react";
import { api, getToken, clearToken, type Option, type Profile, type ShortlistItem, type Pathway, type Specialized, type PersonaPublic } from "./api";
import { HELPLINES } from "./lib";
import {
  Welcome, Consent, Register, Login, Intake, Mode, Explore, Detail, SpecializedDetail, Shortlist, DeleteConfirm,
  Aspire, WhyGoal, Plan, GoalChat, PersonaPick, type Ctx,
} from "./screens";

type View = { name: string; param: string | null };

export default function App() {
  const [view, setView] = useState<View>({ name: "personas", param: null });
  const [options, setOptions] = useState<Option[]>([]);
  const [profile, setProfile] = useState<Profile>({ interests: [], values: [], marks: null });
  const [consent, setConsent] = useState<{ path: string; school_code?: string }>({ path: "self_serve" });
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [scholarshipNames, setScholarshipNames] = useState<Record<string, string>>({});
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [specialized, setSpecialized] = useState<Specialized[]>([]);
  const [personas, setPersonas] = useState<PersonaPublic[]>([]);
  const [persona, setPersonaState] = useState<PersonaPublic | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [safety, setSafety] = useState<{ open: boolean; distress: boolean }>({ open: false, distress: false });
  const [booted, setBooted] = useState(false);

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
  }, []);

  const setPersona = useCallback(async (p: PersonaPublic) => {
    setPersonaState(p);
    await loadPacks(p.id);
  }, [loadPacks]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* best-effort; clear locally regardless */ }
    clearToken();
    setProfile({ interests: [], values: [], marks: null });
    setShortlist([]);
    go("personas");
  }, [go]);

  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 1900); return () => clearTimeout(t); }, [toastMsg]);

  useEffect(() => {
    (async () => {
      const pr = await api.getPersonas();
      const list = pr.data?.personas ?? [];
      setPersonas(list);
      const def = list.find((p) => p.id === "class10") ?? list[0] ?? null;
      // Default to Class-10 so the fallback persona is loaded even before any pick.
      if (def) { setPersonaState(def); await loadPacks(def.id); }
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

  const ctx: Ctx = { go, param: view.param, toast, openSafety, logout, options, profile, setProfile, consent, setConsent, shortlist, setShortlist, scholarshipNames, pathways, specialized, personas, persona, setPersona };

  function screen() {
    switch (view.name) {
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
      default: return <PersonaPick ctx={ctx} />;
    }
  }

  const showRibbon = booted && persona?.experimental && view.name !== "personas";

  return (
    <div className="frame">
      {showRibbon && (
        <div className="exp-ribbon">⚗ Experimental persona ({persona!.label}) — illustrative &amp; unverified. Class 10 stays the safe default.</div>
      )}
      <main>
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
