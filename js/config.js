/*
 * SPMF-Web — Configuration & Persistence
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

const Config = (() => {

  /* ── Defaults ─────────────────────────────────────────────────── */
  const DEFAULTS = {
    host:     "localhost",
    port:     8585,
    apikey:   "",
    poll:     1,
    timeout:  300,
    encoding: "plain",
    cleanup:  true,
  };

  const STORAGE_KEY        = "spmfw_cfg";
  const RECENT_STORAGE_KEY = "spmfw_recent";

  /* ── Internal state ───────────────────────────────────────────── */
  let _cfg    = { ...DEFAULTS };
  let _recent = [];

  /* ═══════════════════════════════════════════════════════════════
     LOAD  — called once at DOMContentLoaded
  ═══════════════════════════════════════════════════════════════ */
  function load() {
    _loadConfig();
    _loadRecent();
    applyToUI();
  }

  function _loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(_cfg, JSON.parse(raw));
    } catch(e) {
      console.warn("[Config] Could not load settings:", e);
    }
  }

  function _loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      if (raw) _recent = JSON.parse(raw);
    } catch(e) {
      console.warn("[Config] Could not load recent runs:", e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SAVE  — called from the Settings view
  ═══════════════════════════════════════════════════════════════ */
  function save() {
    _cfg.host     = _readText("cfg-host")    || DEFAULTS.host;
    _cfg.port     = _readInt("cfg-port")     || DEFAULTS.port;
    _cfg.apikey   = _readText("cfg-apikey");
    _cfg.poll     = _readFloat("cfg-poll")   || DEFAULTS.poll;
    _cfg.timeout  = _readInt("cfg-timeout")  || DEFAULTS.timeout;
    _cfg.encoding = _readText("cfg-encoding");
    _cfg.cleanup  = _readCheck("cfg-cleanup");

    _persistConfig();
    applyToUI();

    UI.toast("success", "Settings Saved", "Configuration updated.");
    Dashboard.refresh();
  }

  /* ═══════════════════════════════════════════════════════════════
     RESET  — restore factory defaults
  ═══════════════════════════════════════════════════════════════ */
  function reset() {
    _cfg = { ...DEFAULTS };
    _persistConfig();
    applyToUI();
    UI.toast("info", "Settings Reset", "Defaults restored.");
  }

  /* ═══════════════════════════════════════════════════════════════
     APPLY TO UI  — push _cfg values into form fields
  ═══════════════════════════════════════════════════════════════ */
  function applyToUI() {
    _writeVal("cfg-host",     _cfg.host);
    _writeVal("cfg-port",     _cfg.port);
    _writeVal("cfg-apikey",   _cfg.apikey);
    _writeVal("cfg-poll",     _cfg.poll);
    _writeVal("cfg-timeout",  _cfg.timeout);
    _writeVal("cfg-encoding", _cfg.encoding);
    _writeCheck("cfg-cleanup", _cfg.cleanup);

    /* Mirror defaults into the Run Job form */
    _writeVal("run-encoding", _cfg.encoding);
    _writeCheck("run-cleanup", _cfg.cleanup);

    /* Update the About page server URL */
    _writeText("about-server-url",
      `http://${_cfg.host}:${_cfg.port}`);
  }

  /* ═══════════════════════════════════════════════════════════════
     RECENT RUNS
  ═══════════════════════════════════════════════════════════════ */

  /**
   * Add a run record to the top of the recent list (max 5 entries).
   * @param {{ algo:string, execMs:number, jobId:string,
   *            lines:number, ts:string }} run
   */
  function pushRecent(run) {
    _recent.unshift(run);
    _recent = _recent.slice(0, 5);
    _persistRecent();
    renderRecent();
  }

  /** Return the current recent-runs array (read-only copy). */
  function getRecent() { return [..._recent]; }

  /**
   * Render recent runs into:
   *  - the topbar pills  (#recent-pills)
   *  - the dashboard card (#recent-list)
   */
  function renderRecent() {
    _renderTopbarPills();
    _renderDashboardList();
  }

  function _renderTopbarPills() {
    const el = document.getElementById("recent-pills");
    if (!el) return;

    if (!_recent.length) {
      el.innerHTML = "";
      return;
    }

    el.innerHTML = _recent.slice(0, 3).map(r => `
      <div class="recent-pill"
           onclick="Nav.go('run')"
           title="${UI.esc(r.algo)} · ${r.execMs} ms">
        ▶ ${UI.esc(r.algo.slice(0, 13))}
      </div>`).join("");
  }

  function _renderDashboardList() {
    const el = document.getElementById("recent-list");
    if (!el) return;

    if (!_recent.length) {
      el.innerHTML =
        `<p class="text-muted text-sm">No recent runs yet.</p>`;
      return;
    }

    el.innerHTML = _recent.map(r => `
      <div class="recent-run-row">
        <span class="badge badge-green">✓</span>
        <span style="flex:1; font-weight:600;">
          ${UI.esc(r.algo)}
        </span>
        <span class="text-muted text-sm">${r.execMs} ms</span>
      </div>`).join("");
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC GETTER
  ═══════════════════════════════════════════════════════════════ */

  /** Return a shallow copy of the current config (callers must not mutate). */
  function get() { return { ..._cfg }; }

  /* ═══════════════════════════════════════════════════════════════
     PRIVATE HELPERS — DOM
  ═══════════════════════════════════════════════════════════════ */

  function _readText(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function _readInt(id) {
    const el = document.getElementById(id);
    return el ? parseInt(el.value, 10) : NaN;
  }

  function _readFloat(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : NaN;
  }

  function _readCheck(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  function _writeVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function _writeCheck(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  function _writeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ═══════════════════════════════════════════════════════════════
     PRIVATE HELPERS — Storage
  ═══════════════════════════════════════════════════════════════ */

  function _persistConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cfg));
    } catch(e) {
      console.warn("[Config] Could not persist settings:", e);
    }
  }

  function _persistRecent() {
    try {
      localStorage.setItem(
        RECENT_STORAGE_KEY, JSON.stringify(_recent)
      );
    } catch(e) {
      console.warn("[Config] Could not persist recent runs:", e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     APPLICATION ENTRY POINT
  ═══════════════════════════════════════════════════════════════ */

  window.addEventListener("DOMContentLoaded", () => {
    Config.load();
    Dashboard.refresh();
    AlgoBrowser.load();
    Config.renderRecent();
  });

  /* ── Public API ───────────────────────────────────────────────── */
  return {
    load,
    save,
    reset,
    get,
    applyToUI,
    pushRecent,
    getRecent,
    renderRecent,
  };

})();