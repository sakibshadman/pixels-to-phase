/* Pixels-to-Phase project page scripts. No dependencies apart from KaTeX (self-hosted). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  }

  /* ------------------------------------------------------------ release links */
  (function links() {
    var L = window.P2P_LINKS || {};
    $all("a[data-link]").forEach(function (a) {
      var url = L[a.getAttribute("data-link")];
      if (url) {
        a.href = url;
        a.removeAttribute("aria-disabled");
        a.classList.remove("has-soon");
        if (/^https?:/i.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
      } else if (a.hasAttribute("data-fallback")) {
        a.href = a.getAttribute("data-fallback");
        a.classList.add("has-soon");
      } else {
        a.setAttribute("aria-disabled", "true");
        a.title = "Coming soon";
        a.addEventListener("click", function (e) { e.preventDefault(); });
      }
    });
    var status = $("#dataset-status");
    if (status && L.dataset) { status.textContent = "Available"; status.classList.add("is-live"); }
  })();

  /* ------------------------------------------------------------ theme toggle (light by default) */
  (function theme() {
    var btn = $("#theme-toggle"), root = document.documentElement;
    if (!btn) return;
    function apply(dark) {
      root.setAttribute("data-theme", dark ? "dark" : "light");
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      btn.title = dark ? "Light theme" : "Dark theme";
    }
    apply(root.getAttribute("data-theme") === "dark");
    btn.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") !== "dark";
      apply(dark);
      try { localStorage.setItem("p2p-theme", dark ? "dark" : "light"); } catch (e) {}
    });
  })();

  /* ------------------------------------------------------------ math */
  (function math() {
    $all(".math[data-tex]").forEach(function (el) {
      var tex = el.getAttribute("data-tex");
      if (window.katex) {
        try { window.katex.render(tex, el, { displayMode: el.getAttribute("data-display") === "1", throwOnError: false }); }
        catch (e) { el.textContent = tex; }
      } else { el.textContent = tex; }
    });
  })();

  /* ------------------------------------------------------------ live instrument (toy simulation of Eq. 17) */
  (function instrument() {
    var cv = $("#phasor");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var corruptEl = $("#corrupt"), rhoEl = $("#rho"), rhoOut = $("#rho-out"), autoEl = $("#rho-auto");
    var outOurs = $("#rr-ours"), outDirect = $("#rr-direct"), outTrue = $("#rr-true"), playBtn = $("#inst-play");

    var TAU = Math.PI * 2, FRAME = 1 / 30, WIN = 9;   // model updates at 30 frames/s; 9 s of history on screen
    var N = Math.round(WIN / FRAME);
    var hist = { truth: new Float32Array(N), obs: new Float32Array(N), ours: new Float32Array(N), rho: new Float32Array(N), bad: new Uint8Array(N) };
    var head = 0, filled = 0;
    var s = { t: 0, phTrue: 0, phObs: 0, phC: 0, phPrior: 0, fHat: 0.27, rho: 0.92, k: 0, corrupt: false,
              auto: true, demo: true, prevObs: 0, prevC: 0 };
    var colors = {};
    function readColors() {
      colors = { ink: cssVar("--ink"), ink2: cssVar("--ink-2"), rule: cssVar("--rule"), well: cssVar("--well"),
                 phase: cssVar("--phase"), obs: cssVar("--obs"), prior: cssVar("--prior"), rel: cssVar("--rel"),
                 badWash: cssVar("--bad-wash"), paper: cssVar("--paper") };
    }
    readColors();
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", function () { readColors(); draw(); });
    }
    new MutationObserver(function () { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    function fTrue(t) { return 0.27 + 0.025 * Math.sin(TAU * t / 37); }
    function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

    function step() {
      var dt = FRAME;
      s.t += dt;
      if (s.demo) s.corrupt = (s.t % 12) > 6 && (s.t % 12) < 10.5;
      if (corruptEl.checked !== s.corrupt) corruptEl.checked = s.corrupt;
      s.k += ((s.corrupt ? 1 : 0) - s.k) * (1 - Math.exp(-dt / 0.25));
      s.phTrue += TAU * fTrue(s.t) * dt;
      var t = s.t;
      var clean = 0.05 * (0.6 * Math.sin(TAU * 0.37 * t + 0.4) + 0.4 * Math.sin(TAU * 0.71 * t + 2.2));
      var bad = 1.55 * Math.sin(TAU * 0.95 * t + 1.6 * Math.sin(0.55 * t)) + 0.45 * Math.sin(TAU * 1.9 * t + 0.8) + 0.5;
      s.phObs = s.phTrue + (1 - s.k) * clean + s.k * bad;
      // predict: rotate the previous corrected state by the learned rate
      s.phPrior = s.phC + TAU * s.fHat * dt;
      // reliability
      if (s.auto) {
        var kk = Math.min(1, s.k * 3);
        var target = 0.92 - 0.905 * kk * kk * (3 - 2 * kk) + 0.02 * Math.sin(TAU * 0.3 * t) * (1 - kk);
        s.rho += (target - s.rho) * (1 - Math.exp(-dt / 0.07));
      } else {
        s.rho = parseFloat(rhoEl.value);
      }
      // correct: c_t = N((1 - rho) c^- + rho c~)
      var px = Math.cos(s.phPrior), py = Math.sin(s.phPrior), ox = Math.cos(s.phObs), oy = Math.sin(s.phObs);
      var vx = (1 - s.rho) * px + s.rho * ox, vy = (1 - s.rho) * py + s.rho * oy;
      var newC = s.phPrior + wrap(Math.atan2(vy, vx) - s.phPrior);
      var inc = newC - s.phC;
      if (s.rho > 0.5) s.fHat += (inc / (TAU * dt) - s.fHat) * 0.01;
      s.fHat = Math.min(Math.max(s.fHat, 0.1), 0.7);
      s.phC = newC;
      hist.truth[head] = s.phTrue; hist.obs[head] = s.phObs; hist.ours[head] = s.phC; hist.rho[head] = s.rho; hist.bad[head] = s.k > 0.5 ? 1 : 0;
      head = (head + 1) % N; filled = Math.min(filled + 1, N);
    }

    function idx(i) { return (head - filled + i + N) % N; }
    function rates() {
      // Pixels-to-Phase: median phase increment over reliable frames (Eq. 20); direct: count breathing cycles in the raw observation
      var incs = [], all = [], cycles = 0, prevSign = null, i, j0, j1;
      for (i = 1; i < filled; i++) {
        j0 = idx(i - 1); j1 = idx(i);
        var d = hist.ours[j1] - hist.ours[j0];
        all.push(d);
        if (hist.rho[j1] > 0.5) incs.push(d);
        var sgn = Math.cos(hist.obs[j1]) >= 0;
        if (prevSign === false && sgn === true) cycles++;
        prevSign = sgn;
      }
      var arr = incs.length > 30 ? incs : all;
      arr.sort(function (a, b) { return a - b; });
      var med = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
      var span = Math.max((filled - 1) * FRAME, 1e-3);
      return { ours: 60 * med / (TAU * FRAME), direct: 60 * cycles / span, truth: 60 * fTrue(s.t) };
    }

    var W = 0, H = 0, dpr = 1;
    function resize() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(r.width, 10); H = Math.max(r.height, 10);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      draw();
    }

    function arrow(x0, y0, x1, y1, color, width, headLen) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
      var a = Math.atan2(y1 - y0, x1 - x0);
      var bx = x1 - headLen * 0.8 * Math.cos(a), by = y1 - headLen * 0.8 * Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(a) + headLen * 0.5 * Math.sin(a), y1 - headLen * Math.sin(a) - headLen * 0.5 * Math.cos(a));
      ctx.lineTo(x1 - headLen * Math.cos(a) - headLen * 0.5 * Math.sin(a), y1 - headLen * Math.sin(a) + headLen * 0.5 * Math.cos(a));
      ctx.closePath(); ctx.fill();
    }

    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var wideLayout = W >= 440, cx, cy, R, wx0, wx1, wy0, wy1;
      if (wideLayout) {
        var S = Math.min(H, W * 0.42);
        R = S / 2 - 18; cx = R + 14; cy = H / 2;
        wx0 = cx + R + 30; wx1 = W - 4; wy0 = 8; wy1 = H - 8;
      } else {
        R = Math.min(W / 2 - 24, 92); cx = W / 2; cy = R + 16;
        wx0 = 4; wx1 = W - 4; wy0 = cy + R + 26; wy1 = H - 6;
      }
      // circle
      ctx.fillStyle = colors.well; ctx.strokeStyle = colors.rule; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx + R + 8, cy); ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy + R + 8); ctx.stroke();
      if (filled > 2) {
        // trail of the corrected phase
        var n = Math.min(40, filled);
        for (var i = 0; i < n; i++) {
          var a = hist.ours[idx(filled - n + i)];
          ctx.globalAlpha = 0.08 + 0.6 * i / n;
          ctx.fillStyle = colors.phase;
          ctx.beginPath(); ctx.arc(cx + R * Math.cos(a), cy - R * Math.sin(a), 1.2 + 2.6 * i / n, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        var L = R * 0.96;
        arrow(cx, cy, cx + L * Math.cos(s.phObs), cy - L * Math.sin(s.phObs), colors.obs, 2.2, 11);
        arrow(cx, cy, cx + L * Math.cos(s.phPrior), cy - L * Math.sin(s.phPrior), colors.prior, 2.6, 12);
        arrow(cx, cy, cx + R * Math.cos(s.phC), cy - R * Math.sin(s.phC), colors.phase, 4, 15);
        ctx.fillStyle = colors.phase; ctx.strokeStyle = colors.paper; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx + R * Math.cos(s.phC), cy - R * Math.sin(s.phC), 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = colors.ink; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();

      // waveform strip
      var rhoH = 24, plotY1 = wy1 - rhoH - 8, mid = (wy0 + plotY1) / 2, amp = (plotY1 - wy0) / 2 - 6;
      var X = function (i) { return wx0 + (wx1 - wx0) * i / (N - 1); };
      var off = N - filled;
      // corrupted spans
      ctx.fillStyle = colors.badWash;
      var start = -1;
      for (var j = 0; j <= filled; j++) {
        var b = j < filled && hist.bad[idx(j)];
        if (b && start < 0) start = j;
        if (!b && start >= 0) { ctx.fillRect(X(off + start), wy0, X(off + j) - X(off + start), wy1 - wy0); start = -1; }
      }
      ctx.strokeStyle = colors.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx0, mid); ctx.lineTo(wx1, mid); ctx.stroke();
      function trace(arr, color, width, dash) {
        if (filled < 2) return;
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = "round";
        ctx.beginPath();
        for (var q = 0; q < filled; q++) {
          var y = mid - amp * Math.sin(arr[idx(q)]);
          if (q === 0) ctx.moveTo(X(off + q), y); else ctx.lineTo(X(off + q), y);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      trace(hist.truth, colors.ink2, 1.4, [5, 4]);
      trace(hist.obs, colors.obs, 1.6);
      trace(hist.ours, colors.phase, 3);
      // reliability strip
      var ry0 = wy1 - rhoH, ry1 = wy1;
      ctx.strokeStyle = colors.rule; ctx.beginPath(); ctx.moveTo(wx0 + 14, ry1); ctx.lineTo(wx1, ry1); ctx.stroke();
      if (filled > 1) {
        ctx.strokeStyle = colors.rel; ctx.lineWidth = 2; ctx.beginPath();
        for (var q2 = 0; q2 < filled; q2++) {
          var yy = ry1 - hist.rho[idx(q2)] * (ry1 - ry0);
          var xx = Math.max(X(off + q2), wx0 + 14);
          if (q2 === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = colors.rel; ctx.font = "italic 15px " + getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = "middle"; ctx.fillText("ρ", wx0, (ry0 + ry1) / 2);
    }

    var last = 0, acc = 0, running = false, visible = true, lastText = 0;
    function updateText() {
      rhoOut.textContent = s.rho.toFixed(2);
      if (s.auto) rhoEl.value = s.rho.toFixed(2);
      var now = s.t;
      if (now - lastText > 0.5 && filled > 60) {
        lastText = now;
        var r = rates();
        outOurs.textContent = r.ours.toFixed(1);
        outDirect.textContent = r.direct.toFixed(1);
        outTrue.textContent = r.truth.toFixed(1);
      }
    }
    function loop(ts) {
      if (!running) return;
      if (!last) last = ts;
      acc += Math.min((ts - last) / 1000, 0.1); last = ts;
      while (acc >= FRAME) { step(); acc -= FRAME; }
      draw(); updateText();
      requestAnimationFrame(loop);
    }
    function start() { if (running || !visible) return; running = true; last = 0; requestAnimationFrame(loop); }
    function stop() { running = false; }

    // interaction
    corruptEl.addEventListener("change", function () { s.demo = false; s.corrupt = corruptEl.checked; if (!running) { for (var i = 0; i < 60; i++) step(); draw(); updateText(); } });
    rhoEl.addEventListener("input", function () { s.auto = false; autoEl.checked = false; s.rho = parseFloat(rhoEl.value); rhoOut.textContent = s.rho.toFixed(2); });
    autoEl.addEventListener("change", function () { s.auto = autoEl.checked; });

    // initial state: pre-run so the first frame already shows a corrupted episode
    for (var i = 0; i < Math.round(11 / FRAME); i++) step();
    lastText = -1; updateText();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(cv); else window.addEventListener("resize", resize);
    resize();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !reduceMotion) start(); else stop();
      }).observe(cv);
    }
    if (reduceMotion) {
      playBtn.hidden = false;
      playBtn.addEventListener("click", function () {
        if (running) { stop(); playBtn.textContent = "Play the simulation"; }
        else { reduceMotion = false; visible = true; start(); playBtn.textContent = "Pause the simulation"; }
      });
    } else { start(); }
  })();

  /* ------------------------------------------------------------ method explorer */
  (function explorer() {
    var svg = $(".ov-mask");
    if (!svg) return;
    var STEPS = [
      [[8, 608, 587, 836], [639, 651, 855, 718], [690, 538, 785, 616], [705, 728, 1260, 842]],
      [[8, 381, 587, 602], [639, 398, 857, 522], [891, 651, 1158, 720], [891, 488, 1166, 612], [891, 326, 1160, 466]],
      [[1150, 545, 1312, 614], [1198, 456, 1429, 520], [1258, 326, 1376, 366], [1292, 652, 1392, 702], [690, 166, 1426, 206], [1386, 166, 1426, 690]],
      [[8, 8, 587, 356], [637, 227, 1429, 313], [684, 328, 812, 366], [1476, 8, 2055, 516], [637, 17, 1429, 139]]
    ];
    var RING = ["var(--obs)", "var(--phase)", "var(--prior)", "var(--rel)"];
    var defs = svgEl("defs", {});
    var mask = svgEl("mask", { id: "ov-holes", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 2059, height: 847 });
    mask.appendChild(svgEl("rect", { x: 0, y: 0, width: 2059, height: 847, fill: "#fff" }));
    var holes = svgEl("g", { fill: "#000" });
    mask.appendChild(holes); defs.appendChild(mask); svg.appendChild(defs);
    var dim = svgEl("rect", { class: "dim", x: 0, y: 0, width: 2059, height: 847, mask: "url(#ov-holes)", opacity: 0 });
    svg.appendChild(dim);
    var rings = svgEl("g", {});
    svg.appendChild(rings);

    var tabs = $all(".stage-tabs [role=tab]");
    var panels = $all("#stage-panel [data-panel]");
    function select(stage, focus) {
      tabs.forEach(function (b) {
        var on = +b.getAttribute("data-stage") === stage;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      panels.forEach(function (p) { p.hidden = +p.getAttribute("data-panel") !== stage; });
      while (holes.firstChild) holes.removeChild(holes.firstChild);
      while (rings.firstChild) rings.removeChild(rings.firstChild);
      if (stage < 0) { dim.setAttribute("opacity", 0); return; }
      STEPS[stage].forEach(function (r) {
        var w = r[2] - r[0], h = r[3] - r[1];
        holes.appendChild(svgEl("rect", { x: r[0] - 6, y: r[1] - 6, width: w + 12, height: h + 12, rx: 12 }));
        if (Math.min(w, h) > 50) {
          var ring = svgEl("rect", { class: "ring", x: r[0] - 7, y: r[1] - 7, width: w + 14, height: h + 14, rx: 12 });
          ring.style.stroke = RING[stage];
          rings.appendChild(ring);
        }
      });
      dim.setAttribute("opacity", 0.8);
    }
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { select(+b.getAttribute("data-stage")); });
      b.addEventListener("keydown", function (e) {
        var k = e.key, j = i;
        if (k === "ArrowRight") j = (i + 1) % tabs.length;
        else if (k === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (k === "Home") j = 0;
        else if (k === "End") j = tabs.length - 1;
        else return;
        e.preventDefault();
        select(+tabs[j].getAttribute("data-stage"), true);
      });
    });
    select(-1);
  })();

  /* ------------------------------------------------------------ results charts */
  (function charts() {
    var db = $("#dumbbell");
    if (db) {
      var Wd = 560, Hd = 236, x0 = 150, x1 = 540, lo = 1.3, hi = 2.4;
      db.setAttribute("viewBox", "0 0 " + Wd + " " + Hd);
      var X = function (v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); };
      var g = svgEl("g", { class: "grid" });
      [1.4, 1.6, 1.8, 2.0, 2.2, 2.4].forEach(function (v) {
        g.appendChild(svgEl("line", { x1: X(v), x2: X(v), y1: 34, y2: 200 }));
        db.appendChild(svgEl("text", { class: "tick", x: X(v), y: 220, "text-anchor": "middle" }, v.toFixed(1)));
      });
      db.insertBefore(g, db.firstChild);
      db.appendChild(svgEl("circle", { class: "flow", cx: x0 + 4, cy: 12, r: 6 }));
      db.appendChild(svgEl("text", { class: "tick", x: x0 + 16, y: 16 }, "FLOW"));
      db.appendChild(svgEl("circle", { class: "ours", cx: x0 + 74, cy: 12, r: 6 }));
      db.appendChild(svgEl("text", { class: "tick", x: x0 + 86, y: 16 }, "Pixels-to-Phase"));
      [["Within-dataset", 1.69, 1.51], ["Held-out dataset", 2.01, 1.74], ["Limited-source", 2.28, 1.95]].forEach(function (r, i) {
        var y = 66 + i * 58;
        db.appendChild(svgEl("text", { class: "lab", x: 0, y: y + 5 }, r[0]));
        db.appendChild(svgEl("line", { class: "link", x1: X(r[2]), x2: X(r[1]), y1: y, y2: y }));
        db.appendChild(svgEl("circle", { class: "flow", cx: X(r[1]), cy: y, r: 7 }));
        db.appendChild(svgEl("circle", { class: "ours", cx: X(r[2]), cy: y, r: 8 }));
        db.appendChild(svgEl("text", { class: "val flow", x: X(r[1]) + 13, y: y + 4.5 }, r[1].toFixed(2)));
        db.appendChild(svgEl("text", { class: "val ours", x: X(r[2]) - 13, y: y + 4.5, "text-anchor": "end" }, r[2].toFixed(2)));
        db.appendChild(svgEl("text", { class: "gain", x: (X(r[1]) + X(r[2])) / 2, y: y - 13, "text-anchor": "middle" }, "−" + (r[1] - r[2]).toFixed(2)));
      });
    }
    var fp = $("#forest");
    if (fp) {
      var Wf = 560, rows = [["AIR-400", 0.18, 0.06, 0.31, "0.018"], ["MPSC-RR", 0.26, 0.15, 0.38, "0.003"], ["Sleep", 0.15, 0.03, 0.28, "0.031"],
        ["OVRM", 0.21, 0.11, 0.32, "0.006"], ["In-house", 0.08, 0.01, 0.16, "0.041"], ["Overall", 0.18, 0.09, 0.27, "0.004"]];
      var Hf = 40 + rows.length * 30 + 34, fx0 = 110, fx1 = 470, flo = -0.05, fhi = 0.45;
      fp.setAttribute("viewBox", "0 0 " + Wf + " " + Hf);
      var FX = function (v) { return fx0 + (v - flo) / (fhi - flo) * (fx1 - fx0); };
      var fg = svgEl("g", { class: "grid" });
      [0, 0.1, 0.2, 0.3, 0.4].forEach(function (v) {
        fg.appendChild(svgEl("line", { x1: FX(v), x2: FX(v), y1: 26, y2: Hf - 34 }));
        fp.appendChild(svgEl("text", { class: "tick", x: FX(v), y: Hf - 14, "text-anchor": "middle" }, v.toFixed(1)));
      });
      fp.appendChild(fg);
      fp.appendChild(svgEl("line", { class: "zero", x1: FX(0), x2: FX(0), y1: 22, y2: Hf - 34 }));
      fp.appendChild(svgEl("text", { class: "muted", x: fx0, y: 14 }, "MAE reduction over FLOW (BPM)"));
      fp.appendChild(svgEl("text", { class: "muted", x: Wf, y: 14, "text-anchor": "end" }, "p (Holm)"));
      rows.forEach(function (r, i) {
        var y = 44 + i * 30 + (i === rows.length - 1 ? 8 : 0);
        if (i === rows.length - 1) fp.appendChild(svgEl("line", { x1: 0, x2: Wf, y1: y - 20, y2: y - 20, stroke: "var(--rule)" }));
        fp.appendChild(svgEl("text", { class: i === rows.length - 1 ? "lab" : "tick", x: 0, y: y + 4.5, style: i === rows.length - 1 ? "" : "fill: var(--ink); font-size: 14px" }, r[0]));
        fp.appendChild(svgEl("line", { class: "ci", x1: FX(r[2]), x2: FX(r[3]), y1: y, y2: y }));
        if (i === rows.length - 1) {
          var cxp = FX(r[1]);
          fp.appendChild(svgEl("path", { class: "ours", d: "M" + (cxp - 9) + " " + y + "L" + cxp + " " + (y - 8) + "L" + (cxp + 9) + " " + y + "L" + cxp + " " + (y + 8) + "Z" }));
        } else {
          fp.appendChild(svgEl("rect", { class: "ours", x: FX(r[1]) - 5, y: y - 5, width: 10, height: 10 }));
        }
        fp.appendChild(svgEl("text", { class: "muted", x: Wf, y: y + 4.5, "text-anchor": "end", style: "font-variant-numeric: tabular-nums" }, r[4]));
      });
    }
  })();

  /* ------------------------------------------------------------ results tables */
  (function tables() {
    var table = $("#results-table");
    if (!table) return;
    var DATA = {"t1": [["POS", "5.44", "7.31", "0.52", "–", "–", "–", "4.16", "6.41", "0.58", "–", "–", "–", "3.26", "4.62", "0.69", "4.29", "6.11", "0.60"], ["Green", "6.18", "8.74", "0.47", "–", "–", "–", "5.36", "7.11", "0.50", "–", "–", "–", "4.07", "5.43", "0.59", "5.20", "7.09", "0.52"], ["CHROM", "5.67", "7.96", "0.51", "–", "–", "–", "4.42", "6.05", "0.56", "–", "–", "–", "3.33", "4.98", "0.66", "4.47", "6.33", "0.58"], ["ICA", "6.42", "8.41", "0.49", "–", "–", "–", "4.91", "7.36", "0.54", "–", "–", "–", "3.72", "5.14", "0.63", "5.02", "6.97", "0.55"], ["Intensity + Peak Counting", "5.81", "8.96", "0.44", "4.76", "6.38", "0.57", "5.23", "7.52", "0.48", "3.47", "5.25", "0.62", "4.10", "5.79", "0.60", "4.67", "6.78", "0.54"], ["PhysNet", "4.08", "6.22", "0.63", "2.88", "4.11", "0.74", "3.37", "4.90", "0.67", "2.05", "3.14", "0.80", "2.32", "3.21", "0.79", "2.94", "4.32", "0.73"], ["PhysFormer", "3.55", "5.48", "0.70", "2.34", "3.52", "0.81", "2.96", "4.06", "0.72", "1.78", "2.61", "0.85", "1.97", "3.04", "0.82", "2.52", "3.74", "0.78"], ["EfficientPhys", "3.86", "5.71", "0.66", "2.47", "3.65", "0.78", "3.04", "4.52", "0.70", "1.91", "2.82", "0.82", "2.13", "3.38", "0.80", "2.68", "4.02", "0.75"], ["SpikingPhys", "3.69", "5.84", "0.68", "2.59", "3.47", "0.80", "2.83", "4.61", "0.71", "1.72", "2.74", "0.84", "2.08", "2.91", "0.82", "2.58", "3.91", "0.77"], ["MTTS-CAN", "–", "–", "–", "2.90", "4.20", "0.72", "–", "–", "–", "2.31", "3.36", "0.79", "2.56", "3.71", "0.77", "2.59†", "3.76†", "0.76†"], ["AIRFlowNet", "2.62", "4.29", "0.76", "2.19", "3.08", "0.82", "2.63", "3.71", "0.74", "1.89", "2.66", "0.83", "1.82", "3.02", "0.81", "2.23", "3.35", "0.79"], ["RRPIPS", "2.74", "3.88", "0.77", "1.67", "2.72", "0.87", "2.17", "3.58", "0.79", "1.39", "2.26", "0.88", "1.75", "2.47", "0.86", "1.94", "2.98", "0.83"], ["CliffPhys", "–", "–", "–", "1.91", "2.89", "0.84", "–", "–", "–", "1.48", "2.20", "0.86", "1.66", "2.48", "0.84", "1.68†", "2.52†", "0.85†"], ["FLOW", "2.36", "3.53", "0.80", "1.58", "2.26", "0.90", "1.88", "3.12", "0.83", "1.26", "1.91", "0.91", "1.36", "2.22", "0.89", "1.69", "2.61", "0.87"], ["Pixels-to-Phase", "2.18", "3.34", "0.82", "1.32", "2.33", "0.92", "1.73", "3.18", "0.86", "1.05", "1.68", "0.93", "1.28", "2.06", "0.90", "1.51", "2.52", "0.89"]], "t4": [["PhysNet", "4.72", "6.58", "0.57", "3.05", "4.91", "0.69", "4.08", "5.64", "0.60", "2.41", "3.92", "0.75", "3.18", "4.06", "0.71", "3.49", "5.02", "0.66"], ["PhysFormer", "4.21", "6.11", "0.63", "2.74", "4.18", "0.75", "3.61", "5.07", "0.67", "2.30", "3.41", "0.78", "2.39", "3.79", "0.76", "3.05", "4.51", "0.72"], ["EfficientPhys", "4.39", "6.92", "0.59", "3.28", "4.52", "0.71", "3.74", "5.83", "0.63", "2.63", "3.58", "0.77", "2.84", "4.31", "0.72", "3.38", "5.03", "0.68"], ["SpikingPhys", "4.07", "6.36", "0.64", "2.67", "3.73", "0.77", "3.22", "4.94", "0.68", "2.12", "3.24", "0.81", "2.52", "3.36", "0.80", "2.92", "4.33", "0.74"], ["AIRFlowNet", "3.56", "5.19", "0.70", "2.48", "3.54", "0.79", "3.07", "4.32", "0.72", "2.21", "2.98", "0.83", "2.05", "3.44", "0.78", "2.67", "3.89", "0.76"], ["RRPIPS", "3.27", "4.76", "0.72", "1.95", "3.16", "0.85", "2.58", "4.21", "0.75", "1.72", "2.78", "0.86", "2.08", "2.81", "0.84", "2.32", "3.54", "0.80"], ["FLOW", "2.81", "4.53", "0.77", "1.68", "2.64", "0.92", "2.42", "3.51", "0.85", "1.52", "2.20", "0.93", "1.61", "2.55", "0.87", "2.01", "3.09", "0.87"], ["Pixels-to-Phase", "2.54", "3.79", "0.81", "1.42", "2.18", "0.91", "2.03", "3.06", "0.84", "1.31", "1.84", "0.92", "1.38", "2.04", "0.90", "1.74", "2.58", "0.88"]]};
    var COLS = ["AIR-400", "MPSC-RR", "Sleep", "OVRM", "In-house", "Average"];
    var METRIC = ["MAE (BPM) ↓", "RMSE (BPM) ↓", "R ↑"];
    var FAM = {
      t1: { "POS": "Classical signal processing", "PhysNet": "Learned physiological models", "AIRFlowNet": "Respiration-specific", "FLOW": "Domain generalization", "Pixels-to-Phase": "Ours" },
      t4: { "PhysNet": "Learned physiological models", "AIRFlowNet": "Respiration-specific", "FLOW": "Domain generalization", "Pixels-to-Phase": "Ours" }
    };
    var TITLE = {
      t1: "Table 1. Main results on AIR-400, MPSC-RR, Sleep, OVRM and In-House Dataset v1.0.",
      t4: "Table 4. Held-out dataset transfer. Each target dataset is excluded from training and validation and used only for testing."
    };
    var cur = { set: "t1", metric: 0 };
    function num(v) { return v === "–" || /†/.test(v) ? null : parseFloat(v); }
    function render() {
      var rows = DATA[cur.set], m = cur.metric, higher = m === 2;
      var best = COLS.map(function (_, c) {
        var vals = rows.map(function (r) { return num(r[1 + c * 3 + m]); }).filter(function (v) { return v != null; });
        return higher ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
      });
      var html = "<thead><tr><th scope=\"col\">Method <span class=\"fam\">" + METRIC[m] + "</span></th>";
      COLS.forEach(function (c) { html += "<th scope=\"col\">" + c + "</th>"; });
      html += "</tr></thead><tbody>";
      rows.forEach(function (r) {
        var fam = FAM[cur.set][r[0]];
        var cls = (r[0] === "Pixels-to-Phase" ? "ours " : "") + (fam && r[0] !== rows[0][0] ? "group-start" : "");
        html += "<tr class=\"" + cls.trim() + "\"><th scope=\"row\">" + r[0] + (fam ? "<span class=\"fam\">" + fam + "</span>" : "") + "</th>";
        COLS.forEach(function (_, c) {
          var v = r[1 + c * 3 + m], n = num(v);
          var cl = v === "–" ? "dash" : (n != null && Math.abs(n - best[c]) < 1e-9 ? "best" : "");
          html += "<td" + (cl ? " class=\"" + cl + "\"" : "") + ">" + v + "</td>";
        });
        html += "</tr>";
      });
      table.innerHTML = html + "</tbody>";
      $("#table-title").textContent = TITLE[cur.set];
      $("#table-note").textContent = (cur.set === "t1"
        ? "A dash means the method is not compatible with the target modality or protocol; † marks an average over compatible targets only. "
        : "") + "Best value in each column is in bold. MAE and RMSE are in breaths per minute; R is waveform Pearson correlation.";
    }
    function bindSeg(attr, key) {
      var btns = $all("[data-" + attr + "]");
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          btns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
          cur[key] = attr === "metric" ? +b.getAttribute("data-metric") : b.getAttribute("data-set");
          render();
        });
      });
    }
    bindSeg("set", "set"); bindSeg("metric", "metric");
    render();
  })();

  /* ------------------------------------------------------------ motion evidence viewer */
  (function evidence() {
    var img = $("#ev-img"), cap = $("#ev-cap");
    if (!img) return;
    var EV = [
      { src: "static/images/supp_modalities.webp", w: 1552, h: 717,
        alt: "Respiratory region crops and RAFT-Large flow for RGB, thermal, infant NIR and low-light NIR recordings.",
        cap: "Respiratory-centered appearance and RAFT-Large motion support across RGB, thermal, infant NIR, and low-light/occluded NIR recordings. Respiratory-motion visibility changes substantially with the modality." },
      { src: "static/images/supp_close.webp", w: 2400, h: 912,
        alt: "Indoor close-range torso crop and motion fields from eight flow estimators, with RAFT-small and RAFT-large coherent over the chest.",
        cap: "Indoor close range. The torso region holds clearly recoverable respiratory support: RAFT-based flow stays spatially coherent over the chest, and PhaseFlow highlights localized gradient-projected mechanical evidence. Fields shown: Lucas–Kanade, Farnebäck, Coarse2Fine, DIS, PhaseFlow, TV-L1, RAFT-small and RAFT-large." },
      { src: "static/images/supp_far.webp", w: 2400, h: 827,
        alt: "Outdoor torso crop at about 13 meters and the same eight motion fields, which are noisy and less coherent.",
        cap: "Outdoor at about 13 m. The torso covers fewer pixels, so the region is low-resolution and the motion evidence is less spatially consistent. This is the situation where motion-quality cues and observation-dependent correction are needed." },
      { src: "static/images/supp_phaseflow.webp", w: 1463, h: 1198,
        alt: "RGB and HSV amplitude traces and the PhaseFlow signal over about 900 samples.",
        cap: "Construction of PhaseFlow. Local Lucas–Kanade displacement is projected onto the image gradient to give signed mechanical evidence of subtle respiratory displacement. RGB and HSV amplification is shown for visualization only and is not an input to the model." }
    ];
    var tabs = $all("[data-ev]");
    function select(i, focus) {
      tabs.forEach(function (b, j) { b.setAttribute("aria-selected", i === j ? "true" : "false"); b.tabIndex = i === j ? 0 : -1; if (i === j && focus) b.focus(); });
      var e = EV[i];
      img.src = e.src; img.width = e.w; img.height = e.h; img.alt = e.alt; cap.textContent = e.cap;
      img.style.maxWidth = Math.round(Math.min(1040, 540 * e.w / e.h)) + "px";
    }
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { select(i); });
      b.addEventListener("keydown", function (e) {
        var j = i;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length; else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length; else return;
        e.preventDefault(); select(j, true);
      });
    });
    select(0);
  })();

  /* ------------------------------------------------------------ BibTeX copy */
  (function bib() {
    var btn = $("#copy-bib"), pre = $("#bibtex");
    if (!btn || !pre) return;
    btn.addEventListener("click", function () {
      var text = pre.textContent;
      function selectText() {
        var r = document.createRange(); r.selectNodeContents(pre);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        btn.textContent = "Press Ctrl+C to copy";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { btn.textContent = "Copied"; }, selectText);
      } else { selectText(); }
      setTimeout(function () { btn.textContent = "Copy BibTeX"; }, 2200);
    });
  })();
})();
