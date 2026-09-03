/* Marg AI — functional MVP prototype (no framework).
   Real dataset (data.js). localStorage persistence. The AI reflection is a
   TRANSPARENT LOCAL HEURISTIC standing in for the server-side Claude call
   (see Architecture doc); it is labelled as such in the UI. */
(function () {
  "use strict";
  var DATA = window.MARG_DATA || { options: [], pathways: [], scholarships: [] };
  var app = document.getElementById("app");

  /* ---------- state ---------- */
  var LS = { profile: "marg_profile", shortlist: "marg_shortlist", consent: "marg_consent", consentRec: "marg_consent_rec" };
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var profile = load(LS.profile, { interests: [], values: [], marks: null });
  var shortlist = load(LS.shortlist, []);
  var consented = load(LS.consent, false);
  var consentRec = load(LS.consentRec, null);

  var INTERESTS = ["Making & art", "Numbers", "Biology", "Building things", "Helping people", "Business"];
  var VALUES = ["A steady income", "Doing work I love", "Helping my family soon", "Making an impact"];
  // interest -> option ids it resonates with (drives the humble heuristic only)
  var FIT = {
    "Making & art": ["pu_humanities", "vocational"],
    "Numbers": ["pu_commerce", "pu_science"],
    "Biology": ["pu_science"],
    "Building things": ["polytechnic_diploma", "iti"],
    "Helping people": ["pu_science", "pu_humanities"],
    "Business": ["pu_commerce"]
  };

  /* ---------- tiny helpers ---------- */
  function opt(id) { return DATA.options.filter(function (o) { return o.id === id; })[0]; }
  function path(id) { return DATA.pathways.filter(function (p) { return p.id === id; })[0]; }
  function schName(id) { var s = DATA.scholarships.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inShortlist(id) { return shortlist.some(function (x) { return x.id === id; }); }

  function costText(o) {
    var c = o.approx_cost_per_year_inr, per = "/ year";
    if (!c) { c = o.approx_cost_inr; per = ""; }
    if (!c) return "Varies";
    var parts = [];
    Object.keys(c).forEach(function (k) {
      if (k === "needs_verification" || k === "note") return;
      parts.push(k.replace(/_/g, " ") + ": ₹" + c[k]);
    });
    if (c.note && !parts.length) parts.push(c.note);
    return parts.join(" · ") + (parts.length ? " " + per : "");
  }

  // Humble heuristic — stands in for the server-side Claude reflection call.
  function reflect(o) {
    var hits = [];
    profile.interests.forEach(function (i) { if ((FIT[i] || []).indexOf(o.id) >= 0) hits.push(i); });
    var band = hits.length >= 2 ? "Strong fit" : hits.length === 1 ? "Worth exploring" : "A stretch";
    var why;
    if (hits.length) why = "You said you enjoy <strong>" + esc(hits.join(" and ")) + "</strong>, which connects well with this path.";
    else why = "This isn't an obvious match for what you told me — which is exactly why it's worth a look, so you choose from the whole field.";
    if (profile.values.indexOf("Doing work I love") >= 0 && hits.length) why += " It also fits wanting work you love.";
    var watch = o.honest_notes ? o.honest_notes.split(".")[0] + "." : "Keep your other options open while you look.";
    return { band: band, why: why, watch: watch };
  }

  function bandInner(r) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;"><div class="k">' + I.bulb + ' A GENTLE READ FOR YOU</div><span style="font-size:12px;font-weight:700;color:var(--primary);">' + esc(r.band) + '</span></div>' +
      '<p style="font-size:14px;line-height:1.55;margin-top:11px;">' + r.why + ' <span class="muted">Worth watching: ' + esc(r.watch) + '</span></p>' +
      '<div class="disc">' + I.info + ' An AI suggestion, not a guarantee — you decide.</div>';
  }
  function online() { return /^https?:$/.test(location.protocol); }
  // Replace the local heuristic band with the real grounded Claude reflection when a backend is present.
  function hydrateBand(id) {
    var el = document.getElementById("reflect-band"); if (!el || !opt(id)) return;
    fetch("/api/reflect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { interests: profile.interests, values: profile.values }, optionId: id }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.reflection) return; // keep the local fallback already shown
        var rf = d.reflection;
        el.innerHTML = bandInner({ band: rf.band, why: esc(rf.why_this_connects), watch: rf.what_to_watch });
      })
      .catch(function () {});
  }

  function planAiInner(x) {
    return '<div style="display:inline-flex;gap:7px;align-items:center;font-size:11.5px;font-weight:700;color:var(--violet);letter-spacing:.3px;">' + I.star + ' A GENTLE READ FOR YOU</div>' +
      '<p style="font-size:14px;line-height:1.55;margin-top:10px;">' + x.opening + '</p>' +
      (x.reconciliation ? '<p style="font-size:13.5px;line-height:1.55;margin-top:8px;">' + x.reconciliation + '</p>' : '') +
      (x.watch ? '<div class="muted" style="font-size:12.5px;margin-top:8px;">Worth watching: ' + esc(x.watch) + '</div>' : '') +
      '<div class="disc" style="margin-top:10px;">' + I.info + ' An AI suggestion, not a guarantee — you decide.</div>';
  }
  function planHeuristic(p) {
    var creative = profile.interests.indexOf("Making & art") >= 0;
    var sciencey = /science|doctor|engineer/i.test(p.ambition + " " + (p.next_horizon_steps || []).join(" "));
    return {
      opening: "This is one way toward " + esc(p.ambition.toLowerCase().replace(/^become /, "")) + ", and it can change as you do.",
      reconciliation: (creative && sciencey) ? "Earlier you leaned toward <strong>creative subjects</strong>, and this path leans Science — worth sitting with that trade-off, and the adjacent paths below stay open to you." : "Keep the adjacent paths below in view too — choosing this now doesn't close the others.",
      watch: p.honest_cost_effort ? p.honest_cost_effort.split(".")[0] + "." : ""
    };
  }
  function hydratePlan(id) {
    var el = document.getElementById("plan-ai"); if (!el || !path(id)) return;
    fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { interests: profile.interests, values: profile.values }, pathwayId: id }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!d || !d.plan) return; var pl = d.plan; el.innerHTML = planAiInner({ opening: esc(pl.opening), reconciliation: esc(pl.reconciliation), watch: pl.watch }); })
      .catch(function () {});
  }

  function expansionId() {
    // surface a legit option the student's stated interests did NOT point to
    var pointed = {};
    profile.interests.forEach(function (i) { (FIT[i] || []).forEach(function (id) { pointed[id] = 1; }); });
    var prefer = ["polytechnic_diploma", "nios", "iti", "vocational", "pu_humanities"];
    for (var i = 0; i < prefer.length; i++) if (!pointed[prefer[i]]) return prefer[i];
    return "polytechnic_diploma";
  }

  /* ---------- icons ---------- */
  var I = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    compass: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c4-1 5-8 8-9s5 2 8-3"/><circle cx="4" cy="20" r="1.4" fill="#0E7C7B"/><circle cx="20" cy="8" r="1.4" fill="#0E7C7B"/></svg>',
    lock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
    target: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6D5AC0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D5AC0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D5AC0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    rupee: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    sch: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 5 5.6.5-4.2 3.8 1.3 5.7L12 14l-5.1 3 1.3-5.7L4 7.5 9.6 7z"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    bulb: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a5 5 0 0 1 5 5c0 2-1.5 3-2 4H9c-.5-1-2-2-2-4a5 5 0 0 1 5-5zM9 18h6M10 21h4"/></svg>',
    info: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
    warn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B4692B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    refresh: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E7A82" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    bookmark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#0E7C7B" stroke="#0E7C7B" stroke-width="1"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>'
  };

  /* ---------- navigation ---------- */
  var view = { name: consented ? "intake" : "welcome", param: null };
  function go(name, param) { view = { name: name, param: param || null }; render(); window.scrollTo(0, 0); }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800);
  }

  /* ---------- screens ---------- */
  function scrWelcome() {
    return '<section class="screen">' +
      '<div class="wordmark">' + I.compass + '<span>Marg</span></div>' +
      '<div class="spacer"></div>' +
      '<div class="stack" style="gap:16px;">' +
        '<div class="eyebrow">For Class 10 · CBSE · Bengaluru</div>' +
        '<h1 style="font-size:32px;">See all your paths after Class 10 — then choose, without being boxed in.</h1>' +
        '<p class="lead">A calm way to explore your real options and plan your next steps. No pressure, no verdicts.</p>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<div class="stack">' +
        '<div class="card" style="padding:15px;"><div style="display:flex;gap:10px;align-items:flex-start;">' + I.lock +
          '<div style="font-size:13px;line-height:1.5;color:var(--muted);"><strong style="color:var(--ink)">Private & judgment-free.</strong> Your answers stay on this device in this demo. In the real product, a parent/guardian consents first (DPDP) and you can delete everything anytime.</div></div></div>' +
        '<button class="btn btn-primary" data-go="consent">Start</button>' +
      '</div>' +
    '</section>';
  }

  function scrIntake() {
    function chips(list, sel, kind) {
      return list.map(function (x) {
        return '<button class="chip ' + (sel.indexOf(x) >= 0 ? "on" : "") + '" data-toggle="' + kind + '" data-val="' + esc(x) + '">' + esc(x) + '</button>';
      }).join("");
    }
    var pct = Math.min(100, 30 + profile.interests.length * 12 + profile.values.length * 12);
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="welcome">' + I.back + '</button><div class="bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<h1 style="font-size:25px;">A few things about you</h1>' +
      '<p class="lead" style="margin-top:8px;">There are no right answers, and this isn\'t a test. It just helps me show you the right options. Skip anything you like.</p>' +
      '<div class="stack" style="margin-top:20px;">' +
        '<div class="card"><div style="font-weight:700;font-size:15px;margin-bottom:12px;">What do you enjoy right now?</div><div class="chips">' + chips(INTERESTS, profile.interests, "interests") + '</div><div class="muted" style="font-size:12.5px;margin-top:12px;">These can change over time — that\'s normal.</div></div>' +
        '<div class="card"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">What matters most to you?</div><div class="muted" style="font-size:13px;margin-bottom:12px;">Pick what feels true today.</div><div class="chips">' + chips(VALUES, profile.values, "values") + '</div></div>' +
        '<div class="card" style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;font-size:15px;">Add your marks?</div><div class="muted" style="font-size:12.5px;margin-top:2px;">Optional — we don\'t lead with these.</div></div><button class="chip ' + (profile.marks === "skipped" ? "on" : "") + '" data-marks="1">' + (profile.marks === "skipped" ? "Skipped" : "Skip") + '</button></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px;"><label style="font-weight:700;font-size:15px;">Anything on your mind? <span class="muted" style="font-weight:400;">(optional)</span></label><textarea id="mind" class="ta" placeholder="Type here if you\'d like to. It stays private."></textarea></div>' +
      '<div class="spacer" style="min-height:14px;"></div>' +
      '<button class="btn btn-primary" data-continue-intake="1">Continue</button>' +
      '<button class="help-link" data-safety="1" style="margin-top:12px;">Feeling low or unsafe? Talk to someone now</button>' +
    '</section>';
  }

  function scrMode() {
    return '<section class="screen">' +
      '<div class="wordmark" style="font-size:18px;margin-bottom:24px;">Marg</div>' +
      '<h1 style="font-size:27px;">How can I help today?</h1>' +
      '<p class="lead" style="margin-top:8px;">Both are fine. You can switch anytime.</p>' +
      '<div class="stack" style="margin-top:24px;gap:16px;">' +
        '<button class="choice" data-go="explore"><div class="ic" style="background:var(--primary-tint);">' + I.search + '</div>' +
          '<div style="font-family:Spectral,Georgia,serif;font-weight:600;font-size:19px;">I\'m not sure yet</div>' +
          '<div class="muted" style="font-size:14.5px;line-height:1.5;">Help me explore all my options and see what fits.</div></button>' +
        '<button class="choice" data-go="aspire"><div class="ic" style="background:var(--violet-tint);">' + I.target + '</div>' +
          '<div style="font-family:Spectral,Georgia,serif;font-weight:600;font-size:19px;">I have a goal in mind</div>' +
          '<div class="muted" style="font-size:14.5px;line-height:1.5;">Help me plan the next steps toward it.</div>' +
          '<div style="margin-top:4px;color:var(--violet);font-size:12.5px;font-weight:600;">We\'ll take a quick look at it together first — no goal is set in stone.</div></button>' +
      '</div>' +
      footerLinks() +
    '</section>';
  }

  function optIcon(o, alt) {
    var g = alt ? "#8a6d3b" : "#0E7C7B";
    var d = { pu_science: '<path d="M5 4h14v16l-7-3-7 3z"/>', pu_commerce: '<path d="M4 19V5m0 14h16M8 15l3-4 3 2 4-6"/>', pu_humanities: '<path d="M12 3l4 4-9 9-4 1 1-4z"/><path d="M14 5l3 3"/>', polytechnic_diploma: '<path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5"/>', iti: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4 12H1M23 12h-3"/>', nios: '<path d="M4 6h16M4 12h16M4 18h10"/>', vocational: '<path d="M12 2l3 6 6 .5-4.5 4 1.5 6-6-3.5-6 3.5 1.5-6L3 8.5 9 8z"/>' }[o.id] || '<circle cx="12" cy="12" r="8"/>';
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + g + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }

  function scrExplore() {
    var exId = expansionId(), ex = opt(exId);
    var academic = { pu_science: 1, pu_commerce: 1, pu_humanities: 1 };
    var cards = DATA.options.map(function (o) {
      var alt = !academic[o.id];
      return '<button class="opt ' + (alt ? "alt" : "") + '" data-detail="' + o.id + '"><div class="dot">' + optIcon(o, alt) + '</div><h3>' + esc(o.name.replace("Pre-University (PU) — ", "PU — ").replace("Pre-University (PU) — ", "")) + '</h3><div class="sub">' + esc((o.leads_to || []).slice(0, 3).join(", ")) + '</div></button>';
    }).join("");
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="mode">' + I.back + '</button><div class="wordmark" style="font-size:17px;">Your options</div></div>' +
      '<h1 style="font-size:24px;">Everything open to you after Class 10</h1>' +
      '<p class="lead" style="margin-top:6px;">Nothing here is ranked. Look around freely.</p>' +
      (ex ? '<div class="nudge" data-detail="' + exId + '" style="margin-top:16px;"><div class="dot" style="background:#fff;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;">' + I.star + '</div><div style="flex:1;"><div class="k">HAVE YOU CONSIDERED</div><div style="font-weight:600;font-size:15px;">' + esc(ex.name) + '</div></div>' + I.chev + '</div>' : '') +
      '<div class="grid" style="margin-top:14px;">' + cards + '</div>' +
      '<button class="btn btn-ghost" style="margin-top:16px;" data-go="shortlist">View my shortlist (' + shortlist.length + ')</button>' +
    '</section>';
  }

  function scrDetail(id) {
    var o = opt(id); if (!o) return scrExplore();
    var r = reflect(o);
    var where = (o.where_in_bangalore && o.where_in_bangalore.examples) ? o.where_in_bangalore.examples.slice(0, 3).join(", ") : "Various colleges";
    var exams = (o.entrance_exams_it_feeds || []).join(", ");
    var schs = (o.related_scholarships || []).map(schName).join(", ");
    var combos = (o.combinations || []).slice(0, 4).map(function (c) { return '<span class="pill">' + esc(c.split(" (")[0]) + '</span>'; }).join(" ");
    function row(icon, lab, val) { return '<div class="row">' + icon + '<div><div class="lab">' + lab + '</div><div class="val">' + esc(val) + '</div></div></div>'; }
    var saved = inShortlist(id);
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="explore">' + I.back + '</button><span class="muted" style="font-size:14px;">Back to options</span></div>' +
      '<h1 style="font-size:26px;">' + esc(o.name) + '</h1>' +
      (combos ? '<div class="chips" style="margin-top:9px;">' + combos + '</div>' : '') +
      '<p style="font-size:15px;line-height:1.55;margin-top:10px;">' + esc(o.summary) + '</p>' +
      '<div class="card" style="margin-top:18px;padding-top:2px;padding-bottom:2px;">' +
        row(I.check, "Eligibility", o.eligibility ? o.eligibility.text : "See college") +
        row(I.clock, "Duration", o.duration || "Varies") +
        row(I.pin, "In Bengaluru", where) +
        row(I.rupee, "Approx. cost", costText(o)) +
        (exams ? row(I.list, "Exams / entry", exams) : "") +
        (schs ? row(I.sch, "Scholarships", schs) : "") +
      '</div>' +
      '<div class="verify">' + I.refresh + 'Figures shown are being verified — confirm before you rely on them.</div>' +
      (o.human_touchpoint ? '<div class="touch" data-touch="1">' + I.user + '<span style="flex:1;">Hear from someone who took this path</span>' + I.chev + '</div>' : '') +
      '<div class="band" id="reflect-band">' + bandInner(r) + '</div>' +
      '<div class="spacer" style="min-height:16px;"></div>' +
      '<button class="btn ' + (saved ? "btn-soft" : "btn-primary") + '" data-save="' + id + '">' + (saved ? "✓ In your shortlist" : I.plus + " Add to my shortlist") + '</button>' +
    '</section>';
  }

  function scrShortlist() {
    var body;
    if (!shortlist.length) {
      body = '<div class="card" style="text-align:center;color:var(--muted);padding:34px 18px;">Nothing saved yet. Explore your options and keep 2–3 that interest you.</div>';
    } else {
      body = '<div class="stack">' + shortlist.map(function (s) {
        var o = opt(s.id); if (!o) return "";
        return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><div style="font-family:Spectral,Georgia,serif;font-weight:600;font-size:18px;">' + esc(o.name) + '</div><button class="back" data-remove="' + s.id + '" title="Remove">' + I.bookmark + '</button></div>' +
          '<div class="note" style="margin-top:10px;">' + esc(o.leads_to ? "Leads to: " + o.leads_to.slice(0, 3).join(", ") : "") + '</div></div>';
      }).join("") + '</div>';
    }
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="explore">' + I.back + '</button><div class="wordmark" style="font-size:17px;">Your shortlist</div></div>' +
      '<p class="lead">Keep two or three open. There\'s no rush, and you can change your mind anytime.</p>' +
      '<div style="margin-top:16px;">' + body + '</div>' +
      '<div class="spacer" style="min-height:16px;"></div>' +
      '<div class="stack">' +
        '<button class="btn btn-ghost" data-share="1">Save &amp; share with my family</button>' +
        '<button class="btn btn-soft" data-notready="1">I\'m not ready to choose yet — save &amp; come back</button>' +
      '</div>' +
      footerLinks() +
    '</section>';
  }

  function scrAspire() {
    var cards = DATA.pathways.map(function (p) {
      return '<button class="opt" style="min-height:auto;" data-why="' + p.id + '"><div style="display:flex;gap:11px;align-items:center;"><div class="dot" style="background:var(--violet-tint);">' + I.target + '</div><div><h3>' + esc(p.ambition) + '</h3></div></div></button>';
    }).join("");
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="mode">' + I.back + '</button><div class="wordmark" style="font-size:17px;">A goal in mind</div></div>' +
      '<h1 style="font-size:24px;">Where would you like to head?</h1>' +
      '<p class="lead" style="margin-top:6px;">Pick one to start. We\'ll keep it open, not fixed.</p>' +
      '<div class="stack" style="margin-top:16px;">' + cards + '</div>' +
    '</section>';
  }

  function scrWhy(id) {
    var p = path(id); if (!p) return scrAspire();
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="aspire">' + I.back + '</button><span class="muted" style="font-size:14px;">One quick reflection</span></div>' +
      '<div class="spacer"></div>' +
      '<div class="ic" style="background:var(--violet-tint);width:52px;height:52px;">' + I.target + '</div>' +
      '<h1 style="font-size:26px;margin-top:16px;">Why ' + esc(p.ambition.toLowerCase().replace("become ", "").replace("work in ", "")) + '?</h1>' +
      '<p class="lead" style="margin-top:10px;">Before we plan, it helps to know what draws you. Goals often shift as you learn more — and that\'s completely fine.</p>' +
      '<div class="spacer"></div>' +
      '<div class="stack">' +
        '<button class="btn btn-primary" data-plan="' + id + '">I\'ve thought about it — show me the path</button>' +
        '<button class="btn btn-ghost" data-go="explore">Actually, let me explore my options first</button>' +
      '</div>' +
    '</section>';
  }

  function scrPlan(id) {
    var p = path(id); if (!p) return scrAspire();
    var steps = (p.next_horizon_steps || []).map(function (s, i, arr) {
      var last = i === arr.length - 1;
      return '<div class="step"><div style="display:flex;flex-direction:column;align-items:center;align-self:stretch;"><div class="num">' + (i + 1) + '</div>' + (last ? "" : '<div class="stem"></div>') + '</div><div style="padding-bottom:' + (last ? 0 : 16) + 'px;"><div style="font-size:14.5px;line-height:1.5;">' + esc(s) + '</div></div></div>';
    }).join("");
    var routes = (p.real_routes_through_cost || []).map(function (r) { return '<span class="chip" style="cursor:default;">' + esc(r) + '</span>'; }).join("");
    var adj = (p.adjacent_destinations || []).map(function (a) { return '<span class="chip" style="cursor:default;">' + esc(a) + '</span>'; }).join("");
    // reconciliation: if student leans creative/arts but this path is science-shaped
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-why="' + id + '">' + I.back + '</button><span style="font-size:12px;font-weight:700;color:var(--violet);background:var(--violet-tint);padding:4px 9px;border-radius:999px;">PREVIEW</span></div>' +
      '<h1 style="font-size:25px;">' + esc(p.ambition) + ' — a possible path</h1>' +
      '<p class="lead" style="margin-top:8px;">This is one way there, and it can change as you do.</p>' +
      '<div class="section-k" style="margin-top:20px;">YOUR NEXT 1–2 YEARS</div>' +
      '<div style="margin-top:12px;">' + steps + '</div>' +
      '<div class="card band-amber" style="margin-top:18px;border-radius:14px;"><div style="display:inline-flex;gap:7px;align-items:center;font-size:11.5px;font-weight:700;color:var(--amber);letter-spacing:.3px;">' + I.warn + ' HONEST ABOUT WHAT IT TAKES</div>' +
        '<p style="font-size:14px;line-height:1.55;margin-top:10px;">' + esc(p.honest_cost_effort || "") + '</p>' +
        (routes ? '<div style="margin-top:8px;font-size:12.5px;color:var(--muted);margin-bottom:6px;">Real routes through it:</div><div class="chips">' + routes + '</div>' : '') + '</div>' +
      (adj ? '<div class="section-k" style="margin-top:18px;">IF THIS CHANGES, YOU\'RE NOT STUCK</div><div class="chips" style="margin-top:10px;">' + adj + '</div>' : '') +
      '<div class="card" id="plan-ai" style="margin-top:16px;background:var(--violet-tint);border-color:var(--violet-bd);">' + planAiInner(planHeuristic(p)) + '</div>' +
      '<div class="disclaimer-foot">' + esc(p.what_if_it_changes || "") + '<br>A preview — full step-by-step planning comes later. AI-assisted, not a guarantee.</div>' +
    '</section>';
  }

  /* ---------- consent + safety ---------- */
  var HELPLINES = [
    { name: "Tele-MANAS (mental health)", num: "14416", tel: "14416" },
    { name: "KIRAN helpline", num: "1800-599-0019", tel: "18005990019" },
    { name: "Childline (for under-18s)", num: "1098", tel: "1098" }
  ];
  function closeSafety() { var o = document.getElementById("safety"); if (o) o.remove(); }
  function openSafety(fromDistress) {
    closeSafety();
    var lines = HELPLINES.map(function (h) { return '<a class="tel" href="tel:' + h.tel + '"><span>' + esc(h.name) + '</span><b>' + esc(h.num) + '</b></a>'; }).join("");
    var o = document.createElement("div"); o.className = "overlay"; o.id = "safety";
    o.innerHTML = '<div class="sheet">' +
      '<div class="sheet-h">You matter. Talk to someone.</div>' +
      (fromDistress
        ? '<p class="muted" style="font-size:14px;line-height:1.55;margin-top:8px;">It sounds like things feel heavy right now. You don\'t have to carry this alone — these people are here to listen, free and confidential.</p>'
        : '<p class="muted" style="font-size:14px;line-height:1.55;margin-top:8px;">If you\'re feeling low, anxious or unsafe, please reach out. Free and confidential.</p>') +
      lines +
      '<p class="muted" style="font-size:12px;margin-top:12px;">In immediate danger, call 112.</p>' +
      '<div class="stack" style="margin-top:14px;">' +
        (fromDistress ? '<button class="btn btn-primary" data-safety-continue="1">I\'m okay — continue</button>' : '') +
        '<button class="btn btn-soft" data-close-safety="1">Close</button>' +
      '</div></div>';
    document.body.appendChild(o);
    o.addEventListener("click", function (e) { if (e.target === o) closeSafety(); });
    var c = o.querySelector("[data-close-safety]"); if (c) c.addEventListener("click", closeSafety);
    var k = o.querySelector("[data-safety-continue]"); if (k) k.addEventListener("click", function () { closeSafety(); go("mode"); });
  }
  function checkDistress(t) {
    if (!t) return false;
    return /(kill myself|suicid|end my life|end it all|don'?t want to live|want to die|hurt myself|self ?-?harm|hopeless|worthless|no point in|can'?t go on|cutting myself)/i.test(t);
  }
  function deleteData() {
    [LS.profile, LS.shortlist, LS.consent, LS.consentRec].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    profile = { interests: [], values: [], marks: null }; shortlist = []; consented = false; consentRec = null;
    toast("Your data has been deleted."); go("welcome");
  }
  function recordConsent(pathType) {
    var code = null;
    if (pathType === "school_mediated") { var el = document.getElementById("school-code"); code = el ? el.value : ""; }
    consentRec = { path: pathType, guardian: true, school_code: code, at: Date.now() };
    consented = true; save(LS.consentRec, consentRec); save(LS.consent, true); go("intake");
  }
  function consentBullet(icon, txt) { return '<div style="display:flex;gap:10px;align-items:flex-start;">' + icon + '<div style="font-size:13.5px;line-height:1.5;">' + txt + '</div></div>'; }
  function footerLinks() { return '<div class="footlinks"><button class="help-link" data-safety="1">Get help</button><span>·</span><button class="help-link" data-delete="1">Delete my data</button></div>'; }

  function scrConsent() {
    var school = view.param === "school";
    return '<section class="screen">' +
      '<div class="topbar"><button class="back" data-go="welcome">' + I.back + '</button><span class="muted" style="font-size:14px;">Setting up safely</span></div>' +
      '<div class="eyebrow">A quick consent step</div>' +
      '<h1 style="font-size:26px;margin-top:12px;">Let\'s set this up safely</h1>' +
      '<p class="lead" style="margin-top:10px;">You\'re a student, so we need a parent or guardian\'s okay before we keep any of your answers. India\'s data-protection rules (DPDP) require this — and it protects you.</p>' +
      '<div class="card" style="margin-top:18px;"><div style="display:flex;flex-direction:column;gap:12px;">' +
        consentBullet(I.check, "We keep only what helps show your options.") +
        consentBullet(I.lock, "Your answers are private — never sold or shared.") +
        consentBullet(I.refresh, "You can delete everything, anytime.") +
      '</div></div>' +
      (school
        ? '<div class="card" style="margin-top:16px;"><label style="font-weight:700;font-size:14px;">Your school\'s code</label><input id="school-code" class="ta" placeholder="e.g. BLR-CBSE-2026"><button class="btn btn-primary" style="margin-top:12px;" data-consent-path="school_mediated">Continue with school</button></div>'
        : '<div class="stack" style="margin-top:18px;">' +
            '<button class="btn btn-primary" data-consent-path="self_serve">My parent/guardian is here — they consent</button>' +
            '<button class="btn btn-ghost" data-consent-school="1">Use my school\'s code instead</button>' +
          '</div>') +
      '<button class="help-link" data-safety="1" style="margin-top:16px;">Feeling low or unsafe? Talk to someone now</button>' +
    '</section>';
  }

  /* ---------- render + events ---------- */
  function render() {
    var n = view.name, html;
    if (n === "welcome") html = scrWelcome();
    else if (n === "consent") html = scrConsent();
    else if (n === "intake") html = scrIntake();
    else if (n === "mode") html = scrMode();
    else if (n === "explore") html = scrExplore();
    else if (n === "detail") html = scrDetail(view.param);
    else if (n === "shortlist") html = scrShortlist();
    else if (n === "aspire") html = scrAspire();
    else if (n === "why") html = scrWhy(view.param);
    else if (n === "plan") html = scrPlan(view.param);
    else html = scrWelcome();
    app.innerHTML = html;
    if (n === "detail" && online()) hydrateBand(view.param);
    if (n === "plan" && online()) hydratePlan(view.param);
  }

  app.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-detail],[data-save],[data-remove],[data-toggle],[data-marks],[data-why],[data-plan],[data-share],[data-notready],[data-touch],[data-safety],[data-delete],[data-consent-path],[data-consent-school],[data-continue-intake]");
    if (!t) return;
    if (t.dataset.safety) return openSafety(false);
    if (t.dataset.delete) return deleteData();
    if (t.dataset.consentSchool) return go("consent", "school");
    if (t.dataset.consentPath) return recordConsent(t.dataset.consentPath);
    if (t.dataset.continueIntake) { var mm = document.getElementById("mind"); var txt = mm ? mm.value : ""; if (checkDistress(txt)) { profile.mind_flagged = true; save(LS.profile, profile); return openSafety(true); } return go("mode"); }
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.detail) return go("detail", t.dataset.detail);
    if (t.dataset.why) return go("why", t.dataset.why);
    if (t.dataset.plan) return go("plan", t.dataset.plan);
    if (t.dataset.save) {
      var id = t.dataset.save;
      if (!inShortlist(id)) { shortlist.push({ id: id, note: "" }); save(LS.shortlist, shortlist); toast("Added to your shortlist"); }
      return render();
    }
    if (t.dataset.remove) { shortlist = shortlist.filter(function (x) { return x.id !== t.dataset.remove; }); save(LS.shortlist, shortlist); return render(); }
    if (t.dataset.toggle) {
      var k = t.dataset.toggle, v = t.dataset.val, arr = profile[k];
      var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
      save(LS.profile, profile); return render();
    }
    if (t.dataset.marks) { profile.marks = profile.marks === "skipped" ? null : "skipped"; save(LS.profile, profile); return render(); }
    if (t.dataset.share) return toast("In the real product, sharing is yours to control — a family view, no rankings.");
    if (t.dataset.notready) return toast("Saved. Come back whenever you're ready — that's a fine choice.");
    if (t.dataset.touch) return toast("Coming soon: a short, real story from someone on this path.");
  });

  render();
})();
