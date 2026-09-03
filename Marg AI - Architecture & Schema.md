# Marg AI — Architecture & Data Schema (MVP)

Context: Bangalore / CBSE, Class X → XI. Companion to the PRD, `marg-dataset-v0.json`, and the UX spec. Principle: boring, shippable, safety-first; use the simplest tier that works.

---

## 1. Architecture at a glance

```
        ┌─────────────────────────────────────────────┐
        │  Web client (responsive SPA)                 │
        │  screens per UX spec · no secrets · no LLM key│
        └───────────────┬─────────────────────────────┘
                        │ HTTPS (JSON)
        ┌───────────────▼─────────────────────────────┐
        │  Backend API (stateless app server)          │
        │  • Auth & consent (DPDP gate)                │
        │  • Intake / shortlist / plan persistence     │
        │  • Reflection endpoint (LLM proxy, grounded) │
        │  • Safety/crisis check on free text          │
        │  • Analytics ingest                          │
        └───┬───────────────┬───────────────┬──────────┘
            │               │               │
   ┌────────▼──────┐ ┌──────▼───────┐ ┌─────▼─────────────┐
   │ Relational DB │ │ Curated data │ │ Anthropic API      │
   │ (Postgres /   │ │ (seeded from │ │ (Claude, server-   │
   │  SQLite MVP)  │ │  dataset v0) │ │  side only)        │
   └───────────────┘ └──────────────┘ └───────────────────┘
```

- **The AI is a single grounded LLM call, not an agent.** Per the Claude API guidance, this task (produce a short, grounded reflection over supplied data) is the "single LLM call" tier — no tool loop, no agent. That keeps it cheap, predictable, and hard to make hallucinate.
- **No third-party ad/analytics trackers** (DPDP — no child profiling). First-party analytics only.

---

## 2. Data flow

1. **Register → consent gate.** Minor → verifiable parental consent required (self-serve or school-mediated) before any personal data is stored. Password hashed.
2. **Intake** stored (interests, strengths, values, constraints, optional marks).
3. **Mode A — Explore:** client loads the option landscape from the DB (all options, no ranking). On opening an option, the backend calls the **reflection endpoint**: input = a minimal student-intake summary + that one option's curated record; output = a *structured* reflection (band + reasoning), grounded only on the supplied record.
4. **Mode B — Aspire:** ambition → "why this goal" gate → backend fetches the matched pathway record → reflection endpoint composes the next-steps framing (grounded), plus a reconciliation note if the ambition diverges from Mode-A leanings.
5. **Convergence:** shortlist / plan saved; "what changed" history recorded on refine.
6. **Safety:** every free-text field passes a crisis check; a positive flag surfaces the helpline/hand-off and is logged.
7. **Analytics:** events emitted per §12 of the PRD.

---

## 3. LLM (reflection) subsystem

- **SDK & model:** official Anthropic SDK, server-side only. Default model `claude-opus-5`; `claude-sonnet-5` or `claude-haiku-4-5` are valid cost choices — that is the user's call, not a silent downgrade. Adaptive thinking (`thinking: {type: "adaptive"}`).
- **Grounding (anti-hallucination):** the prompt contains ONLY the relevant curated record(s). System instruction: use only the supplied data; never invent options, schemes, links, fees, or eligibility; if data is insufficient, say so rather than guess.
- **Structured output:** constrain the response with `output_config.format` to a fixed schema so it cannot free-form a verdict:
  ```json
  {
    "band": "worth_exploring | strong_fit | stretch",
    "why_this_connects": "string, plain language, tied to the student's inputs",
    "what_to_watch": "string",
    "confidence": "low | medium | high",
    "disclaimer": "AI suggestion, not a guarantee"
  }
  ```
- **Prompt caching:** cache the stable system prompt (guardrails + response contract). Put the volatile per-student summary after the cache breakpoint.
- **Cost profile:** light — one small call per option viewed / plan generated. Cache the system prefix; keep student summaries short.

⚠ FLAG (privacy): send the LLM the *minimum* student summary needed, never raw identifiers. Confirm data-processing/retention terms are acceptable for minors' data before go-live.

---

## 4. Database schema

Relational. Postgres recommended; SQLite acceptable for the MVP/demo. JSON columns used where the shape is flexible.

**users**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_handle | text unique | the userID |
| password_hash | text | bcrypt/argon2 — never plaintext |
| email | text null | optional; enables recovery |
| is_minor | bool | drives consent gate |
| account_status | text | active / holding / deleted |
| created_at | timestamptz | |

**consent**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | |
| path | text | self_serve / school_mediated |
| parental_status | text | pending / verified / not_required |
| guardian_ref | text null | contact/verification ref |
| school_code | text null | for school-mediated |
| consented_at | timestamptz null | |
| revoked_at | timestamptz null | |

**intake_responses**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | |
| interests | jsonb | |
| strengths | jsonb | self-rated, growth-framed |
| scenario_answers | jsonb | |
| values | jsonb | |
| constraints | jsonb | budget/location/family |
| marks | jsonb null | optional, low priority |
| version | int | supports "what changed" |
| created_at / updated_at | timestamptz | |

**options_catalog** (seeded from `marg-dataset-v0.json`)
| Column | Type | Notes |
|---|---|---|
| option_id | text PK | e.g. pu_science |
| name | text | |
| type | text | academic_stream / diploma / … |
| data | jsonb | full record |
| verification_status | text | unverified / verified |
| last_verified | date null | shown in UI |

**pathways_catalog** (seeded)
| Column | Type | Notes |
|---|---|---|
| pathway_id | text PK | e.g. become_doctor |
| ambition | text | |
| data | jsonb | steps, costs, routes, alternatives |
| verification_status | text | |
| last_verified | date null | |

**scholarships** (seeded)
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| name | text | |
| data | jsonb | who/amount/link |
| last_verified | date null | |

**shortlists** / **shortlist_items**
| Column | Type | Notes |
|---|---|---|
| shortlists.id | uuid PK | one per user (or per session) |
| shortlists.user_id | uuid FK→users | |
| shortlist_items.id | uuid PK | |
| shortlist_items.shortlist_id | uuid FK | |
| shortlist_items.option_id | text FK→options_catalog | |
| shortlist_items.note | text | "why I'm considering this" |
| shortlist_items.added_at | timestamptz | |

**plans** (Mode B)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | |
| pathway_id | text FK→pathways_catalog | |
| alternatives_viewed | bool | feeds Mode-B companion metric |
| created_at | timestamptz | |

**reflections** (cache of LLM output; optional but recommended)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| target_type | text | option / pathway |
| target_id | text | |
| output | jsonb | the structured band+reasoning |
| model | text | e.g. claude-opus-5 |
| created_at | timestamptz | |

**refine_history** ("what changed")
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | user_id, entity, diff jsonb, created_at |

**events** (analytics)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK null | |
| session_id | text | |
| event_name | text | intake_started, option_viewed, shortlist_saved, planb_plan_reached, roadmap_exported, session_returned, distress_flag_raised |
| properties | jsonb | few events, rich properties |
| ts | timestamptz | |

**safety_flags**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | user_id null, session_id, signal, action_taken, ts |

**Relationships / integrity**
- All personal tables FK to `users` with **ON DELETE CASCADE** (supports the DPDP delete right).
- Minor accounts cannot leave `holding` status until `consent.parental_status = verified`.

---

## 5. Analytics → North Star

- **Informed-Convergence Rate** = users with (`intake_completed` AND ≥1 `option_viewed` where `was_unconsidered=true` AND `shortlist_saved` with count in ~2–3) ÷ users with `intake_started`. Computed over a quarterly cohort from the `events` table, keyed on `user_id`.
- **Guardrail metrics** (watched): single-pick rate, browse-only/no-converge rate — both derivable from the same events.
- **Mode-B companion:** `planb_plan_reached` with `alternative_viewed=true` ÷ Mode-B starts.

---

## 6. Extensibility (the "one engine, many packs" requirement)

- **New persona** (professional, senior, counsellor): add option/pathway rows tagged by persona/context; the engine, schema, and reflection subsystem are unchanged — the persona is a *data pack*, not a code branch.
- **New context** (another board/state): another dataset pack seeded into the same catalog tables.
- The reflection prompt is persona-agnostic; only the supplied records change.

---

## 7. Deployment

- Static frontend (any static host) + a small backend service + a managed relational DB.
- Anthropic API key lives only in the backend environment. TLS everywhere.
- Curated dataset seeded into the DB at deploy; re-seed on data updates (tracks `last_verified`).
- Demo-scale is modest: one small app server + SQLite/managed Postgres is enough.

---

## 8. Open items / cannot be stubbed before real students

- Verifiable parental consent flow (DPDP).
- Crisis detection → real human hand-off with current helpline numbers.
- Data accuracy: `verification_status` must reach `verified` with a real `last_verified` date before figures are shown as fact.
- LLM guardrail testing: adversarially confirm the reflection never invents an option/scheme/link and never issues a verdict.
- Confirm data-processing/retention terms for minors' data sent to the LLM.
