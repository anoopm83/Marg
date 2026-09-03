// Auto-generated from marg-dataset-v0.json — do not edit by hand.
window.MARG_DATA = {
  "meta": {
    "dataset": "Marg AI — Options & Pathways",
    "version": "v0-draft",
    "context": {
      "board": "CBSE",
      "region": "Bangalore, Karnataka",
      "transition": "After Class 10 (Class X to XI)"
    },
    "created": "2026-09-02",
    "disclaimer": "V0 DRAFT. Facts are sourced from public web pages and are NOT officially verified. Any field marked needs_verification=true MUST be confirmed against an official/primary source (college, DTE Karnataka, CBSE, scholarship portal) before it is shown to a real student. The app must never present an unverified figure as a guarantee, and must display a 'last verified' date per record (see verification.last_verified).",
    "verification": {
      "status": "partially_verified",
      "last_verified": "2026-09-03",
      "owner": "TBD — assign a data owner before go-live",
      "review_cadence": "TBD — recommend per academic cycle (annual), plus scholarship deadlines checked termly",
      "verified_notes": [
        "Corrected: polytechnic admission after Class 10 is via DTE Karnataka merit/counselling, NOT DCET (DCET = lateral entry to BTech).",
        "Refined govt PU fees (~₹1,500–6,500/yr) and govt polytechnic fees (~₹6,000–13,000/yr, branch-dependent).",
        "PM YASASVI pre-matric ₹4,000/yr, family income < ₹2.5 lakh (MSJE) — corroborated.",
        "STILL NEEDS OFFICIAL CONFIRMATION: exact eligibility cutoffs, current-year fees per college, live scholarship cycles/deadlines, and college lists. Sources so far are secondary; confirm against DTE Karnataka (dtek.karnataka.gov.in), PUE (pue.karnataka.gov.in), KEA (cetonline.karnataka.gov.in) and scholarships.gov.in before go-live."
      ]
    },
    "usage_notes": [
      "options[] powers Mode A (Explore): show the full set, never eliminate one, always surface at least one the student had not considered.",
      "pathways[] powers Mode B (Aspire/Plan, thin preview): next-horizon steps only, honest cost + real routes, adjacent destinations, and a 'what if this changes' fallback.",
      "AI weighting sits ON TOP of this data as a light, disclaimered overlay — it must not invent options, scholarships, or links beyond what is listed here."
    ],
    "sources": [
      "https://collegesinfo.org/blogs/pu-college-fees-bangalore",
      "https://www.iesonline.co.in/puc-college-fees-in-bangalore",
      "https://collegedunia.com/exams/karnataka-dcet",
      "https://gpt.karnataka.gov.in/31/diploma-admission-details/en",
      "https://www.shiksha.com/college/karnataka-polytechnic-college-mangalore-99275/courses/after-10th-diploma-bc",
      "https://www.collegedekho.com/articles/iti-courses-after-10th/",
      "https://www.buddy4study.com/article/scholarships-karnataka-after-10th-12th",
      "https://www.thequint.com/news/education/pm-yasasvi-scholarship-scheme-2024-eligibility-criteria-steps-to-apply",
      "https://deekshalearning.com/blog/polytechnic-iti-or-cbse-11th-12th-alternative-career-paths-after-class-10/"
    ]
  },
  "options": [
    {
      "id": "pu_science",
      "name": "Pre-University (PU) — Science",
      "type": "academic_stream",
      "combinations": [
        "PCM (Physics, Chemistry, Maths)",
        "PCB (Physics, Chemistry, Biology)",
        "PCMB (all four)"
      ],
      "summary": "Two-year pre-degree, Science stream. The widest-keeping option: engineering, medicine, research, and still allows a later pivot to commerce or arts at degree level.",
      "leads_to": [
        "Engineering",
        "Medicine & allied health",
        "Pure/applied sciences",
        "Research"
      ],
      "keeps_open": "Broadest downstream range of the academic streams.",
      "eligibility": {
        "text": "Passed CBSE Class 10. College-specific cutoffs; PCM typically expects comfort with Maths, PCB with Biology.",
        "needs_verification": true
      },
      "duration": "2 years",
      "where_in_bangalore": {
        "examples": [
          "MES PU College (Malleswaram)",
          "St Joseph's PU College",
          "BGS PU College",
          "Deeksha (coaching-integrated)"
        ],
        "note": "Illustrative, not exhaustive.",
        "needs_verification": true
      },
      "approx_cost_per_year_inr": {
        "government": "~1,500–6,500",
        "private_typical_science": "40,000–60,000",
        "coaching_integrated": "80,000–3,50,000 (residential higher)",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "NEET (medicine)",
        "JEE Main/Advanced (engineering, national)",
        "KCET (Karnataka engg/medical)",
        "COMEDK"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nmms",
        "nsp",
        "ssp_karnataka",
        "vidyadhan"
      ],
      "honest_notes": "Cost variance is huge; coaching-integrated PU can be very expensive. Science does not 'lock you in' — but a strong aversion to Maths/Science is a real signal to weigh, not ignore.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Short story from a current PU Science student or recent alum."
      }
    },
    {
      "id": "pu_commerce",
      "name": "Pre-University (PU) — Commerce",
      "type": "academic_stream",
      "combinations": [
        "Commerce with Maths",
        "Commerce without Maths (with Statistics/Economics/Business Studies etc.)"
      ],
      "summary": "Two-year pre-degree, Commerce stream. Route to finance, accountancy, business, economics and law.",
      "leads_to": [
        "Chartered Accountancy (CA)",
        "B.Com / BBA / BMS",
        "Economics",
        "Company Secretary (CS)",
        "Law (via CLAT)"
      ],
      "keeps_open": "Strong for business/finance; 'with Maths' keeps more analytics/economics doors open.",
      "eligibility": {
        "text": "Passed CBSE Class 10. 'With Maths' combinations may expect reasonable Maths marks.",
        "needs_verification": true
      },
      "duration": "2 years",
      "where_in_bangalore": {
        "examples": [
          "Jain College",
          "St Joseph's PU College",
          "MES PU College",
          "Christ PU College"
        ],
        "note": "Illustrative, not exhaustive.",
        "needs_verification": true
      },
      "approx_cost_per_year_inr": {
        "government": "~1,500–6,500",
        "private_typical_commerce": "35,000–50,000",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "CA Foundation (after 12)",
        "CLAT (law)",
        "University BBA/BMS entrances"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nmms",
        "nsp",
        "ssp_karnataka",
        "vidyadhan"
      ],
      "honest_notes": "Often wrongly seen as 'lesser' than Science; it is a strong, distinct path. Only ~14% choose it nationally (see PRD S4) — scarcity is not weakness.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from a CA aspirant or B.Com student."
      }
    },
    {
      "id": "pu_humanities",
      "name": "Pre-University (PU) — Humanities / Arts",
      "type": "academic_stream",
      "combinations": [
        "History, Economics, Political Science, Sociology, Psychology, Languages, Fine Arts (varies by college)"
      ],
      "summary": "Two-year pre-degree, Humanities stream. Route to law, civil services, design, media, psychology, social sciences and the arts.",
      "leads_to": [
        "Law (CLAT)",
        "Civil services",
        "Journalism/Media",
        "Psychology",
        "Design & Fine Arts",
        "Social work"
      ],
      "keeps_open": "Best fit for language/creative/social-science strengths; underrated for career breadth.",
      "eligibility": {
        "text": "Passed CBSE Class 10. Generally the most open on marks; subject choice varies by college.",
        "needs_verification": true
      },
      "duration": "2 years",
      "where_in_bangalore": {
        "examples": [
          "Christ PU College",
          "St Joseph's PU College",
          "Mount Carmel PU College"
        ],
        "note": "Illustrative, not exhaustive.",
        "needs_verification": true
      },
      "approx_cost_per_year_inr": {
        "government": "~1,500–6,500",
        "private_typical": "30,000–50,000",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "CLAT (law)",
        "Design entrances (NID/NIFT/UCEED-adjacent)",
        "University BA entrances"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nmms",
        "nsp",
        "ssp_karnataka",
        "vidyadhan"
      ],
      "honest_notes": "This is the option most often denied to a creative/maths-averse student under family pressure (see PRD S6 voice-of-user). Present it with genuine career routes, not as a fallback.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from a designer, lawyer, or civil-services aspirant who took Humanities."
      }
    },
    {
      "id": "polytechnic_diploma",
      "name": "Polytechnic Diploma",
      "type": "technical_diploma",
      "combinations": [
        "Mechanical",
        "Civil",
        "Electrical",
        "Electronics & Communication",
        "Computer Science",
        "Polymer Technology (varies)"
      ],
      "summary": "Three-year hands-on technical diploma via Karnataka's Department of Technical Education. Employable on completion, and offers lateral entry directly into the 2nd year of BTech.",
      "leads_to": [
        "Junior engineer / technician roles",
        "Lateral entry to BTech (saves one year)",
        "Government technical jobs"
      ],
      "keeps_open": "Strong practical + BTech bridge; good for hands-on learners who want earlier employability.",
      "eligibility": {
        "text": "Passed SSLC/Class 10 with min ~35% aggregate; Maths & Science as subjects; minimum age 15. Admission after Class 10 is via DTE Karnataka merit/counselling — NOT DCET (DCET is the later lateral-entry-to-BTech test for diploma holders).",
        "needs_verification": true
      },
      "duration": "3 years",
      "where_in_bangalore": {
        "examples": [
          "Government Polytechnics (via DTE Karnataka)",
          "S J Polytechnic",
          "various private polytechnics"
        ],
        "note": "Allotted via DTE Karnataka merit/counselling.",
        "needs_verification": true
      },
      "approx_cost_inr": {
        "government_per_year": "~6,000–13,000 (branch-dependent; highly subsidised by DTE Karnataka)",
        "sc_st": "often reduced to nil via post-matric scholarship",
        "private": "varies widely",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "Admission via DTE Karnataka merit/counselling (after Class 10)",
        "Later: DCET for lateral entry to BTech"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nsp",
        "ssp_karnataka",
        "aicte_scholarships"
      ],
      "honest_notes": "Often invisible to CBSE families who default to PU. A genuinely strong, low-cost, employable route — worth surfacing as an expansion option.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from a diploma holder who did lateral entry to BTech."
      }
    },
    {
      "id": "iti",
      "name": "ITI (Industrial Training Institute)",
      "type": "vocational_training",
      "combinations": [
        "Electrician",
        "Fitter",
        "Turner",
        "Machinist",
        "Welder",
        "COPA (computer operator)"
      ],
      "summary": "Trade-focused vocational training, roughly 6 months to 2 years. Fastest route to a skilled job; strong for government/PSU recruitment (Railways, electricity boards).",
      "leads_to": [
        "Skilled trade employment",
        "Apprenticeships",
        "Government/PSU trade jobs"
      ],
      "keeps_open": "Fastest to earning; can be combined with later diploma/further study.",
      "eligibility": {
        "text": "Passed Class 10 (regular); Karnataka ITI typically needs min ~35% in Class 10. Trade duration varies.",
        "needs_verification": true
      },
      "duration": "6 months to 2 years (Electrician/Fitter often 2 years)",
      "where_in_bangalore": {
        "examples": [
          "Government ITIs (Karnataka)",
          "private ITIs"
        ],
        "note": "Illustrative, not exhaustive.",
        "needs_verification": true
      },
      "approx_cost_inr": {
        "government": "low",
        "private": "varies",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "Admission via marks/counselling (state process)",
        "Later: apprenticeship & RRB/PSU trade recruitment"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nsp",
        "ssp_karnataka"
      ],
      "honest_notes": "Best when a student needs to start earning within 1-2 years (an economic-necessity path — pair honestly with routes, per PRD S6). Not 'lesser' — high demand for Electrician/Fitter.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from an ITI Electrician now employed / in a PSU."
      }
    },
    {
      "id": "nios",
      "name": "NIOS (National Institute of Open Schooling)",
      "type": "open_schooling",
      "combinations": [
        "Flexible subject choice; open/distance mode for 10+2"
      ],
      "summary": "Open-schooling route for 10+2 with flexible subjects and pace. Accepted for polytechnic, ITI, vocational admissions and government jobs.",
      "leads_to": [
        "10+2 equivalent",
        "Polytechnic/ITI/vocational entry",
        "Continued study at own pace"
      ],
      "keeps_open": "Flexibility for students who need a non-standard pace or path; a real safety net, not a last resort.",
      "eligibility": {
        "text": "Open eligibility; commonly used after Class 10 for flexible 10+2. Check subject and exam rules on NIOS portal.",
        "needs_verification": true
      },
      "duration": "Flexible",
      "where_in_bangalore": {
        "examples": [
          "NIOS accredited institutions (AI) in Bangalore"
        ],
        "note": "Verify accredited centres.",
        "needs_verification": true
      },
      "approx_cost_inr": {
        "note": "NIOS fees; generally low-to-moderate",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "Feeds polytechnic/ITI/vocational and general 10+2 pathways"
      ],
      "related_scholarships": [
        "nsp",
        "ssp_karnataka"
      ],
      "honest_notes": "Useful for students under stress or with atypical circumstances; frame supportively, never as failure.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from a student who used NIOS to change direction successfully."
      }
    },
    {
      "id": "vocational",
      "name": "Vocational / Skill Courses",
      "type": "vocational_training",
      "combinations": [
        "Digital skills (data, web, UI/UX, cybersecurity)",
        "Healthcare (nursing assistant, lab tech, pharmacy)",
        "Creative (graphic design, animation, fashion)"
      ],
      "summary": "Skill-oriented courses across digital, healthcare and creative fields — some available alongside or instead of a traditional stream.",
      "leads_to": [
        "Skill-based employment",
        "Further specialised study",
        "Freelance/creative careers"
      ],
      "keeps_open": "Good for a student with a clear practical/creative interest; verify recognition of the specific course.",
      "eligibility": {
        "text": "Varies by course/provider; many accept Class 10 pass.",
        "needs_verification": true
      },
      "duration": "Varies (months to 2 years)",
      "where_in_bangalore": {
        "examples": [
          "Skill India centres",
          "recognised vocational institutes"
        ],
        "note": "Verify provider recognition (this is where scams cluster).",
        "needs_verification": true
      },
      "approx_cost_inr": {
        "note": "Highly variable",
        "needs_verification": true
      },
      "entrance_exams_it_feeds": [
        "Mostly direct admission; verify credential recognition"
      ],
      "related_scholarships": [
        "pm_yasasvi",
        "nsp",
        "ssp_karnataka"
      ],
      "honest_notes": "Recognition varies wildly — flag unrecognised/for-profit courses honestly. Do not list a course whose credential value cannot be verified.",
      "human_touchpoint": {
        "status": "to_source",
        "idea": "Story from someone employed via a recognised vocational course."
      }
    }
  ],
  "pathways": [
    {
      "id": "become_doctor",
      "ambition": "Become a doctor",
      "next_horizon_steps": [
        "After Class 10: choose PU Science with Biology (PCB or PCMB).",
        "Across Class 11-12: build toward NEET (national medical entrance).",
        "Stay aware: NEET is highly competitive — plan realistically and know the alternatives below."
      ],
      "honest_cost_effort": "MBBS is ~5.5 years after Class 12, very competitive, and expensive without a government seat. Scholarships/aid exist — see routes.",
      "real_routes_through_cost": [
        "Government medical seats (lower cost)",
        "PM YASASVI / state scholarships",
        "Education loans"
      ],
      "adjacent_destinations": [
        "Nursing / allied health",
        "Pharmacy",
        "Biosciences & research",
        "Veterinary science"
      ],
      "what_if_it_changes": "PCB/PCMB still keeps pharmacy, allied health, biosciences and research open — not a dead end.",
      "needs_verification": true
    },
    {
      "id": "become_engineer",
      "ambition": "Become an engineer",
      "next_horizon_steps": [
        "After Class 10: choose PU Science with Maths (PCM or PCMB).",
        "Across Class 11-12: build toward JEE (national) and/or KCET/COMEDK (Karnataka).",
        "Alternative entry: a Polytechnic diploma also reaches BTech via lateral entry."
      ],
      "honest_cost_effort": "BE/BTech is 4 years (3 via diploma lateral entry). Cost varies by college; government/aided seats and scholarships lower it.",
      "real_routes_through_cost": [
        "KCET/COMEDK government/aided seats",
        "Polytechnic diploma (low-cost) then lateral BTech",
        "AICTE scholarships"
      ],
      "adjacent_destinations": [
        "Polytechnic diploma + industry",
        "Design (product/UX)",
        "Data/analytics",
        "Pure sciences"
      ],
      "what_if_it_changes": "PCM keeps most science and analytics paths open; a diploma is a cheaper, employable fallback that still reaches BTech.",
      "needs_verification": true
    },
    {
      "id": "become_ca_finance",
      "ambition": "Work in finance / become a Chartered Accountant",
      "next_horizon_steps": [
        "After Class 10: choose PU Commerce (with Maths keeps more open).",
        "Across Class 11-12: you can begin CA Foundation preparation after Class 12.",
        "Explore B.Com/BBA as parallel or alternative degree routes."
      ],
      "honest_cost_effort": "CA is a multi-stage, self-study-heavy qualification; low course fee but demanding and long. B.Com/BBA are 3-year degrees.",
      "real_routes_through_cost": [
        "CA has relatively low official fees",
        "State/Vidyadhan scholarships for B.Com"
      ],
      "adjacent_destinations": [
        "Company Secretary (CS)",
        "Economics",
        "Banking",
        "Business management"
      ],
      "what_if_it_changes": "Commerce keeps finance, business, economics and law (via CLAT) open.",
      "needs_verification": true
    },
    {
      "id": "become_designer_artist",
      "ambition": "Work in design / art / a creative field",
      "next_horizon_steps": [
        "After Class 10: Humanities/Arts fits best, but design is reachable from any stream.",
        "Across Class 11-12: build a portfolio; explore design entrances (NID/NIFT/UCEED-adjacent).",
        "Consider vocational creative courses (animation, graphic/fashion design) as complements."
      ],
      "honest_cost_effort": "Design degrees vary in cost; portfolio and entrance prep matter more than stream. Creative careers reward demonstrated work.",
      "real_routes_through_cost": [
        "Government design institutes (NID etc.)",
        "Scholarships for design",
        "Start with recognised vocational courses"
      ],
      "adjacent_destinations": [
        "Architecture",
        "Media & communication",
        "UX/product design",
        "Fine arts / crafts"
      ],
      "what_if_it_changes": "A creative direction is buildable from multiple streams — this is the path most wrongly closed off by pressure (see PRD S6).",
      "needs_verification": true
    },
    {
      "id": "start_earning_soon",
      "ambition": "Start earning as soon as possible with a skill",
      "next_horizon_steps": [
        "After Class 10: consider ITI (fastest) or a Polytechnic diploma (employable + BTech bridge).",
        "Choose a high-demand trade (e.g. Electrician, Fitter) or diploma branch.",
        "Look at apprenticeships and government/PSU recruitment routes."
      ],
      "honest_cost_effort": "ITI is low-cost and 6 months to 2 years; diploma is 3 years but opens BTech. Both are far cheaper than the degree-first route.",
      "real_routes_through_cost": [
        "Government ITIs/polytechnics (low fees)",
        "Apprenticeship stipends",
        "PM YASASVI / state scholarships"
      ],
      "adjacent_destinations": [
        "Polytechnic diploma then BTech",
        "Self-employment/trade business",
        "PSU technical jobs"
      ],
      "what_if_it_changes": "Skilled trades and diplomas still allow further study later — earning early does not close the door to a degree.",
      "needs_verification": true
    }
  ],
  "scholarships": [
    {
      "id": "nsp",
      "name": "National Scholarship Portal (Pre/Post-Matric)",
      "who": "Eligible categories/income groups (central schemes)",
      "amount": "Varies by scheme",
      "link": "https://scholarships.gov.in",
      "needs_verification": true
    },
    {
      "id": "pm_yasasvi",
      "name": "PM YASASVI (pre-matric, Class 9-10)",
      "who": "OBC / EBC / DNT; family income under ₹2.5 lakh/year",
      "amount": "₹4,000 per year (pre-matric)",
      "link": "https://yet.nta.ac.in",
      "needs_verification": false,
      "verified_note": "Amount and income criterion corroborated (MSJE, Sep 2026); confirm current cycle on portal."
    },
    {
      "id": "nmms",
      "name": "National Means-cum-Merit Scholarship (NMMS)",
      "who": "Means + merit, classes 9-12",
      "amount": "Varies",
      "link": "https://scholarships.gov.in",
      "needs_verification": true
    },
    {
      "id": "ssp_karnataka",
      "name": "Karnataka State Scholarship Portal (SSP)",
      "who": "SC/ST/OBC/minority students in Karnataka",
      "amount": "Varies (pre/post-matric, merit-cum-means)",
      "link": "https://ssp.postmatric.karnataka.gov.in",
      "needs_verification": true
    },
    {
      "id": "vidyadhan",
      "name": "Vidyadhan (Sarojini Damodaran Foundation)",
      "who": "Meritorious, low-income; typically ~90% in Class 10",
      "amount": "Varies",
      "link": "https://www.vidyadhan.org",
      "needs_verification": true
    },
    {
      "id": "aicte_scholarships",
      "name": "AICTE Scholarships (e.g. Pragati/Saksham)",
      "who": "Diploma/technical students (girls / differently-abled variants)",
      "amount": "Varies",
      "link": "https://www.aicte-india.org",
      "needs_verification": true
    }
  ]
};
