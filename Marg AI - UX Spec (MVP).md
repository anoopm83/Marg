# Marg AI — MVP UX Spec (Build Blueprint)

Context: Bangalore / CBSE, Class X → XI. Two modes (A: Explore, full; B: Aspire/Plan, thin preview). Consumes `marg-dataset-v0.json`. Fires events per PRD §12. This is the screen-level blueprint for the build; it expands PRD §11.

---

## 1. Design principles (non-negotiable, applied on every screen)

- **Never a verdict.** The UI presents options and light suggestions, never a single "correct" answer. No screen ends on one ranked winner.
- **Anti-anchoring.** Real information and reasoning appear *before* any AI fit-signal. A stretch/expansion option is surfaced *before* the "resonant" one. All options stay equally navigable.
- **Information-first.** The rich, real per-option data is the hero; the AI band is a small, disclaimered overlay.
- **Non-judgment & privacy.** Calm, pressure-free tone. Persistent, quiet reassurance that inputs are private and not shared. No streaks, no scores, no leaderboards.
- **"Not ready" is success.** Every convergence screen offers an explicit, dignified "I'm not ready to choose yet — save and come back."
- **Growth-framed.** Options are rated, never the child. Language: "based on what you told me *today* — this can change."

---

## 2. Sitemap / screen inventory

```
Landing
 └─ Register + Consent
     └─ Intake (shared)
         └─ Mode Choice
             ├─ Mode A: Explore
             │    ├─ Option Landscape (all 7)
             │    ├─ Option Detail
             │    └─ Shortlist / Convergence
             └─ Mode B: Aspire (preview)
                  ├─ "Why this goal?" reflection  ──(can reroute)──► Mode A
                  └─ Next-Steps Plan
         └─ Roadmap / Export & Share (child-controlled)
 Global: Safety/Help overlay · Account & Privacy
```

---

## 3. End-to-end flow (happy path)

Landing → Register+Consent → Intake → Mode Choice → (A: Landscape → Detail ×N incl. 1 expansion → Shortlist) or (B: Why-this-goal → Next-Steps) → Roadmap → optional Export/Share → return later to refine.

---

## 4. Screen specs

### S1 — Landing
- **Purpose:** set expectation (a companion, not a judge) and safety/privacy up front.
- **Content:** one-line value ("See your real options after Class 10 — and decide without being boxed in"); "we don't judge, your answers stay private"; a plain "who this is for" (Bangalore, CBSE, after Class 10).
- **Interactions:** primary CTA "Start"; secondary "How this works".
- **States:** returning user → "Welcome back, continue where you left off".
- **Events:** `session_returned` (if returning).

### S2 — Register + Consent
- **Purpose:** account + DPDP-compliant consent, inclusively.
- **Content/fields:** userID + password (required); email (optional — note "add it to recover your account"). Consent path selector: **Self-serve** (parental consent flow) or **School-mediated** (school code / counsellor-assisted) — user's choice, neither forced.
- **Rules:** minor → verifiable parental consent required before any data is stored; password hashed; show what data is collected and the delete option.
- **States:** no-consent → holding mode (can browse generic option info, cannot save personal results); consent pending (school-mediated).
- **Events:** `intake_started` fires only after consent.
- **Edge case:** consent unavailable → offer school-mediated path or generic browse; never silently store minor data.

### S3 — Intake (shared by both modes)
- **Purpose:** gather light signal without a heavy test.
- **Content (short, ~5–8 min):** interests; self-rated strengths across domains (verbal/logical/creative/spatial/interpersonal…); a few scenario questions; values/motivations (money / passion / stability / impact); practical constraints (budget, location, family expectation); **optional** "import your marks" (clearly low-priority, skippable).
- **Tone:** growth-framed ("what you enjoy *now*"); never "what are you good/bad at" as fixed traits.
- **States:** thin/contradictory signal is allowed — do NOT force completion of every field.
- **Events:** `intake_completed` (props: `fields_filled`, `marks_imported`).

### S4 — Mode Choice
- **Purpose:** route to Explore or Aspire — **without privileging "I already know".**
- **Content:** two equal doors: "I'm not sure yet — help me explore" (A) and "I have a goal in mind — help me plan" (B). Neutral framing; the goal door is not visually 'the smart choice'.
- **Rule:** choosing B does not skip reflection — see S8.
- **Events:** `intake_started` prop `mode_intended` captured earlier; mode selection logged.

### S5 — Mode A: Option Landscape
- **Purpose:** show the whole field; make breadth the interface.
- **Data binding:** render all `options[]` from the dataset as equal cards (name, one-line summary, "leads to").
- **Anti-anchoring rules:** cards are ordered neutrally (e.g. by category, not by fit); **no fit-band is shown at landscape level**; an **expansion prompt** highlights ≥1 option the intake suggests the student hadn't considered ("Have you looked at…?") — surfaced before any resonant framing.
- **Interactions:** open any card → Detail. Filter by practical constraint (cost/duration) allowed; sorting by "best for me" is deliberately NOT offered.
- **Wireframe:**
```
[ Your options after Class 10 ]      (no ranking)
 Have you considered → [ Polytechnic Diploma ]   ← expansion nudge
 ┌───────────┐ ┌───────────┐ ┌───────────┐
 │ PU Science│ │ PU Commerce│ │ Humanities│
 └───────────┘ └───────────┘ └───────────┘
 ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐
 │Polytechnic│ │   ITI     │ │  NIOS     │ │Vocational│
 └───────────┘ └───────────┘ └───────────┘ └──────────┘
```
- **Events:** `option_viewed` on card open (props: `option_id`, `was_unconsidered`).

### S6 — Mode A: Option Detail
- **Purpose:** the information-first hero screen.
- **Data binding (in this order — info before signal):** summary → leads_to / keeps_open → eligibility → duration → where_in_bangalore → approx_cost → entrance_exams_it_feeds → related_scholarships → honest_notes → human_touchpoint. Show `verification.last_verified` + a "figures to be confirmed" note wherever `needs_verification`.
- **AI reflection overlay (LAST, small, disclaimered):** a qualitative band ("Worth exploring / Strong fit / A stretch — here's what it'd take") + a plain "why this connects to what you told me". Persistent disclaimer: "This is an AI suggestion, not a guarantee."
- **Anti-anchoring:** the reflection band renders only after the info is on screen/scrolled; never above the fold alone.
- **Interactions:** open a real resource/scheme link (`resource_clicked`); open human story (`human_touchpoint_opened`); "add to shortlist".
- **Events:** `option_viewed` enriched (`reasoning_viewed`, `resource_clicked`, `human_touchpoint_opened`).

### S7 — Mode A: Shortlist / Convergence
- **Purpose:** the healthy explore→narrow moment (the North Star).
- **Content:** the student's saved options (target ~2–3, kept open); a short "why I'm considering this" note per item; a "what changed" history if they refined.
- **Rules:** allow 2–3 (nudge against a single premature pick); **explicit "I'm not ready yet — save & return" is a first-class button, not a dead end.**
- **Events:** `shortlist_saved` (prop: `count`).

### S8 — Mode B: "Why this goal?" reflection (gate)
- **Purpose:** stop borrowed-ambition foreclosure before planning.
- **Content:** capture current state + ambition; then a light reflection ("what draws you to this? / have you seen what it involves?") with a soft off-ramp: "Not fully sure? Explore options first" → reroutes to S5.
- **Rule:** cannot reach the plan (S9) without passing through this.
- **Events:** ambition captured; reroute-to-explore logged.

### S9 — Mode B: Next-Steps Plan (preview)
- **Purpose:** next-horizon steps only (next 1–2 yrs), honestly.
- **Data binding:** render matched `pathways[]` item — `next_horizon_steps`, `honest_cost_effort` **always paired with** `real_routes_through_cost`, `adjacent_destinations`, `what_if_it_changes`.
- **Reconciliation-as-feature:** if the ambition's required stream diverges from the student's Mode A leanings, surface the gap honestly ("This path needs Science; you leaned toward creative subjects — here's the trade-off"), not as an error.
- **Rule:** preview scope — a few ambitions only; clearly labeled "preview", full planner later.
- **Events:** `planb_plan_reached` (props: `ambition_id`, `alternative_viewed`, `cost_shown`).

### S10 — Roadmap / Export & Share
- **Purpose:** the takeaway artifact; child-controlled sharing.
- **Content:** the saved shortlist and/or plan, exportable (PDF/link). **Family view** = the option *landscape + conversation questions*, NOT a rankable fit a parent can wield.
- **Rules:** sharing is off by default and initiated only by the student.
- **Events:** `roadmap_exported` / shared (prop: `share_target` = self/family).

### Global — Safety/Help overlay
- **Purpose:** crisis support, reachable anywhere.
- **Rule:** language suggesting distress triggers a real helpline + human hand-off. **No dead-end "get help" buttons.** Helpline numbers are real and current.
- **Events:** `distress_flag_raised`.

### Global — Account & Privacy
- View/edit consent, see stored data, **delete account/data**. Plain-language privacy summary.

---

## 5. Reusable components
OptionCard · OptionDetailPanel · AIReflectionBand (with mandatory disclaimer slot) · ExpansionNudge · ShortlistTray · StepList (Mode B) · CostWithRoutes (never show cost without routes) · VerificationStamp ("last verified / to be confirmed") · ConsentBlock · SafetyBanner · NotReadyButton.

---

## 6. Visual & tone direction
- Calm, spacious, low-pressure; generous whitespace; one cohesive palette; sans-serif.
- No gamified pressure (no streaks/scores/timers). Progress shown gently.
- Every AI element visibly labeled as AI + "not a guarantee".
- Clear "where am I / am I done" state so mode-switching never feels like an inescapable loop.

---

## 7. Six-UX-component targets (self-check at build)
| Component | Target |
|---|---|
| Usability | ≥80% complete intake → shortlist unaided |
| Efficiency | Intake in ≤8 min; reach a shortlist in one session |
| Perceived effort | Feels light — exploring is not homework |
| Credibility | Verification stamps, real links, visible AI disclaimers, privacy assurance |
| Delight | A genuinely new, fitting option surfaced (the expansion moment) |
| Simplicity | ≤ a handful of steps to a saved shortlist |

---

## 8. Build/handoff notes & open items
- Bind all copy to dataset fields; show `needs_verification` state honestly until `last_verified` is set.
- Safety (consent, crisis hand-off), data accuracy, and real human-touchpoint sourcing **cannot be stubbed** before real students.
- Analytics: implement the §12 events exactly (few events, rich properties), tied to the logged-in user, DPDP-compliant (no third-party ad trackers, no child profiling).
- Not in MVP visuals: multilingual, voice, native app, other personas/boards, full Mode B backcasting.
- Next step after this spec: low-fi wireframes → hi-fi mockups (can be produced as a visual artifact/design canvas on request).
