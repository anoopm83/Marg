# Marg AI — Validation Kit (MVP)

**Purpose.** Learn — cheaply, before building more — whether the Marg AI approach actually
helps, and decide what to invest in next. This kit is what you run moderated sessions from.

**The decision this feeds.** We deliberately chose to *validate before* investing in RAG
(verified/scaled data sourcing) or hardening the product for launch. This kit ends in an
explicit **go / no-go** that says whether RAG — or a pivot — is the right next spend.

**Status of what you're testing.** The localhost MVP: two personas (Class 10 = default/ready,
Mid-career = experimental), Explore + Aspire, grounded chat, expansion tier, and a blanket
"provisional / double-check" disclaimer on all facts. Everything is honest-but-unverified —
which is exactly why we test *the approach*, not the data.

---

## 1. What we're actually testing (risks, not features)

The product rests on a few **bets**. Sessions should try to *falsify* each one.

| # | Bet (hypothesis) | It's validated if… | Red flag |
|---|---|---|---|
| H1 | Marg *reduces* decision anxiety | Users feel calmer / clearer after, say so unprompted | They feel *more* overwhelmed by choice |
| H2 | "Never a verdict, here's the whole field" is *helpful*, not evasive | Users value seeing options + owning the choice | They want/expect Marg to just tell them what to pick and feel let down |
| H3 | The expansion tier creates real "I hadn't considered that" moments | ≥1 genuine surprise-that-fits per session | Expansion options are ignored or feel irrelevant/noise |
| H4 | The chat is used and trusted | Users ask real questions; trust survives the "provisional" disclaimer | Chat ignored, or disclaimer kills trust entirely |
| H5 | Honesty about unverified data is *acceptable* | "Provisional, double-check" is fine for a starting point | Users won't act on anything unverified — data quality is the wall |
| H6 | One engine genuinely serves a second life-stage | Mid-career persona feels coherent and useful, not thin | It feels like a toy / wrong for adults |

**H5 is the one that most directly gates RAG** — see §6.

---

## 2. Method

**Moderated, think-aloud sessions. No deployment needed** — the participant drives the
localhost prototype (in person or screen-share) while you observe and probe. ~30–40 min each.

- **Sample:** 5–8 to start (toward n=8–12 total incl. the 2 already in the PRD). Aim for real
  variety, not convenience.
- **Split:** mostly Class-10 (real students + at least 2 parents, since parents co-decide);
  2–3 mid-career people to sanity-check the second persona.
- **Don't lead.** You're testing the product, not fishing for praise. Let them struggle; silence
  is data.

### Screener (who to recruit)
- **Class-10 track:** current Class 9–10 students (CBSE/Bengaluru ideal, but any is useful for
  the approach) **and** a parent of one. Include at least one student who is *unsure* and one who
  already "knows" what they'll do (tests H2/H3 differently).
- **Mid-career track:** working adults ~25–45 who have *considered* a change, growth, or switch.
- Avoid: people who already know the project, or who'll just be nice to you.

---

## 3. Session script

**0. Warm-up (3 min).** "There are no right answers, and you're not being tested — the product
is. Please think out loud: say what you expect, what confuses you, what you'd click." Get research
consent (§7).

**1. First impression (2 min).** Land them on the persona picker / welcome. *"What do you think
this is? Who's it for?"* — before they touch anything.

**2. Task A — Explore (10 min).** *"You're deciding what to do after Class 10 [or: rethinking your
career]. Use this to explore."* Let them go. Watch for:
- Do they understand there's no ranking / no verdict? How do they react to that?
- Do they open the **expansion tier**? What do they say when they do?
- Do they read the **provisional disclaimer**? Does it change how they treat the info?
- Do they shortlist? Do they reach a 2–3 shortlist (the north-star behavior)?

**3. Task B — Ask a question (5 min).** *"Ask Marg something you actually want to know."* Watch:
does the chat answer usefully? Do they trust it? Do they notice it won't invent facts / points to
official sources?

**4. Task C — Aspire (5 min).** *"Now suppose you have a goal in mind — type it in."* Watch: does
the goal-based path feel useful? Does a no-exact-match goal degrade gracefully?

**5. Debrief interview (10 min).** §4.

---

## 4. Debrief questions (post-task)

Open first, specific later. Don't ask leading questions.

1. *How do you feel now vs. when you started?* (H1)
2. *What would you do next after using this?* (real intent = the point of the product)
3. *At any point did you want it to just tell you the answer? How did that feel?* (H2)
4. *Did you see anything you hadn't considered? Did it fit you?* (H3)
5. *You saw a note that the info is provisional and should be double-checked. How did that land —
   reassuring, or off-putting? Would you still act on what you saw?* (H5 — **critical**)
6. *Would you use this again / recommend it? To whom?*
7. *What's the one thing that would make this genuinely useful to you?*
8. *(Mid-career only) Did this feel built for someone in your situation?* (H6)
9. *What did you trust least?* (surfaces whether it's the *approach* or the *data*)

---

## 5. What to capture (the instrument)

The app logs events (`api.event`) and now has an in-app **👍/👎 + note** feedback widget after
each reflection and at the shortlist. For each session record:

- **Behavioral (from events):** did intake complete? did they open ≥1 expansion option? did they
  chat? did they reach a saved 2–3 shortlist? (= the north-star signal) any `distress_flag_raised`?
- **In-app feedback:** the 👍/👎 ratings + notes at reflection and session level.
- **Observed:** where they hesitated, misread, or lit up. Verbatim quotes > your paraphrase.
- **The H1–H6 scorecard** (§1): validated / mixed / falsified, per session.

> Tip: keep a one-row-per-session sheet: {persona, reached-shortlist?, expansion-aha?, chat-used?,
> trust-in-approach 1–5, trust-in-data 1–5, would-return?, top quote, H1–H6 verdicts}.

---

## 6. Go / No-go — decides the next investment

Read the pattern across sessions, not any single one.

- **GREEN → build toward launch, and invest in RAG.** If the *approach* lands (H1–H4 mostly
  validated) **and** the main thing holding back trust/action is the **unverified data** (H5 red,
  H2 green) → data quality is the wall, so **RAG (verified sourcing) is the right next spend.**
  Pair it with hardening persona-1 (crisis + consent) before real students.

- **AMBER → fix the approach first, RAG later.** Approach is promising but confused (H2/H3 mixed).
  Iterate framing/UX and re-test a small round *before* spending on data. RAG won't fix a format
  people don't get.

- **RED → do not build RAG; reconsider the bet.** If people fundamentally want a verdict (H2
  falsified) or feel *more* overwhelmed (H1 falsified), the core premise is wrong. Better data
  doesn't save a product people don't want. Pivot the concept, don't scale the data.

- **Persona-specific:** if Class-10 is green but Mid-career (H6) is red, that's fine and expected —
  it says "harden and launch persona-1; the second persona needs its own discovery," exactly per
  the sequencing we agreed (no 2nd persona launches until persona-1 is hardened).

---

## 7. Ethics, consent & data (don't skip — minors involved)

- **Research consent.** For Class-10 students (minors), get a **parent/guardian's** consent to
  participate *and* to record. Adults consent for themselves. This is separate from the app's own
  DPDP consent screen.
- **Recording.** Only with consent; store locally; delete after analysis.
- **Safety.** These are real conversations about real futures. If genuine distress surfaces, stop
  the task and surface the in-app helplines (Tele-MANAS 14416, KIRAN 1800-599-0019, Childline
  1098). Don't role-play through it.
- **Set expectations.** Tell participants up front the data is a prototype and unverified — never
  let a session become de-facto real advice.

---

*Built to answer one question honestly: is this worth building further — and if so, is better data
(RAG) the right next step, or something else? Run it before writing more code.*
