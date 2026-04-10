/*
 * SPMF-Web — HTTP API Layer
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";

const API = (() => {

  function baseUrl() {
    const c = Config.get();
    return `http://${c.host}:${c.port}`;
  }

  function headers() {
    const h = { "Content-Type": "application/json" };
    const key = Config.get().apikey;
    if (key) h["X-API-Key"] = key;
    return h;
  }

  async function GET(path) {
    const resp = await fetch(baseUrl() + path, { headers: headers() });
    const data = await resp.json().catch(() => ({ error: resp.statusText }));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  }

  async function POST(path, body) {
    const resp = await fetch(baseUrl() + path, {
      method:  "POST",
      headers: headers(),
      body:    JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({ error: resp.statusText }));
    if (resp.status !== 202 && !resp.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  }

  async function DELETE(path) {
    const resp = await fetch(baseUrl() + path, {
      method:  "DELETE",
      headers: headers(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  }

  return { GET, POST, DELETE };
})();