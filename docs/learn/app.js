/* Interactivity engine — classic script, no deps, file:// safe. */
(function () {
  "use strict";
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("multica-learn:" + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem("multica-learn:" + key, JSON.stringify(val)); } catch { /* private mode */ }
    },
  };

  /* ---------- nav: scrollspy + visited progress ---------- */
  const CHAPTERS = ["ch1","ch2","ch3","ch4","ch5","ch6","ch7","ch8"];
  const visited = new Set(store.get("visited", []));
  const navLinks = {};
  $$(".sidenav a").forEach((a) => { navLinks[a.dataset.ch] = a; });

  function paintProgress() {
    CHAPTERS.forEach((ch) => navLinks[ch].classList.toggle("visited", visited.has(ch)));
    $("#progress-pill").textContent = visited.size + " / " + CHAPTERS.length + " read";
  }
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      $$(".sidenav a").forEach((a) => a.classList.toggle("active", a.dataset.ch === id));
      if (!visited.has(id)) { visited.add(id); store.set("visited", Array.from(visited)); }
      paintProgress();
    });
  }, { rootMargin: "-35% 0px -55% 0px" });
  CHAPTERS.forEach((ch) => spy.observe(document.getElementById(ch)));
  paintProgress();

  /* ---------- ch1: kanban toggle ---------- */
  function renderKanban(mode) {
    const data = KANBAN[mode];
    $("#kanban-board").innerHTML = data.cols.map((col) =>
      '<div class="kcol"><h4>' + col.name + "</h4>" + col.cards.map((c) =>
        '<div class="kcard' + (c.working ? " working" : "") + '">' +
          '<span class="kid">' + c.id + "</span><div>" + c.title + "</div>" +
          '<div class="krow">' + (c.working ? '<span class="pulse">agent working…</span>' : "<span></span>") +
          '<span class="avatar' + (c.agent ? " agent" : "") + '">' + c.who + "</span></div></div>"
      ).join("") + "</div>"
    ).join("");
    $("#kanban-note").textContent = data.note;
  }
  $$("#kanban-widget .toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#kanban-widget .toggle-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderKanban(btn.dataset.mode);
    });
  });
  renderKanban("traditional");

  /* ---------- ch2: entity map ---------- */
  const entityCard = $("#entity-card");
  function selectEntity(key) {
    $$(".ent").forEach((g) => g.classList.toggle("selected", g.dataset.ent === key));
    $$(".edge").forEach((edge) => {
      const touches = edge.dataset.edge.split("-").includes(key);
      edge.classList.toggle("lit", touches);
      edge.classList.toggle("dim", !touches);
    });
    const e = ENTITIES[key];
    entityCard.innerHTML = "<h4>" + e.name + "</h4><p>" + e.what + '</p><p class="rel">' + e.rel + "</p>";
  }
  $$(".ent").forEach((g) => g.addEventListener("click", () => selectEntity(g.dataset.ent)));

  /* ---------- ch3: machines ---------- */
  const MACHINES = {
    frontend: "<h4>Frontends — three apps, one brain</h4><ul>" +
      "<li><code>apps/web</code> (Next.js), <code>apps/desktop</code> (Electron), <code>apps/mobile</code> (Expo).</li>" +
      "<li>Web and desktop share almost everything through three packages: <code>packages/core</code> (headless logic: API client, queries, stores), <code>packages/ui</code> (pure components), <code>packages/views</code> (business pages). Dependency direction is law: views → core + ui, and no shared package may import <code>next/*</code> or <code>react-router-dom</code>.</li>" +
      "<li>Each app wraps its root in <code>CoreProvider</code> (<code>packages/core/platform/core-provider.tsx</code>) and plugs in its own NavigationAdapter — that's the entire platform difference.</li>" +
      "<li>Mobile is deliberately looser-coupled: it imports only types and pure functions from core, because Expo pins an older React.</li></ul>",
    server: "<h4>Go Server — the coordinator</h4><ul>" +
      "<li>Chi router → handlers (<code>server/internal/handler/</code>) → services (<code>server/internal/service/</code>) → sqlc-generated queries (<code>server/pkg/db/</code>) → Postgres.</li>" +
      "<li>Multi-tenancy at every layer: membership middleware gates routes; every query filters by <code>workspace_id</code>.</li>" +
      "<li>The WS hub (<code>server/cmd/server/</code>, gorilla/websocket) broadcasts workspace-scoped events — <code>issue:updated</code>, <code>task:dispatch</code>, <code>comment:created</code> — to every connected client.</li>" +
      "<li>It never executes agent work itself. It owns truth (Postgres) and timing (the task queue); execution belongs to daemons.</li></ul>",
    daemon: "<h4>Daemon — execution on your hardware</h4><ul>" +
      "<li>One Go binary (<code>server/internal/daemon/</code>) you run with <code>multica daemon</code>. It registers runtimes (daemon × tool × workspace) and heartbeats every 15s.</li>" +
      "<li>Per-runtime pollers claim queued tasks over HTTPS (<code>daemon.go:1868</code>) — outbound only, firewall-proof.</li>" +
      "<li>For each task: bare-clone cache → fresh git worktree → inject skills/config/prompt (<code>execenv/</code>) → launch one of 12 coding tools (<code>server/pkg/agent/</code>) → stream results back.</li>" +
      "<li>Local-first by design: your repos, credentials, and toolchain never leave your machine.</li></ul>",
  };
  $$(".machine").forEach((m) => m.addEventListener("click", () => {
    $$(".machine").forEach((x) => x.classList.toggle("selected", x === m));
    $("#machine-detail").innerHTML = MACHINES[m.dataset.machine];
  }));

  /* ---------- ch4: sequence stepper ---------- */
  const laneCenter = (i) => 12.5 + 25 * i; /* % */
  let seqIdx = 0;
  const ticksBox = $("#seq-ticks");
  FLOW_STEPS.forEach((_, i) => {
    const t = document.createElement("span");
    t.title = "Step " + (i + 1);
    t.addEventListener("click", () => { seqIdx = i; renderSeq(); });
    ticksBox.appendChild(t);
  });

  function renderSeq() {
    const s = FLOW_STEPS[seqIdx];
    const arrow = $("#seq-arrow");
    arrow.classList.toggle("self", s.from === s.to);
    arrow.classList.toggle("rtl", s.to < s.from);
    if (s.from === s.to) {
      arrow.style.left = (laneCenter(s.from) - 8) + "%";
      arrow.style.width = "16%";
    } else {
      const a = laneCenter(Math.min(s.from, s.to));
      const b = laneCenter(Math.max(s.from, s.to));
      arrow.style.left = a + "%";
      arrow.style.width = (b - a) + "%";
    }
    $$(".lane").forEach((l) => {
      const n = Number(l.dataset.lane);
      l.classList.toggle("hot", n === s.from || n === s.to);
    });
    $("#seq-card").innerHTML =
      '<span class="stepno">STEP ' + (seqIdx + 1) + " / " + FLOW_STEPS.length + "</span>" +
      "<h4>" + s.title + "</h4><p>" + s.body + '</p><p class="fileref">' + s.ref + "</p>";
    $$("#seq-ticks span").forEach((t, i) => {
      t.classList.toggle("done", i < seqIdx);
      t.classList.toggle("now", i === seqIdx);
    });
    $("#seq-prev").disabled = seqIdx === 0;
    $("#seq-next").disabled = seqIdx === FLOW_STEPS.length - 1;
  }
  $("#seq-prev").addEventListener("click", () => { if (seqIdx > 0) { seqIdx--; renderSeq(); } });
  $("#seq-next").addEventListener("click", () => { if (seqIdx < FLOW_STEPS.length - 1) { seqIdx++; renderSeq(); } });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const rect = document.getElementById("ch4").getBoundingClientRect();
    const inView = rect.top < innerHeight * 0.6 && rect.bottom > innerHeight * 0.4;
    if (!inView) return;
    ev.preventDefault();
    if (ev.key === "ArrowRight" && seqIdx < FLOW_STEPS.length - 1) seqIdx++;
    if (ev.key === "ArrowLeft" && seqIdx > 0) seqIdx--;
    renderSeq();
  });
  renderSeq();

  /* ---------- ch5: optimistic mutation stepper ---------- */
  let optIdx = 0;
  const optTrack = $("#opt-track");
  OPT_STEPS.forEach((s) => {
    const f = document.createElement("div");
    f.className = "opt-frame";
    f.textContent = s.label;
    optTrack.appendChild(f);
  });
  function renderOpt() {
    const s = OPT_STEPS[optIdx];
    $$(".opt-frame").forEach((f, i) => {
      f.className = "opt-frame";
      if (i === optIdx) f.classList.add("now", OPT_STEPS[i].cls);
    });
    $("#opt-card").innerHTML = "<h4>" + s.title + "</h4><p>" + s.body + "</p>";
    $("#opt-prev").disabled = optIdx === 0;
    $("#opt-next").disabled = optIdx === OPT_STEPS.length - 1;
  }
  $("#opt-prev").addEventListener("click", () => { if (optIdx > 0) { optIdx--; renderOpt(); } });
  $("#opt-next").addEventListener("click", () => { if (optIdx < OPT_STEPS.length - 1) { optIdx++; renderOpt(); } });
  renderOpt();

  /* ---------- ch6: heartbeat timeline + provider table ---------- */
  const hb = $("#hb-timeline");
  hb.innerHTML = '<div class="hb-bar"></div>' + HB_MARKS.map((m) =>
    '<div class="hb-mark ' + m.cls + '" style="left:' + m.pct + '%"><span class="tick"></span>' + m.label + "</div>"
  ).join("");

  const cellIcon = { yes: '<span class="yes">✓</span>', no: '<span class="no">—</span>', meh: '<span class="meh">⚠︎</span>' };
  $("#provider-table").innerHTML =
    "<thead><tr><th>Tool</th><th>Vendor</th><th>Resume</th><th>MCP</th><th>Skills path</th></tr></thead><tbody>" +
    PROVIDERS.map((p) =>
      "<tr><td><strong>" + p[0] + "</strong></td><td>" + p[1] + "</td><td>" + cellIcon[p[2]] +
      "</td><td>" + cellIcon[p[3]] + "</td><td><code>" + p[4] + "</code></td></tr>"
    ).join("") + "</tbody>";

  /* ---------- ch7: trigger tabs + status flow ---------- */
  const tabBox = $("#trigger-tabs");
  TRIGGERS.forEach((t, i) => {
    const b = document.createElement("button");
    b.innerHTML = t.emoji + " " + t.label;
    b.addEventListener("click", () => renderTrigger(i));
    tabBox.appendChild(b);
  });
  function renderTrigger(i) {
    const t = TRIGGERS[i];
    $$("#trigger-tabs button").forEach((b, j) => b.classList.toggle("active", j === i));
    $("#trigger-detail").innerHTML = "<p>" + t.body + '</p><div class="flow">' +
      t.flow.map((f, j) => "<span>" + (j === t.flow.length - 1 ? "<em>" + f + "</em>" : f) + "</span>")
        .join('<span class="status-arrow">→</span>') +
      '</div><p class="fileref">' + t.ref + "</p>";
  }
  renderTrigger(0);

  $("#status-flow").innerHTML = STATUS_CHIPS.map((s) =>
    (s.side ? '<span class="status-arrow">·</span>' : "") +
    '<span class="status-chip ' + s.cls + '">' + s.name + "</span>" +
    (s.arrow ? '<span class="status-arrow">→</span>' : "")
  ).join("");

  /* ---------- quizzes ---------- */
  $$(".quiz").forEach((quizEl) => {
    const def = QUIZZES[quizEl.dataset.quiz];
    if (!def) return;
    const answered = {};
    let firstTryCorrect = 0;
    def.questions.forEach((question, qi) => {
      const box = document.createElement("div");
      box.className = "qbox";
      box.innerHTML = "<h4>Q" + (qi + 1) + " · " + question.q + "</h4>";
      const opts = document.createElement("div");
      opts.className = "opts";
      const explain = document.createElement("p");
      explain.className = "explain";
      explain.textContent = question.explain;
      question.opts.forEach((label, oi) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.addEventListener("click", () => {
          if (answered[qi] === undefined) {
            answered[qi] = oi;
            if (oi === question.a) firstTryCorrect++;
          }
          b.classList.add(oi === question.a ? "correct" : "wrong");
          if (oi !== question.a) {
            opts.children[question.a].classList.add("correct");
          }
          $$("button", opts).forEach((x) => (x.disabled = true));
          explain.classList.add("show");
          maybeScore();
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      box.appendChild(explain);
      quizEl.appendChild(box);
    });
    function maybeScore() {
      if (Object.keys(answered).length !== def.questions.length) return;
      let score = quizEl.querySelector(".score");
      if (!score) {
        score = document.createElement("p");
        score.className = "score";
        quizEl.appendChild(score);
      }
      score.textContent = "Score: " + firstTryCorrect + " / " + def.questions.length +
        (firstTryCorrect === def.questions.length ? " — flawless. ✳" : " (first attempts)");
      store.set("quiz:" + quizEl.dataset.quiz, firstTryCorrect);
      if (quizEl.dataset.quiz === "capstone") {
        const fin = $("#finale");
        if (fin) fin.hidden = false;
      }
    }
  });
})();
