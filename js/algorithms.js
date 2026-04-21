/*
 * SPMF-Web — Algorithm Browser, Detail Panel & Picker Modal
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";

/* ── shared store ─────────────────────────────────────────────── */
const AlgoStore = (() => {
  let _list = [];
  function set(list) { _list = list; }
  function get()     { return _list; }
  return { set, get };
})();

/* ══════════════════════════════════════════════════════════════════
   AlgoBrowser
   ══════════════════════════════════════════════════════════════════
   KEY DESIGN DECISION — no algorithm names in onclick strings
   ──────────────────────────────────────────────────────────────────
   Algorithm names can contain characters such as  +  _  &  "  '
   that break inline onclick="…" attribute strings no matter how
   carefully we escape them (double-encoding, server decoding
   mismatches, etc.).

   Instead every clickable element stores the name in a
   data-algo-name attribute and a data-action attribute.
   A single delegated listener on the container reads those
   values through el.dataset.algoName — zero string injection,
   zero encoding issues.
   ══════════════════════════════════════════════════════════════════ */
const AlgoBrowser = (() => {

  let _view   = "grid";   // "grid" | "list"
  let _search = "";
  let _cat    = "";

  /* ── Load ───────────────────────────────────────────────────── */
  async function load() {
    const container = document.getElementById("algo-container");
    container.innerHTML =
      `<div class="loading-center">
         <div class="spinner"></div> Loading algorithms…
       </div>`;

    try {
      const data = await API.GET("/api/algorithms");
      AlgoStore.set(data.algorithms || []);
      _buildCatFilter();
      UI.setText("algo-page-sub",
        `${AlgoStore.get().length} algorithms in ` +
        `${_categories().length} categories.`);
      UI.showBadge("algo-nav-badge", AlgoStore.get().length);

      /*
       * Attach ONE delegated listener on the container.
       * It handles every card / row / button click for the
       * lifetime of the page — no per-element onclick needed.
       */
      _attachContainerListener();
      render();
    } catch(e) {
      container.innerHTML =
        `<div class="empty-state">
           <div class="es-icon">⚠</div>
           <div class="es-title">Load Failed</div>
           <div class="es-sub">${UI.esc(e.message)}</div>
         </div>`;
      UI.toast("error", "Algorithm Load Failed", e.message);
    }
  }

  /*
   * _attachContainerListener
   * ─────────────────────────
   * Reads data-action + data-algo-name from the clicked element
   * (or its closest ancestor that carries those attributes).
   * This completely replaces inline onclick="AlgoBrowser.xxx('name')"
   * and is immune to special characters in algorithm names.
   */
  function _attachContainerListener() {
    const container = document.getElementById("algo-container");
    if (!container) return;

    container.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const name   = target.dataset.algoName;
      const action = target.dataset.action;
      if (!name) return;

      if (action === "open-detail")  openDetail(name);
      if (action === "select-run")   selectForRun(name);
    });
  }

  /* ── View toggle ────────────────────────────────────────────── */
  function setView(mode) {
    _view = mode;
    document.getElementById("vbtn-grid")
      .classList.toggle("active", mode === "grid");
    document.getElementById("vbtn-list")
      .classList.toggle("active", mode === "list");
    render();
  }

  /* ── Search ─────────────────────────────────────────────────── */
  function onSearch() {
    _search = document.getElementById("algo-search").value;
    document.getElementById("algo-search-clear")
      .classList.toggle("show", _search.length > 0);
    render();
  }

  function clearSearch() {
    document.getElementById("algo-search").value = "";
    _search = "";
    document.getElementById("algo-search-clear")
      .classList.remove("show");
    render();
  }

  /* ── Render ─────────────────────────────────────────────────── */
  function render() {
    _search = document.getElementById("algo-search").value.toLowerCase();
    _cat    = document.getElementById("algo-cat-filter").value;

    let list = AlgoStore.get();
    if (_cat)    list = list.filter(a => a.algorithmCategory === _cat);
    if (_search) list = list.filter(a =>
      a.name.toLowerCase().includes(_search) ||
      (a.algorithmCategory || "").toLowerCase().includes(_search)
    );

    document.getElementById("algo-count-badge").textContent =
      `${list.length} of ${AlgoStore.get().length}`;

    const container = document.getElementById("algo-container");

    if (!list.length) {
      container.innerHTML =
        `<div class="empty-state">
           <div class="es-icon">🔍</div>
           <div class="es-title">No Results</div>
           <div class="es-sub">
             Try a different search or category filter.
           </div>
         </div>`;
      return;
    }

    container.innerHTML = _view === "grid"
      ? _renderGrid(list)
      : _renderList(list);
  }

  /* ── Grid view ──────────────────────────────────────────────── */
  /*
   * Each card uses  data-algo-name  +  data-action  instead of
   * onclick="AlgoBrowser.openDetail('…')".
   * The delegated listener installed by _attachContainerListener()
   * picks these up — algorithm names with +, _, & etc. are safe.
   */
  function _renderGrid(list) {
    const cats = _groupByCat(list);
    return Object.keys(cats).sort().map(cat =>
      `<div class="cat-header">
         📁 ${UI.esc(cat)}
         <span class="badge badge-blue">${cats[cat].length}</span>
       </div>
       <div class="algo-grid mb-14">
         ${cats[cat]
           .sort((a, b) => a.name.localeCompare(b.name))
           .map(alg =>
             `<div class="algo-card"
                   data-action="open-detail"
                   data-algo-name="${UI.escAttr(alg.name)}">
                <div class="algo-card-name">
                  ${UI.highlight(alg.name, _search)}
                </div>
                <div class="algo-card-footer">
                  <span class="badge badge-purple">
                    ${UI.esc(alg.algorithmCategory || "")}
                  </span>
                  ${alg.algorithmType
                    ? `<span class="badge badge-gray">
                         ${UI.esc(alg.algorithmType)}
                       </span>`
                    : ""}
                </div>
              </div>`
           ).join("")}
       </div>`
    ).join("");
  }

  /* ── List view ──────────────────────────────────────────────── */
  function _renderList(list) {
    const rows = [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(alg =>
        `<div class="algo-list-row">
           <div class="algo-list-name">
             ${UI.highlight(alg.name, _search)}
           </div>
           <span class="badge badge-purple">
             ${UI.esc(alg.algorithmCategory || "")}
           </span>
           <span class="badge badge-gray">
             ${UI.esc(alg.algorithmType || "")}
           </span>
           <div class="btn-row">
             <button class="btn btn-ghost btn-sm"
                     data-action="open-detail"
                     data-algo-name="${UI.escAttr(alg.name)}">
               Detail
             </button>
             <button class="btn btn-primary btn-sm"
                     data-action="select-run"
                     data-algo-name="${UI.escAttr(alg.name)}">
               ▶ Run
             </button>
           </div>
         </div>`
      ).join("");
    return `<div class="table-wrap">${rows}</div>`;
  }

  /* ── Detail panel ───────────────────────────────────────────── */
  async function openDetail(name) {
    UI.setText("detail-title", name);
    document.getElementById("detail-body").innerHTML =
      `<div class="loading-center">
         <div class="spinner lg"></div>
       </div>`;
    document.getElementById("detail-overlay").classList.add("open");
    document.getElementById("detail-panel").classList.add("open");
    document.body.style.overflow = "hidden";

    try {
      /*
       * encodeURIComponent correctly encodes + as %2B and
       * every other special character.
       * Make sure your server decodes path variables with
       * standard percent-decoding (not form-urlencoding).
       */
      const d = await API.GET(
        `/api/algorithms/${encodeURIComponent(name)}`
      );
      document.getElementById("detail-body").innerHTML =
        _buildDetail(d);

      /*
       * Attach delegated listener inside the detail panel so
       * the "Run This Algorithm" button works without an
       * inline onclick string.
       */
      _attachDetailListener();
    } catch(e) {
      document.getElementById("detail-body").innerHTML =
        `<div class="empty-state">
           <div class="es-icon">⚠</div>
           <div class="es-sub">${UI.esc(e.message)}</div>
         </div>`;
    }
  }

  /*
   * Delegated listener for buttons rendered inside the detail panel.
   * Called every time openDetail() refreshes the panel content.
   */
  function _attachDetailListener() {
    const panel = document.getElementById("detail-panel");
    if (!panel) return;

    // Remove any previous listener by cloning the node
    // (simple approach — avoids stacking listeners on re-open)
    const fresh = panel.cloneNode(true);
    panel.parentNode.replaceChild(fresh, panel);

    fresh.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const name   = target.dataset.algoName;
      const action = target.dataset.action;

      if (action === "close-detail") {
        closeDetail();
        return;
      }
      if (!name) return;
      if (action === "select-run")  selectForRun(name);
      if (action === "open-detail") openDetail(name);
    });
  }

  function closeDetail() {
    document.getElementById("detail-overlay").classList.remove("open");
    /*
     * The panel node may have been replaced by _attachDetailListener.
     * Query it fresh each time.
     */
    const panel = document.getElementById("detail-panel");
    if (panel) panel.classList.remove("open");
    document.body.style.overflow = "";
  }

  function _buildDetail(d) {
    const params    = d.parameters || [];
    const mandatory = d.numberOfMandatoryParameters || 0;
    const inTypes   = (d.inputFileTypes  || []).join(", ") || "N/A";
    const outTypes  = (d.outputFileTypes || []).join(", ") || "N/A";

    const paramHTML = params.length
      ? params.map((p, i) =>
          `<div class="param-item">
             <div class="param-item-header">
               <span class="badge badge-blue">${i + 1}</span>
               <span class="param-item-name">
                 ${UI.esc(p.name || `param_${i + 1}`)}
               </span>
               <span class="badge ${p.isOptional
                 ? "badge-gray" : "badge-orange"}">
                 ${p.isOptional ? "optional" : "required"}
               </span>
             </div>
             <div class="param-item-meta">
               Type: <strong>${UI.esc(p.parameterType || "?")}</strong>
               &nbsp;·&nbsp; Example:
               <code style="background:var(--bg4);padding:1px 5px;
                            border-radius:3px;">
                 ${UI.esc(String(p.example ?? "-"))}
               </code>
             </div>
           </div>`
        ).join("")
      : `<p class="text-muted text-sm">No parameters required.</p>`;

    /*
     * "Run This Algorithm" button — data-action + data-algo-name
     * instead of onclick="AlgoBrowser.selectForRun('…')".
     * The delegated listener installed by _attachDetailListener()
     * handles it safely even when d.name contains + or _.
     */
    return `
      <div style="margin-bottom:18px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;
                    margin-bottom:12px;">
          <span class="badge badge-purple">
            ${UI.esc(d.algorithmCategory || "")}
          </span>
          <span class="badge badge-cyan">
            ${UI.esc(d.algorithmType || "")}
          </span>
          ${d.documentationURL
            ? `<a class="badge badge-gray text-link"
                  href="${UI.escAttr(d.documentationURL)}"
                  target="_blank">📖 Docs ↗</a>`
            : ""}
        </div>
        <table class="kv-table" style="margin-bottom:16px;">
          <tr><td>Author(s)</td>
              <td>${UI.esc(d.implementationAuthorNames || "N/A")}</td>
          </tr>
          <tr><td>Input Types</td>
              <td>${UI.esc(inTypes)}</td>
          </tr>
          <tr><td>Output Types</td>
              <td>${UI.esc(outTypes)}</td>
          </tr>
          <tr><td>Parameters</td>
              <td>${params.length} total — ${mandatory} required</td>
          </tr>
        </table>
      </div>
      <div class="section-divider">Parameters</div>
      <div style="margin-bottom:22px;">${paramHTML}</div>
      <div class="btn-row">
        <button class="btn btn-success" style="flex:1;"
                data-action="select-run"
                data-algo-name="${UI.escAttr(d.name)}">
          ▶ Run This Algorithm
        </button>
      </div>`;
  }

  /* ── Select for run ─────────────────────────────────────────── */
  async function selectForRun(name) {
    closeDetail();
    AlgoPicker.close();
    Nav.go("run");
    document.getElementById("run-algo-name").value = name;
    await RunJob.loadDescriptor(name);
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function _categories() {
    return [...new Set(
      AlgoStore.get()
        .map(a => a.algorithmCategory || "")
        .filter(Boolean)
    )].sort();
  }

  function _buildCatFilter() {
    const sel  = document.getElementById("algo-cat-filter");
    const cats = _categories();
    sel.innerHTML =
      `<option value="">All Categories</option>` +
      cats.map(c =>
        `<option value="${UI.esc(c)}">${UI.esc(c)}</option>`
      ).join("");
  }

  function _groupByCat(list) {
    const cats = {};
    list.forEach(a => {
      const c = a.algorithmCategory || "UNCATEGORIZED";
      (cats[c] = cats[c] || []).push(a);
    });
    return cats;
  }

  return {
    load, setView, onSearch, clearSearch, render,
    openDetail, closeDetail, selectForRun,
  };
})();

/* ══════════════════════════════════════════════════════════════════
   AlgoPicker — modal that appears on the Run page
   ══════════════════════════════════════════════════════════════════
   Same principle: data-algo-name + data-action on every row,
   one delegated listener on the picker list container.
   ══════════════════════════════════════════════════════════════════ */
const AlgoPicker = (() => {

  /* ── Open / close ───────────────────────────────────────────── */
  function open() {
    _renderList(AlgoStore.get());
    UI.setText("picker-sub",
      `${AlgoStore.get().length} algorithms available`);
    document.getElementById("picker-search").value = "";
    document.getElementById("picker-backdrop").classList.add("open");

    /*
     * Attach delegated listener on the list container once.
     * We use a flag so we don't stack listeners on repeated opens.
     */
    _attachPickerListener();
  }

  function close() {
    document.getElementById("picker-backdrop").classList.remove("open");
  }

  function onBackdrop(e) {
    if (e.target === document.getElementById("picker-backdrop")) close();
  }

  /* ── Search / filter ────────────────────────────────────────── */
  function filter() {
    const q = document.getElementById("picker-search")
      .value.toLowerCase();
    const filtered = AlgoStore.get().filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.algorithmCategory || "").toLowerCase().includes(q)
    );
    _renderList(filtered, q);
  }

  /* ── Delegated listener ─────────────────────────────────────── */
  let _listenerAttached = false;

  function _attachPickerListener() {
    if (_listenerAttached) return;
    _listenerAttached = true;

    const el = document.getElementById("picker-list");
    if (!el) return;

    el.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const name   = target.dataset.algoName;
      const action = target.dataset.action;
      if (!name) return;

      if (action === "select-run") AlgoBrowser.selectForRun(name);
    });
  }

  /* ── Render list ────────────────────────────────────────────── */
  function _renderList(list, q = "") {
    const el = document.getElementById("picker-list");

    if (!list.length) {
      el.innerHTML =
        `<div class="empty-state" style="padding:30px;">
           <div class="es-icon">🔍</div>
           <div class="es-sub">No matches.</div>
         </div>`;
      return;
    }

    const cats = {};
    list.forEach(a => {
      const c = a.algorithmCategory || "UNCATEGORIZED";
      (cats[c] = cats[c] || []).push(a);
    });

    /*
     * Each row: data-action="select-run"  data-algo-name="…"
     * The listener installed by _attachPickerListener() handles
     * the click — no onclick string, no encoding issues.
     */
    el.innerHTML = Object.keys(cats).sort().map(cat =>
      `<div style="padding:8px 14px 4px;font-size:10px;
                  font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:0.7px;
                  border-bottom:1px solid var(--border);">
         📁 ${UI.esc(cat)}
         <span class="badge badge-blue" style="font-size:9px;">
           ${cats[cat].length}
         </span>
       </div>
       ${cats[cat]
         .sort((a, b) => a.name.localeCompare(b.name))
         .map(alg =>
           `<div class="algo-list-row"
                 data-action="select-run"
                 data-algo-name="${UI.escAttr(alg.name)}"
                 style="cursor:pointer;">
              <div class="algo-list-name">
                ${UI.highlight(alg.name, q)}
              </div>
              <span class="badge badge-gray">
                ${UI.esc(alg.algorithmType || "")}
              </span>
            </div>`
         ).join("")}`
    ).join("");
  }

  return { open, close, onBackdrop, filter };
})();