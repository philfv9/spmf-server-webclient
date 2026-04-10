/*
 * SPMF-Web — Jobs View
 * Copyright (C) 2026 Philippe Fournier-Viger
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
"use strict";

const JobsView = (() => {

  /* ══════════════════════════════════════════════════════════════
     THRESHOLDS
     ──────────────────────────────────────────────────────────────
     HARD_LIMIT    — above this we never render inline by default.
                     Show a warning with an explicit "open anyway"
                     option instead.  50 000 chars ≈ a few thousand
                     typical pattern-mining output lines.

     PREVIEW_LINES — when below HARD_LIMIT we cap the visible DOM to
                     this many lines.  100 lines renders in < 5 ms.
  ══════════════════════════════════════════════════════════════ */
  const HARD_LIMIT    = 50_000;  // characters
  const PREVIEW_LINES = 100;     // lines shown in browser

  /* ── State ────────────────────────────────────────────────────── */
  let _all    = [];
  let _filter = "ALL";
  let _sort   = { col: "submittedAt", dir: "desc" };

  /*
   * We stash the raw output string here when the user triggers
   * "open in browser anyway" from the warning panel, so the click
   * handler can reach it without a second network request.
   * Keyed by jobId.
   */
  const _cachedOutput = {};

  /* ══════════════════════════════════════════════════════════════
     LOAD
  ══════════════════════════════════════════════════════════════ */
  async function load() {
    document.getElementById("jobs-body").innerHTML = `
      <tr><td colspan="6" style="padding:32px;">
        <div class="loading-center">
          <div class="spinner"></div> Loading…
        </div>
      </td></tr>`;

    closeDetail();

    try {
      const data = await API.GET("/api/jobs");
      _all = data.jobs || [];
      UI.showBadge("jobs-nav-badge", _all.length);
      UI.setText("jobs-subtitle",
        `${_all.length} job(s) in registry.`);
      _render();
    } catch(e) {
      document.getElementById("jobs-body").innerHTML = `
        <tr><td colspan="6"
                style="color:var(--danger);text-align:center;
                       padding:32px;">
          ${UI.esc(e.message)}
        </td></tr>`;
      UI.toast("error", "Jobs Load Failed", e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     FILTER & SORT
  ══════════════════════════════════════════════════════════════ */
  function setFilter(f) {
    _filter = f;
    document.querySelectorAll(".job-filter-btn")
      .forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(`jf-${f.toLowerCase()}`);
    if (btn) btn.classList.add("active");
    closeDetail();
    _render();
  }

  function sort(col) {
    _sort.dir = (_sort.col === col)
      ? (_sort.dir === "asc" ? "desc" : "asc")
      : "asc";
    _sort.col = col;
    _render();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER TABLE
  ══════════════════════════════════════════════════════════════ */
  function _render() {
    let list = _all;
    if (_filter !== "ALL")
      list = list.filter(j => j.status === _filter);

    list = [...list].sort((a, b) => {
      const av  = String(a[_sort.col] ?? "");
      const bv  = String(b[_sort.col] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return _sort.dir === "asc" ? cmp : -cmp;
    });

    const tbody = document.getElementById("jobs-body");

    if (!list.length) {
      tbody.innerHTML = `
        <tr><td colspan="6"
                style="text-align:center;padding:40px;
                       color:var(--text-muted);">
          No jobs found.
        </td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(j => {
      const statusCls = _statusBadgeCls(j.status);
      const resultBtn = (j.status === "DONE")
        ? `<button class="btn btn-primary btn-sm"
                   onclick="JobsView.showDetail(
                     '${UI.escAttr(j.jobId)}')">
             📄 Results
           </button>`
        : "";

      return `
        <tr>
          <td class="td-mono" title="${UI.esc(j.jobId || "")}">
            ${UI.esc((j.jobId || "").slice(0, 12))}…
          </td>
          <td style="font-weight:600;">
            ${UI.esc(j.algorithmName || "?")}
          </td>
          <td>
            <span class="badge ${statusCls}">
              ${UI.esc(j.status || "?")}
            </span>
          </td>
          <td class="text-muted text-sm">
            ${UI.fmtDate(j.submittedAt || "")}
          </td>
          <td class="text-sm">
            ${j.executionTimeMs != null
              ? j.executionTimeMs + " ms" : "—"}
          </td>
          <td>
            <div class="btn-row">
              ${resultBtn}
              <button class="btn btn-ghost btn-sm"
                onclick="JobsView.showDetail(
                  '${UI.escAttr(j.jobId)}')">
                Detail
              </button>
              <button class="btn btn-danger btn-sm"
                onclick="JobsView.confirmDelete(
                  '${UI.escAttr(j.jobId)}')">
                ✕
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  /* ══════════════════════════════════════════════════════════════
     JOB DETAIL PANEL
  ══════════════════════════════════════════════════════════════ */
  async function showDetail(jobId) {
    const card = document.getElementById("job-detail");
    const body = document.getElementById("job-detail-body");

    card.style.display = "block";
    body.innerHTML = `
      <div class="loading-center">
        <div class="spinner"></div> Loading job…
      </div>`;
    card.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const d = await API.GET(`/api/jobs/${jobId}`);
      body.innerHTML = _buildDetailHTML(d);

      if (d.status === "DONE") {
        await _loadResultIntoPanel(jobId);
      } else if (d.status === "FAILED") {
        await _loadConsoleIntoPanel(jobId);
      }
    } catch(e) {
      body.innerHTML = `
        <p style="color:var(--danger);padding:12px;">
          ${UI.esc(e.message)}
        </p>`;
    }
  }

  function closeDetail() {
    const card = document.getElementById("job-detail");
    if (card) card.style.display = "none";
  }

  function _buildDetailHTML(d) {
    const statusCls = _statusBadgeCls(d.status);

    const metaRows = [
      ["Job ID",         UI.esc(d.jobId || "—")],
      ["Algorithm",      UI.esc(d.algorithmName || "—")],
      ["Status",
       `<span class="badge ${statusCls}">
          ${UI.esc(d.status || "?")}
        </span>`],
      ["Submitted",      UI.esc(UI.fmtDate(d.submittedAt))],
      ["Execution Time", UI.esc(d.executionTimeMs != null
        ? `${d.executionTimeMs} ms` : "—")],
      ["Error",          UI.esc(d.errorMessage || "—")],
    ];

    const metaHTML = metaRows.map(([k, v]) =>
      `<tr><td>${UI.esc(k)}</td><td>${v}</td></tr>`
    ).join("");

    const hasSection =
      d.status === "DONE" || d.status === "FAILED";

    const pendingSection = hasSection ? `
      <hr style="border:none;border-top:1px solid var(--border);
                 margin:20px 0;"/>
      <div id="job-inline-result">
        <div class="loading-center">
          <div class="spinner"></div> Fetching data…
        </div>
      </div>` : "";

    return `
      <table class="kv-table" style="margin-bottom:4px;">
        <tbody>${metaHTML}</tbody>
      </table>
      ${pendingSection}`;
  }

  /* ══════════════════════════════════════════════════════════════
     RESULT LOADER
  ══════════════════════════════════════════════════════════════ */
  async function _loadResultIntoPanel(jobId) {
    const container = document.getElementById("job-inline-result");
    if (!container) return;

    let output   = "";
    let console_ = "";
    let execMs   = 0;

    try {
      const r = await API.GET(`/api/jobs/${jobId}/result`);
      output = r.outputData      || "";
      execMs = r.executionTimeMs ?? 0;
    } catch(e) {
      container.innerHTML = `
        <div style="color:var(--danger);font-size:13px;padding:8px 0;">
          ⚠ Could not fetch result: ${UI.esc(e.message)}
        </div>`;
      return;
    }

    try {
      const c = await API.GET(`/api/jobs/${jobId}/console`);
      console_ = c.consoleOutput || "";
    } catch(e) {}

    /* Cache output so "open anyway" handler can reach it */
    _cachedOutput[jobId] = { output, console_, execMs };

    if (output.length > HARD_LIMIT) {
      /* Show warning — do NOT render raw lines */
      container.innerHTML = _buildLargeFileWarning(
        jobId, output, console_, execMs
      );
      /* Visualization is safe (works on the raw string) */
      _deferredVisualize(output, `viz-inline-${jobId}`);
    } else {
      /* Safe to render — do it after a paint frame */
      const html = _buildResultHTML(jobId, output, console_, execMs);
      requestAnimationFrame(() => {
        container.innerHTML = html;
        _deferredVisualize(output, `viz-inline-${jobId}`);
      });
    }
  }

  async function _loadConsoleIntoPanel(jobId) {
    const container = document.getElementById("job-inline-result");
    if (!container) return;

    let console_ = "";
    try {
      const c = await API.GET(`/api/jobs/${jobId}/console`);
      console_ = c.consoleOutput || "";
    } catch(e) {}

    const consoleId = `console-inline-${jobId}`;
    requestAnimationFrame(() => {
      container.innerHTML = `
        <div class="code-wrap">
          <div class="code-toolbar">
            <span class="code-label">🖥 Console Output</span>
            <div class="toolbar-actions">
              <button class="btn btn-ghost btn-sm"
                      onclick="UI.download(
                        document.getElementById(
                          '${UI.escAttr(consoleId)}'
                        ).textContent,
                        'console_${UI.escAttr(jobId)}.txt'
                      )">⬇ Download</button>
            </div>
          </div>
          <div class="code-body code-tall"
               id="${consoleId}">${UI.esc(
                 console_ || "(no console output)"
               )}</div>
        </div>`;
    });
  }

  function _deferredVisualize(output, containerId) {
    requestAnimationFrame(() => {
      setTimeout(() => Visualizer.render(output, containerId), 0);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: "Open in browser anyway" handler
     Called from the warning panel's secondary button.
     Retrieves the cached output and renders the full result HTML.
  ══════════════════════════════════════════════════════════════ */
  function forceRenderInBrowser(jobId) {
    const container = document.getElementById("job-inline-result");
    if (!container) return;

    const cached = _cachedOutput[jobId];
    if (!cached) return;

    const { output, console_, execMs } = cached;

    container.innerHTML = `
      <div class="loading-center">
        <div class="spinner"></div>
        Rendering ${_countLines(output).toLocaleString()} lines —
        this may take a moment…
      </div>`;

    /*
     * Give the browser two frames to paint the spinner before
     * we do the heavy synchronous DOM work.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const html = _buildResultHTML(
          jobId, output, console_, execMs
        );
        container.innerHTML = html;
        _deferredVisualize(output, `viz-inline-${jobId}`);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     LARGE FILE WARNING
     ──────────────────────────────────────────────────────────────
     Two buttons:
       • Primary   — download directly (recommended, safe)
       • Secondary — force render in browser (user accepts risk)
  ══════════════════════════════════════════════════════════════ */
  function _buildLargeFileWarning(jobId, output, console_, execMs) {
    const totalLines = _countLines(output);
    const sizeLabel  = UI.formatBytes(output.length);
    const vizId      = `viz-inline-${jobId}`;
    const consoleId  = `console-inline-${jobId}`;

    const statsHTML  = _statsHTML(execMs, totalLines, output.length);
    const tabsHTML   = _tabsHTML(jobId);

    const rawPanel = `
      <div class="result-panel active"
           id="panel-raw-${UI.escAttr(jobId)}">

        <!-- Warning box -->
        <div class="large-file-warning">
          <div class="lfw-icon">⚠</div>
          <div class="lfw-body">
            <div class="lfw-title">
              Output Too Large to Display Safely
            </div>
            <div class="lfw-desc">
              This result contains
              <strong>${totalLines.toLocaleString()} lines</strong>
              (${sizeLabel}).
              Rendering it in the browser may freeze or crash
              the tab.<br/>
              We recommend downloading the file and opening it
              in a text editor or spreadsheet application.
            </div>

            <!-- Action buttons -->
            <div class="btn-row" style="margin-top:18px;">

              <!-- PRIMARY: download directly — no rendering -->
              <button class="btn btn-primary"
                      onclick="UI.download(
                        JobsView._getRawOutput('${UI.escAttr(jobId)}'),
                        'result_${UI.escAttr(jobId)}.txt'
                      )">
                ⬇ Download as File
                <span style="font-weight:400;font-size:11px;
                             margin-left:4px;opacity:0.8;">
                  (recommended)
                </span>
              </button>

              <!-- SECONDARY: force render — user accepts risk -->
              <button class="btn btn-ghost"
                      onclick="JobsView.forceRenderInBrowser(
                        '${UI.escAttr(jobId)}')">
                🖥 Open in Browser Anyway
                <span style="font-weight:400;font-size:11px;
                             margin-left:4px;opacity:0.7;">
                  (may be slow)
                </span>
              </button>

            </div>
          </div>
        </div>
      </div>`;

    const vizPanel     = _vizPanel(jobId, vizId);
    const consolePanel = _consolePanel(jobId, consoleId, console_);

    return statsHTML + tabsHTML + rawPanel + vizPanel + consolePanel;
  }

  /*
   * Accessor used by the inline onclick in the warning panel.
   * Returns the raw output string from the cache.
   */
  function _getRawOutput(jobId) {
    return (_cachedOutput[jobId] || {}).output || "";
  }

  /* ══════════════════════════════════════════════════════════════
     NORMAL RESULT HTML  (output ≤ HARD_LIMIT)
  ══════════════════════════════════════════════════════════════ */
  function _buildResultHTML(jobId, output, console_, execMs) {
    const allLines   = output.split("\n");
    const totalLines = allLines.length;
    const isCapped   = totalLines > PREVIEW_LINES;
    const shownLines = isCapped
      ? allLines.slice(0, PREVIEW_LINES)
      : allLines;

    const vizId     = `viz-inline-${jobId}`;
    const consoleId = `console-inline-${jobId}`;
    const rawId     = `raw-inline-${jobId}`;

    const statsHTML = _statsHTML(execMs, totalLines, output.length);
    const tabsHTML  = _tabsHTML(jobId);

    const capNotice = isCapped ? `
      <div class="preview-cap-notice">
        <span>
          ℹ Showing first
          <strong>${PREVIEW_LINES.toLocaleString()}</strong>
          of
          <strong>${totalLines.toLocaleString()}</strong>
          lines.
        </span>
        <button class="btn btn-ghost btn-sm"
                onclick="UI.download(
                  JobsView._getRawOutput('${UI.escAttr(jobId)}'),
                  'result_${UI.escAttr(jobId)}.txt'
                )">
          ⬇ Download Full Result
        </button>
      </div>` : "";

    const rawPanel = `
      <div class="result-panel active"
           id="panel-raw-${UI.escAttr(jobId)}">
        ${capNotice}
        <div class="code-wrap">
          <div class="code-toolbar">
            <span class="code-label">
              📄 Raw Output
              ${isCapped
                ? `<span class="badge badge-orange"
                         style="margin-left:6px;">
                     first ${PREVIEW_LINES} lines
                   </span>`
                : ""}
            </span>
            <div class="toolbar-actions">
              <button class="btn btn-ghost btn-sm"
                      onclick="JobsView.copyInline(
                        '${UI.escAttr(rawId)}')">
                ⎘ Copy
              </button>
              <button class="btn btn-ghost btn-sm"
                      onclick="UI.download(
                        JobsView._getRawOutput(
                          '${UI.escAttr(jobId)}'),
                        'result_${UI.escAttr(jobId)}.txt'
                      )">
                ⬇ Download
              </button>
            </div>
          </div>
          <div id="${rawId}"
               class="code-lined"
               style="max-height:2000px;overflow-y:auto;">
            ${_linedHTML(shownLines)}
          </div>
        </div>
      </div>`;

    const vizPanel     = _vizPanel(jobId, vizId);
    const consolePanel = _consolePanel(jobId, consoleId, console_);

    return statsHTML + tabsHTML + rawPanel + vizPanel + consolePanel;
  }

  /* ══════════════════════════════════════════════════════════════
     SHARED PANEL BUILDERS
  ══════════════════════════════════════════════════════════════ */
  function _statsHTML(execMs, totalLines, totalChars) {
    return `
      <div style="display:grid;
                  grid-template-columns:repeat(auto-fill,
                    minmax(130px,1fr));
                  gap:10px;margin-bottom:16px;">
        <div class="stat-tile color-success">
          <div class="stat-label">Exec Time</div>
          <div class="stat-value">${UI.esc(String(execMs))}</div>
          <div class="stat-sub">ms</div>
        </div>
        <div class="stat-tile color-accent">
          <div class="stat-label">Lines</div>
          <div class="stat-value">
            ${totalLines.toLocaleString()}
          </div>
          <div class="stat-sub">output rows</div>
        </div>
        <div class="stat-tile color-purple">
          <div class="stat-label">Size</div>
          <div class="stat-value">
            ${UI.formatBytes(totalChars)}
          </div>
          <div class="stat-sub">total</div>
        </div>
      </div>`;
  }

  function _tabsHTML(jobId) {
    return `
      <div class="result-tabstrip"
           id="tabs-inline-${UI.escAttr(jobId)}">
        <button class="result-tab active"
                onclick="JobsView.switchInlineTab(
                  '${UI.escAttr(jobId)}','raw',this)">
          📄 Raw Output
        </button>
        <button class="result-tab"
                onclick="JobsView.switchInlineTab(
                  '${UI.escAttr(jobId)}','viz',this)">
          📊 Visualization
        </button>
        <button class="result-tab"
                onclick="JobsView.switchInlineTab(
                  '${UI.escAttr(jobId)}','console',this)">
          🖥 Console
        </button>
      </div>`;
  }

  function _vizPanel(jobId, vizId) {
    return `
      <div class="result-panel"
           id="panel-viz-${UI.escAttr(jobId)}">
        <div id="${vizId}">
          <div class="loading-center">
            <div class="spinner sm"></div>
            Building visualization…
          </div>
        </div>
      </div>`;
  }

  function _consolePanel(jobId, consoleId, console_) {
    return `
      <div class="result-panel"
           id="panel-console-${UI.escAttr(jobId)}">
        <div class="code-wrap">
          <div class="code-toolbar">
            <span class="code-label">🖥 Console Output</span>
            <div class="toolbar-actions">
              <button class="btn btn-ghost btn-sm"
                      onclick="UI.download(
                        document.getElementById(
                          '${UI.escAttr(consoleId)}'
                        ).textContent,
                        'console_${UI.escAttr(jobId)}.txt'
                      )">⬇ Download</button>
            </div>
          </div>
          <div class="code-body code-tall"
               id="${consoleId}">${UI.esc(
                 console_ || "(no console output)"
               )}</div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     LINE-NUMBERED HTML
  ══════════════════════════════════════════════════════════════ */
  function _linedHTML(lines) {
    let gutterHTML  = "";
    let contentHTML = "";
    for (let i = 0; i < lines.length; i++) {
      gutterHTML  += `<div>${i + 1}</div>`;
      contentHTML += `<div>${
        lines[i] === "" ? "&#8203;" : UI.esc(lines[i])
      }</div>`;
    }
    return `
      <div class="line-gutter">${gutterHTML}</div>
      <div class="line-content">${contentHTML}</div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     INLINE TAB SWITCHER
  ══════════════════════════════════════════════════════════════ */
  function switchInlineTab(jobId, name, btn) {
    ["raw", "viz", "console"].forEach(t => {
      const p = document.getElementById(`panel-${t}-${jobId}`);
      if (p) p.classList.remove("active");
    });
    const strip = document.getElementById(`tabs-inline-${jobId}`);
    if (strip)
      strip.querySelectorAll(".result-tab")
        .forEach(b => b.classList.remove("active"));
    const target = document.getElementById(`panel-${name}-${jobId}`);
    if (target) target.classList.add("active");
    if (btn)    btn.classList.add("active");
  }

  /* ══════════════════════════════════════════════════════════════
     COPY INLINE OUTPUT
  ══════════════════════════════════════════════════════════════ */
  async function copyInline(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const contentEl = el.querySelector(".line-content");
    const text = contentEl
      ? Array.from(contentEl.querySelectorAll("div"))
          .map(d => d.textContent === "\u200B" ? "" : d.textContent)
          .join("\n")
      : el.textContent;
    try {
      await navigator.clipboard.writeText(text);
      UI.toast("success", "Copied", "Output copied to clipboard.");
    } catch(e) {
      UI.toast("error", "Copy Failed", e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════════════════════════ */
  function confirmDelete(jobId) {
    UI.confirmDialog(
      `Delete job ${jobId}? This cannot be undone.`,
      () => _doDelete(jobId)
    );
  }

  async function _doDelete(jobId) {
    try {
      await API.DELETE(`/api/jobs/${jobId}`);
      UI.toast("success", "Deleted", `Job ${jobId} removed.`);
      delete _cachedOutput[jobId];
      closeDetail();
      await load();
    } catch(e) {
      UI.toast("error", "Delete Failed", e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PRIVATE UTILITIES
  ══════════════════════════════════════════════════════════════ */
  function _countLines(str) {
    let n = 1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\n") n++;
    }
    return n;
  }

  function _statusBadgeCls(status) {
    return {
      DONE:    "badge-green",
      FAILED:  "badge-red",
      RUNNING: "badge-blue",
      PENDING: "badge-gray",
    }[status] || "badge-gray";
  }

  /* ── Public API ───────────────────────────────────────────────── */
  return {
    load,
    setFilter,
    sort,
    showDetail,
    closeDetail,
    switchInlineTab,
    copyInline,
    confirmDelete,
    forceRenderInBrowser,
    /* Exposed so inline onclick handlers in generated HTML can reach
       the cached output without a second network request.           */
    _getRawOutput,
  };

})();