/*
 * SPMF-Web — Run Job Workflow
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

const RunJob = (() => {

  /* ── State ────────────────────────────────────────────────────── */
  let _algo         = null;   // full algorithm descriptor object
  let _inputMode    = "file"; // "file" | "paste"
  let _fileContent  = "";
  let _pasteContent = "";
  let _pollTimer    = null;
  let _pollElapsed  = 0;
  let _jobId        = null;
  let _lastOutput   = "";
  let _lastConsole  = "";
  let _previewOpen  = true;

  /*
   * HARD_LIMIT  — above this we never render inline by default.
   *               Show a warning with an explicit "open anyway" option.
   *               50 000 chars ≈ a few thousand typical output lines.
   *
   * PREVIEW_LINES — when below HARD_LIMIT we cap the visible DOM to
   *               this many lines.  100 lines renders in < 5 ms.
   */
  const _HARD_LIMIT    = 50_000;
  const _PREVIEW_LINES = 100;

  /* ── Algorithm type-ahead ─────────────────────────────────────── */
  let _typeTimer = null;

  function onAlgoType() {
    clearTimeout(_typeTimer);
    const name = document.getElementById("run-algo-name").value.trim();
    if (!name) { _clearAlgo(); return; }
    _typeTimer = setTimeout(() => loadDescriptor(name), 350);
  }

  async function loadDescriptor(name) {
    try {
      const d = await API.GET(
        `/api/algorithms/${encodeURIComponent(name)}`
      );
      _algo = d;
      _renderAlgoSummary(d);
      _renderParamForm(d.parameters || []);
      _markStepDone("step1", `Algorithm: ${d.name}`);
      UI.clearErr("err-algo");
      _updateSubmitSummary();
    } catch(e) {
      _clearAlgo();
      if (name.length > 2)
        UI.showErr("err-algo", `Not found: ${e.message}`);
    }
  }

  function _clearAlgo() {
    _algo = null;
    document.getElementById("run-algo-summary").style.display = "none";
    document.getElementById("param-form").innerHTML =
      `<p class="text-muted text-sm">Select an algorithm first.</p>`;
    _resetStep("step1");
    _updateSubmitSummary();
  }

  function _renderAlgoSummary(d) {
    const el = document.getElementById("run-algo-summary");
    el.style.display = "block";
    const p        = d.parameters || [];
    const total    = p.length;
    const required = d.numberOfMandatoryParameters || 0;
    const optional = total - required;

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;
                  padding:10px 13px;background:var(--bg3);
                  border:1px solid var(--border);border-radius:var(--radius);
                  margin-top:8px;">
        <span class="badge badge-purple">
          ${UI.esc(d.algorithmCategory || "")}
        </span>
        <span class="badge badge-cyan">
          ${UI.esc(d.algorithmType || "")}
        </span>
        <span class="text-muted text-sm">
          ${required} required
          ${optional > 0
            ? `· <span style="color:var(--text-muted);">
                 ${optional} optional
               </span>`
            : ""}
        </span>
        ${d.documentationURL
          ? `<a class="text-link text-sm"
                href="${UI.escAttr(d.documentationURL)}"
                target="_blank">Docs ↗</a>`
          : ""}
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;"
                onclick="AlgoBrowser.openDetail(
                  '${UI.escAttr(d.name)}')">
          Full Detail →
        </button>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     PARAMETER FORM
     KEY RULES
       • Required params  → pre-filled with example value
       • Optional params  → field is EMPTY; example shown as placeholder
       • Validation only checks required params
       • Payload trims trailing empty optional params before sending
  ═══════════════════════════════════════════════════════════════ */

  function _renderParamForm(params) {
    const container = document.getElementById("param-form");

    if (!params.length) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;
                    padding:12px 13px;
                    background:var(--success-dim);
                    border:1px solid rgba(5,150,105,0.20);
                    border-radius:var(--radius);color:var(--success);">
          ✅ No parameters required.
        </div>`;
      _markStepDone("step3", "No parameters needed");
      return;
    }

    const mandatory = _algo
      ? (_algo.numberOfMandatoryParameters || 0)
      : params.length;

    const inputs = params.map((p, i) => {
      const id       = `pf_${i}`;
      const label    = p.name || `Parameter ${i + 1}`;
      const example  = p.example != null ? String(p.example) : "";
      const isOpt    = p.isOptional || (i >= mandatory);
      const type     = (p.parameterType || "").toLowerCase();

      /*
       * IMPORTANT:
       *   - required  → value  = example  (pre-filled, user can change)
       *   - optional  → value  = ""       (empty)
       *                 placeholder = example  (hint only)
       */
      const preValue  = isOpt ? ""      : example;
      const hintValue = isOpt ? example : example; // placeholder always shows example

      let ctrl;

      if (type === "boolean") {
        /*
         * For boolean optional params the checkbox starts UNCHECKED
         * when optional, CHECKED when the example is "true" and required.
         */
        const startChecked = !isOpt && example === "true";
        ctrl = `
          <label class="toggle-row" style="width:fit-content;">
            <span class="toggle">
              <input type="checkbox"
                     id="${id}"
                     data-optional="${isOpt}"
                     ${startChecked ? "checked" : ""}/>
              <span class="toggle-track"></span>
            </span>
            <span class="toggle-label">Enable</span>
          </label>`;

      } else if (type === "integer" || type === "long") {
        ctrl = `
          <input type="number"
                 id="${id}"
                 data-optional="${isOpt}"
                 value="${UI.esc(preValue)}"
                 placeholder="${UI.esc(hintValue)}"
                 step="1"/>`;

      } else if (type === "double" || type === "float") {
        ctrl = `
          <input type="number"
                 id="${id}"
                 data-optional="${isOpt}"
                 value="${UI.esc(preValue)}"
                 placeholder="${UI.esc(hintValue)}"
                 step="any"/>`;

      } else {
        ctrl = `
          <input type="text"
                 id="${id}"
                 data-optional="${isOpt}"
                 value="${UI.esc(preValue)}"
                 placeholder="${UI.esc(hintValue)}"/>`;
      }

      /* Visual treatment differs for required vs optional */
      const badgeHTML = isOpt
        ? `<span class="badge badge-gray"   style="font-size:10px;">optional</span>`
        : `<span class="badge badge-orange" style="font-size:10px;">required</span>`;

      const hintHTML = isOpt
        ? `<div class="field-hint">
             Optional — leave blank to use the server default
             ${example ? `(e.g. <code>${UI.esc(example)}</code>)` : ""}.
           </div>`
        : "";

      return `
        <div style="background:var(--bg3);
                    border:1px solid var(--border);
                    border-radius:var(--radius);
                    padding:12px 13px;
                    opacity:${isOpt ? "0.9" : "1"};">
          <div style="display:flex;align-items:center;gap:6px;
                      margin-bottom:7px;">
            <span class="badge badge-blue" style="font-size:10px;">
              ${i + 1}
            </span>
            <span style="font-weight:600;font-size:13px;">
              ${UI.esc(label)}
            </span>
            ${badgeHTML}
            <span class="text-xs text-muted">
              ${UI.esc(p.parameterType || "")}
            </span>
          </div>
          ${ctrl}
          ${hintHTML}
        </div>`;
    });

    container.innerHTML =
      `<div style="display:flex;flex-direction:column;gap:9px;">
         ${inputs.join("")}
       </div>`;

    _markStepActive("step3");
  }

  /* ── Collect params for submission ────────────────────────────── */
  /**
   * Collect parameter values from the form.
   *
   * Strategy:
   *  1. Collect ALL field values in order.
   *  2. Trim trailing optional empty strings from the end of the array
   *     so the server never receives empty strings for omitted optional
   *     params that trail the list.
   *  3. Any optional param that appears BEFORE a filled param is sent
   *     as an empty string — the server must handle that gracefully
   *     (this matches how the Python CLI works when params are positional).
   */
  function _collectParams() {
    const inputs = document.getElementById("param-form")
      .querySelectorAll("[id^='pf_']");

    const raw = Array.from(inputs).map(el => {
      if (el.type === "checkbox") {
        /* For optional unchecked booleans send empty string
           so the server uses its default. */
        const isOpt = el.dataset.optional === "true";
        if (isOpt && !el.checked) return "";
        return el.checked ? "true" : "false";
      }
      return el.value.trim();
    });

    /* Drop trailing empty optional params */
    let lastFilled = raw.length - 1;
    while (lastFilled >= 0 && raw[lastFilled] === "") {
      /* Only drop if that position is optional */
      const el = document.getElementById(`pf_${lastFilled}`);
      const isOpt = el && el.dataset.optional === "true";
      if (!isOpt) break;
      lastFilled--;
    }

    return raw.slice(0, lastFilled + 1);
  }

  /* ── Validate before submission ───────────────────────────────── */
  /**
   * Returns { ok:true } or { ok:false, msg:string }.
   * Only required (non-optional) parameters are checked.
   */
  function _validateParams() {
    if (!_algo) return { ok: true };

    const mandatory = _algo.numberOfMandatoryParameters || 0;

    for (let i = 0; i < mandatory; i++) {
      const el = document.getElementById(`pf_${i}`);
      if (!el) continue;

      if (el.type === "checkbox") continue; // boolean always has a value

      if (el.value.trim() === "") {
        const params = _algo.parameters || [];
        const name   = params[i]?.name || `Parameter ${i + 1}`;
        return {
          ok:  false,
          msg: `"${name}" is required (parameter ${i + 1}).`,
        };
      }
    }
    return { ok: true };
  }

  /* ── Input data ───────────────────────────────────────────────── */
  function setInputMode(mode, btn) {
    _inputMode = mode;
    document.querySelectorAll(".tab-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("input-file-panel").style.display =
      mode === "file" ? "" : "none";
    document.getElementById("input-paste-panel").style.display =
      mode === "paste" ? "" : "none";
    _hidePreview();
  }

  function onDragOver(e) {
    e.preventDefault();
    document.getElementById("drop-zone").classList.add("drag-over");
  }
  function onDragLeave() {
    document.getElementById("drop-zone").classList.remove("drag-over");
  }
  function onDrop(e) {
    e.preventDefault();
    document.getElementById("drop-zone").classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    if (f) _readFile(f);
  }
  function onFileChosen(e) {
    const f = e.target.files[0];
    if (f) _readFile(f);
  }

  function _readFile(file) {
    const fr = new FileReader();
    fr.onload = ev => {
      _fileContent = ev.target.result;
      document.getElementById("file-info-name").textContent =
        file.name;
      document.getElementById("file-info-size").textContent =
        UI.formatBytes(file.size);
      document.getElementById("file-info").classList.add("show");
      _showPreview(_fileContent);
      UI.clearErr("err-input");
      _markStepDone("step2",
        `${file.name} (${UI.formatBytes(file.size)})`);
      _updateSubmitSummary();
    };
    fr.onerror = () =>
      UI.toast("error", "Read Error", "Could not read the file.");
    fr.readAsText(file, "utf-8");
  }

  function clearFile() {
    _fileContent = "";
    document.getElementById("file-picker").value = "";
    document.getElementById("file-info").classList.remove("show");
    _hidePreview();
    _resetStep("step2");
  }

  function onPasteInput() {
    _pasteContent = document.getElementById("paste-area").value;
    const lines   = _pasteContent.split("\n").length;
    document.getElementById("paste-stats").textContent =
      `${lines} lines · ${_pasteContent.length} characters`;

    if (_pasteContent.trim()) {
      _showPreview(_pasteContent);
      UI.clearErr("err-input");
      _markStepDone("step2", `${lines} lines pasted`);
      _updateSubmitSummary();
    } else {
      _hidePreview();
      _resetStep("step2");
    }
  }

  function _getInput() {
    return _inputMode === "paste" ? _pasteContent : _fileContent;
  }

  function _showPreview(text) {
    const lines = text.split("\n");
    document.getElementById("preview-body").textContent =
      lines.slice(0, 15).join("\n");
    document.getElementById("preview-badge").textContent =
      `first ${Math.min(15, lines.length)} of ${lines.length} lines`;
    document.getElementById("preview-wrap").style.display = "block";
  }

  function _hidePreview() {
    document.getElementById("preview-wrap").style.display = "none";
  }

  function togglePreview() {
    _previewOpen = !_previewOpen;
    const body = document.getElementById("preview-body");
    body.style.maxHeight = _previewOpen ? "150px" : "0";
    body.style.overflow  = _previewOpen ? "auto"  : "hidden";
    document.getElementById("preview-toggle-lbl").textContent =
      _previewOpen ? "Collapse" : "Expand";
  }

  /* ── Step card helpers ────────────────────────────────────────── */
  function toggleStep(id) {
    document.getElementById(id).classList.toggle("collapsed");
  }

  function _markStepDone(id, sub) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove("active");
    card.classList.add("complete", "collapsed");
    const numEl = document.getElementById(`${id}-num`);
    if (numEl) numEl.textContent = "✓";
    const subEl = document.getElementById(`${id}-sub`);
    if (subEl) subEl.textContent = sub || "";

    /* Auto-open the next step */
    const next = { step1:"step2", step2:"step3", step3:"step4" };
    if (next[id]) {
      const nCard = document.getElementById(next[id]);
      if (nCard && !nCard.classList.contains("complete")) {
        nCard.classList.remove("collapsed");
        _markStepActive(next[id]);
      }
    }
  }

  function _markStepActive(id) {
    const card = document.getElementById(id);
    if (card && !card.classList.contains("complete"))
      card.classList.add("active");
  }

  function _resetStep(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove("complete", "active");
    const n = document.getElementById(`${id}-num`);
    if (n) n.textContent = id.replace("step", "");
  }

  function _updateSubmitSummary() {
    const el = document.getElementById("submit-summary");
    if (!el) return;
    if (_algo && _getInput().trim()) {
      const mandatory = _algo.numberOfMandatoryParameters || 0;
      el.innerHTML = `
        <span class="badge badge-green">✓ Ready</span>
        <span class="text-sm text-muted" style="margin-left:6px;">
          <strong>${UI.esc(_algo.name)}</strong> ·
          ${_getInput().split("\n").length} lines ·
          ${mandatory} required param(s)
        </span>`;
    } else {
      el.innerHTML =
        `<span class="text-muted text-sm">
           Configure all steps above, then submit.
         </span>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     JOB SUBMISSION
  ═══════════════════════════════════════════════════════════════ */
  async function submit() {
    let valid = true;

    /* 1. Algorithm selected? */
    if (!_algo) {
      UI.showErr("err-algo", "Please select a valid algorithm.");
      valid = false;
    } else {
      UI.clearErr("err-algo");
    }

    /* 2. Input data provided? */
    const inputText = _getInput().trim();
    if (!inputText) {
      UI.showErr("err-input", "Please provide input data.");
      valid = false;
    } else {
      UI.clearErr("err-input");
    }

    if (!valid) return;

    /* 3. Required params filled? (optional params are NOT checked) */
    const paramCheck = _validateParams();
    if (!paramCheck.ok) {
      UI.showErr("err-params", paramCheck.msg);
      return;
    }
    UI.clearErr("err-params");

    /* 4. Build payload */
    const enc     = document.getElementById("run-encoding").value;
    let inputData = inputText;
    if (enc === "base64") {
      inputData = btoa(unescape(encodeURIComponent(inputText)));
    }

    /* Collect params — trailing empty optionals are stripped */
    const params = _collectParams();

    const payload = {
      algorithmName: _algo.name,
      parameters:    params,
      inputData,
      inputEncoding: enc,
    };

    /* 5. Show progress UI */
    document.getElementById("run-output").style.display = "block";
    document.getElementById("result-card").style.display = "none";
    document.getElementById("submit-btn").disabled = true;
    _setBanner("pending", "Submitting…", "");
    _setProgress("indeterminate");
    document.getElementById("run-output")
      .scrollIntoView({ behavior: "smooth", block: "start" });

    /* 6. POST to server */
    try {
      const resp = await API.POST("/api/run", payload);
      _jobId = resp.jobId;
      if (!_jobId) throw new Error("Server did not return a jobId.");
      UI.setText("run-job-id", _jobId);
      _setBanner("running", "Job Running…",
        `Polling every ${Config.get().poll}s`);
      UI.toast("info", "Job Accepted", `ID: ${_jobId}`);
      _startPolling(_jobId);
    } catch(e) {
      _setBanner("failed", "Submission Failed", e.message);
      _setProgress("none");
      document.getElementById("submit-btn").disabled = false;
      UI.toast("error", "Submission Failed", e.message);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     POLLING
  ═══════════════════════════════════════════════════════════════ */
  function _startPolling(jobId) {
    _pollElapsed = 0;
    _pollTimer   = setInterval(
      () => _poll(jobId),
      Config.get().poll * 1000
    );
  }

  async function _poll(jobId) {
    _pollElapsed += Config.get().poll;
    UI.setText("poll-elapsed", `${_pollElapsed}s elapsed`);

    if (_pollElapsed >= Config.get().timeout) {
      _stopPolling();
      _setBanner("failed", "Timeout",
        `No result after ${Config.get().timeout}s.`);
      UI.toast("warning", "Timeout",
        "Polling stopped. The job may still be running on the server.");
      return;
    }

    try {
      const d = await API.GET(`/api/jobs/${jobId}`);
      const s = d.status;
      if (s === "DONE" || s === "FAILED") {
        _stopPolling();
        await _finalize(jobId, s, d);
      } else {
        _setBanner("running",
          `Status: ${s}`, `${_pollElapsed}s elapsed`);
      }
    } catch(e) {
      _stopPolling();
      _setBanner("failed", "Polling Error", e.message);
      UI.toast("error", "Polling Error", e.message);
    }
  }

  function _stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    document.getElementById("submit-btn").disabled = false;
    _setProgress("none");
  }

  /* ═══════════════════════════════════════════════════════════════
     FINALIZE — fetch result + console, decide how to display
  ═══════════════════════════════════════════════════════════════ */
  async function _finalize(jobId, status, pollData) {
    const execMs = pollData.executionTimeMs ?? 0;

    /* ── Job failed ─────────────────────────────────────────────── */
    if (status === "FAILED") {
      _setBanner("failed", "Job Failed",
        pollData.errorMessage || "Unknown error.");
      UI.toast("error", "Job Failed",
        pollData.errorMessage || "");

      let console_ = "";
      try {
        const c = await API.GET(`/api/jobs/${jobId}/console`);
        console_ = c.consoleOutput || "";
      } catch(e) {}

      _lastOutput  = "";
      _lastConsole = console_;
      document.getElementById("console-output-body").textContent =
        console_ || "(no console output)";

      if (document.getElementById("run-cleanup").checked)
        try { await API.DELETE(`/api/jobs/${jobId}`); } catch(e) {}
      return;
    }

    /* ── Job done ───────────────────────────────────────────────── */
    _setBanner("done", `Completed in ${execMs} ms`, `Job ${jobId}`);
    _setProgress("full");

    let output = ""; let console_ = "";

    try {
      const r = await API.GET(`/api/jobs/${jobId}/result`);
      output = r.outputData || "";
    } catch(e) {
      UI.toast("error", "Result Fetch Failed", e.message);
    }

    try {
      const c = await API.GET(`/api/jobs/${jobId}/console`);
      console_ = c.consoleOutput || "";
    } catch(e) {}

    _lastOutput  = output;
    _lastConsole = console_;

    /* ── Stats tiles — always safe to render ────────────────────── */
    const totalLines = output ? output.split("\n").length : 0;
    _renderStats(execMs, totalLines, output.length);

    /* ── Console — always safe ──────────────────────────────────── */
    document.getElementById("console-output-body").textContent =
      console_ || "(no console output)";

    /* ── Size gate ──────────────────────────────────────────────── */
    if (output.length > _HARD_LIMIT) {
      /*
       * Output is too large to render safely in the DOM.
       * Show the warning panel instead of raw lines.
       * Visualization is still offered — it works on the raw string.
       */
      _renderLargeOutputWarning(output, totalLines);
    } else {
      /* Safe to render — cap at _PREVIEW_LINES for DOM performance */
      _renderSafeOutput(output, totalLines);
      /* Visualization */
      _deferVisualize(output);
    }

    /* Show and scroll to result card */
    document.getElementById("result-card").style.display = "block";
    document.getElementById("result-card")
      .scrollIntoView({ behavior: "smooth", block: "start" });

    UI.toast("success", "Job Complete",
      `${_algo?.name || ""} · ${execMs} ms`);

    Config.pushRecent({
      algo:   _algo?.name || "?",
      execMs,
      jobId,
      lines:  totalLines,
      ts:     new Date().toISOString(),
    });

    if (document.getElementById("run-cleanup").checked)
      try { await API.DELETE(`/api/jobs/${jobId}`); } catch(e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     STATS TILES
     ──────────────────────────────────────────────────────────────
     Writes into the three fixed stat elements that already exist
     in the Run Job HTML (r-exec, r-lines, r-chars).
     Also injects a proper stat-tile grid above the result tabs
     so the presentation matches jobs.js.
  ═══════════════════════════════════════════════════════════════ */
  function _renderStats(execMs, totalLines, totalChars) {
    /* Legacy simple text fields — kept for any HTML that still
       references them directly */
    UI.setText("r-exec",  `${execMs} ms`);
    UI.setText("r-lines", totalLines.toLocaleString());
    UI.setText("r-chars", totalChars.toLocaleString());

    /* Rich stat-tile grid — injected into the dedicated slot */
    const slot = document.getElementById("result-stats-slot");
    if (!slot) return;
    slot.innerHTML = `
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
          <div class="stat-value">${totalLines.toLocaleString()}</div>
          <div class="stat-sub">output rows</div>
        </div>
        <div class="stat-tile color-purple">
          <div class="stat-label">Size</div>
          <div class="stat-value">${UI.formatBytes(totalChars)}</div>
          <div class="stat-sub">total</div>
        </div>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     SAFE OUTPUT RENDERER  (output ≤ _HARD_LIMIT)
     ──────────────────────────────────────────────────────────────
     Caps DOM at _PREVIEW_LINES lines and shows a notice + download
     button when the output is longer, exactly as jobs.js does.
  ═══════════════════════════════════════════════════════════════ */
  function _renderSafeOutput(output, totalLines) {
    const container = document.getElementById("raw-output-body");
    if (!container) return;

    const allLines  = output ? output.split("\n") : [];
    const isCapped  = totalLines > _PREVIEW_LINES;
    const shown     = isCapped
      ? allLines.slice(0, _PREVIEW_LINES)
      : allLines;

    const capNotice = isCapped ? `
      <div class="preview-cap-notice">
        <span>
          ℹ Showing first
          <strong>${_PREVIEW_LINES.toLocaleString()}</strong>
          of
          <strong>${totalLines.toLocaleString()}</strong>
          lines.
        </span>
        <button class="btn btn-ghost btn-sm"
                onclick="RunJob.downloadOutput()">
          ⬇ Download Full Result
        </button>
      </div>` : "";

    const toolbar = `
      <div class="code-wrap">
        <div class="code-toolbar">
          <span class="code-label">
            📄 Raw Output
            ${isCapped
              ? `<span class="badge badge-orange"
                       style="margin-left:6px;">
                   first ${_PREVIEW_LINES} lines
                 </span>`
              : ""}
          </span>
          <div class="toolbar-actions">
            <button class="btn btn-ghost btn-sm"
                    onclick="RunJob.copyOutput()">
              ⎘ Copy
            </button>
            <button class="btn btn-ghost btn-sm"
                    onclick="RunJob.downloadOutput()">
              ⬇ Download
            </button>
          </div>
        </div>
        <div class="code-lined"
             style="max-height:2000px;overflow-y:auto;">
          ${_linedHTML(shown)}
        </div>
      </div>`;

    container.innerHTML = capNotice + toolbar;
  }

  /* ═══════════════════════════════════════════════════════════════
     LARGE OUTPUT WARNING  (output > _HARD_LIMIT)
     ──────────────────────────────────────────────────────────────
     Two explicit choices:
       1. Download directly  (recommended, zero DOM cost)
       2. Open in browser    (user accepts the performance risk)
     Visualization is still rendered — it works on the raw string.
  ═══════════════════════════════════════════════════════════════ */
  function _renderLargeOutputWarning(output, totalLines) {
    const sizeLabel = UI.formatBytes(output.length);
    const container = document.getElementById("raw-output-body");
    if (!container) return;

    container.innerHTML = `
      <div class="large-file-warning">
        <div class="lfw-icon">⚠</div>
        <div class="lfw-body">
          <div class="lfw-title">
            Output Too Large to Display Safely
          </div>
          <div class="lfw-desc">
            This result contains
            <strong>${totalLines.toLocaleString()} lines</strong>
            (${UI.esc(sizeLabel)}).
            Rendering it in the browser may freeze or crash
            the tab.<br/>
            We recommend downloading the file and opening it
            in a text editor or spreadsheet application.
          </div>
          <div class="btn-row" style="margin-top:18px;">

            <!-- PRIMARY: direct file download -->
            <button class="btn btn-primary"
                    onclick="RunJob.downloadOutput()">
              ⬇ Download as File
              <span style="font-weight:400;font-size:11px;
                           margin-left:4px;opacity:0.8;">
                (recommended)
              </span>
            </button>

            <!-- SECONDARY: force render, user accepts risk -->
            <button class="btn btn-ghost"
                    onclick="RunJob.forceRenderOutput()">
              🖥 Open in Browser Anyway
              <span style="font-weight:400;font-size:11px;
                           margin-left:4px;opacity:0.7;">
                (may be slow)
              </span>
            </button>

          </div>
        </div>
      </div>`;

    /* Visualization is still rendered — string-based, safe */
    _deferVisualize(output);
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC: force render in browser
     Called by the "Open in Browser Anyway" button.
     Renders ALL lines (no cap) with the same toolbar as the normal
     path so Copy / Download remain available.
  ═══════════════════════════════════════════════════════════════ */
  function forceRenderOutput() {
    const container = document.getElementById("raw-output-body");
    if (!container || !_lastOutput) return;

    const totalLines = _lastOutput.split("\n").length;

    container.innerHTML = `
      <div class="loading-center">
        <div class="spinner"></div>
        Rendering ${totalLines.toLocaleString()} lines —
        please wait…
      </div>`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const allLines = _lastOutput.split("\n");
        const html = `
          <div class="code-wrap">
            <div class="code-toolbar">
              <span class="code-label">📄 Raw Output</span>
              <div class="toolbar-actions">
                <button class="btn btn-ghost btn-sm"
                        onclick="RunJob.copyOutput()">
                  ⎘ Copy
                </button>
                <button class="btn btn-ghost btn-sm"
                        onclick="RunJob.downloadOutput()">
                  ⬇ Download
                </button>
              </div>
            </div>
            <div class="code-lined"
                 style="max-height:2000px;overflow-y:auto;">
              ${_linedHTML(allLines)}
            </div>
          </div>`;
        container.innerHTML = html;
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     LINE-NUMBERED HTML  (mirrors jobs.js _linedHTML)
     ──────────────────────────────────────────────────────────────
     Builds a two-column flex layout:
       .line-gutter   — right-aligned line numbers
       .line-content  — one <div> per source line
     Empty lines get a zero-width space so they keep their height.
  ═══════════════════════════════════════════════════════════════ */
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

  /* ── Deferred visualization helper ───────────────────────────── */
  function _deferVisualize(output) {
    requestAnimationFrame(() => {
      setTimeout(() => Visualizer.render(output, "viz-body"), 0);
    });
  }

  /* ── Result tab switching ─────────────────────────────────────── */
  function switchTab(name, btn) {
    document.querySelectorAll(".result-panel")
      .forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".result-tab")
      .forEach(b => b.classList.remove("active"));
    document.getElementById(`rtab-${name}`).classList.add("active");
    if (btn) btn.classList.add("active");
  }

  /* ── Copy / Download ──────────────────────────────────────────── */
  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(_lastOutput);
      UI.toast("success", "Copied", "Output copied to clipboard.");
    } catch(e) {
      UI.toast("error", "Copy Failed", e.message);
    }
  }

  function copyJobId() {
    navigator.clipboard.writeText(_jobId || "")
      .then(() => UI.toast("info", "Copied", `Job ID: ${_jobId}`))
      .catch(() => {});
  }

  function downloadOutput() {
    UI.download(
      _lastOutput,
      `spmf_result_${_algo?.name || "output"}.txt`
    );
  }

  function downloadConsole() {
    UI.download(_lastConsole, "spmf_console.txt");
  }

  /* ── Status banner ────────────────────────────────────────────── */
  function _setBanner(level, title, sub) {
    const icons = {
      pending: "⏳",
      running: "⟳",
      done:    "✅",
      failed:  "❌",
    };
    const banner = document.getElementById("status-banner");
    if (!banner) return;
    banner.className = `job-status-banner ${level}`;
    const iconEl = banner.querySelector(".banner-icon");
    if (iconEl) iconEl.textContent = icons[level] || "·";
    UI.setText("banner-title", title);
    UI.setText("banner-sub",   sub);
  }

  /* ── Progress bar ─────────────────────────────────────────────── */
  function _setProgress(mode) {
    const fill = document.getElementById("progress-fill");
    if (!fill) return;
    if (mode === "indeterminate") {
      fill.classList.add("indeterminate");
      fill.style.width = "";
    } else if (mode === "full") {
      fill.classList.remove("indeterminate");
      fill.style.width = "100%";
    } else {
      fill.classList.remove("indeterminate");
      fill.style.width = "0%";
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     RESET — clear the entire form back to initial state
  ═══════════════════════════════════════════════════════════════ */
  function reset() {
    _stopPolling();
    _algo         = null;
    _fileContent  = "";
    _pasteContent = "";
    _lastOutput   = "";
    _lastConsole  = "";

    const ids = [
      ["run-algo-name", "value", ""],
      ["paste-area",    "value", ""],
      ["file-picker",   "value", ""],
    ];
    ids.forEach(([id, prop, val]) => {
      const el = document.getElementById(id);
      if (el) el[prop] = val;
    });

    const algoSummary = document.getElementById("run-algo-summary");
    if (algoSummary) algoSummary.style.display = "none";

    document.getElementById("param-form").innerHTML =
      `<p class="text-muted text-sm">Select an algorithm first.</p>`;

    const fileInfo = document.getElementById("file-info");
    if (fileInfo) fileInfo.classList.remove("show");

    _hidePreview();

    document.getElementById("run-output").style.display  = "none";
    document.getElementById("result-card").style.display = "none";

    /* Reset step cards */
    const stepDefaults = [
      "Choose which algorithm to run",
      "Upload a file or paste your data",
      "Configure algorithm parameters",
      "",
    ];

    ["step1","step2","step3","step4"].forEach((id, idx) => {
      const card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("complete", "active", "collapsed");
      if (idx > 0) card.classList.add("collapsed");
      else         card.classList.add("active");
      const numEl = document.getElementById(`${id}-num`);
      if (numEl) numEl.textContent = String(idx + 1);
      const subEl = document.getElementById(`${id}-sub`);
      if (subEl && stepDefaults[idx])
        subEl.textContent = stepDefaults[idx];
    });

    ["err-algo","err-input","err-params"].forEach(UI.clearErr);
    _updateSubmitSummary();
  }

  /* ── Public API ───────────────────────────────────────────────── */
  return {
    onAlgoType,
    loadDescriptor,
    setInputMode,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChosen,
    clearFile,
    onPasteInput,
    togglePreview,
    toggleStep,
    submit,
    switchTab,
    copyOutput,
    copyJobId,
    downloadOutput,
    downloadConsole,
    forceRenderOutput,
    reset,
  };

})();