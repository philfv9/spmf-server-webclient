/*
 * SPMF-Web — UI Utilities: Toast, Modals, DOM helpers
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";
const UI = (() => {

  /* ── DOM shorthand ──────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  function val(id)       { const el = $(id); return el ? el.value : ""; }
  function setVal(id, v) { const el = $(id); if (el) el.value = v; }
  function setText(id, v){ const el = $(id); if (el) el.textContent = v; }

  function showBadge(id, count) {
    const el = $(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count ? "" : "none";
  }

  function showErr(id, msg) {
    const el = $(id);
    if (!el) return;
    el.textContent = "⚠ " + msg;
    el.classList.add("show");
  }

  function clearErr(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("show");
  }

  /* ── Escaping ───────────────────────────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /*
   * escAttr — safe for use inside HTML attribute values.
   * Escapes all five HTML special characters so that
   * algorithm names containing +, _, &, quotes, etc.
   * never break the surrounding attribute string.
   *
   * NOTE: We no longer inject names into onclick="…" strings.
   *       Names are stored in data-algo-name attributes and
   *       read back via el.dataset.algoName, which bypasses
   *       all string-escaping issues entirely.
   *       This function is kept for any remaining attribute
   *       usage (href, title, id, etc.).
   */
  function escAttr(s) {
    return String(s)
      .replace(/&/g,  "&amp;")
      .replace(/"/g,  "&quot;")
      .replace(/'/g,  "&#39;")
      .replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;");
  }

  function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(text, query) {
    if (!query) return esc(text);
    const re = new RegExp(`(${escRe(query)})`, "gi");
    return esc(text).replace(re, "<mark>$1</mark>");
  }

  /* ── Toast ──────────────────────────────────────────────────── */
  function toast(type, title, msg, dur = 4200) {
    const icons = { success:"✅", error:"❌", info:"ℹ️", warning:"⚠️" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.style.setProperty("--toast-dur", `${dur / 1000}s`);
    el.innerHTML =
      `<div class="toast-icon">${icons[type] || "·"}</div>
       <div class="toast-body">
         <div class="toast-title">${esc(title)}</div>
         ${msg ? `<div class="toast-msg">${esc(msg)}</div>` : ""}
       </div>
       <button class="toast-dismiss"
               onclick="this.closest('.toast').remove()">✕</button>`;
    const stack = document.getElementById("toast-stack");
    if (stack) stack.prepend(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.35s, transform 0.35s";
      el.style.opacity    = "0";
      el.style.transform  = "translateX(40px)";
      setTimeout(() => el.remove(), 380);
    }, dur);
  }

  /* ── Confirm modal ──────────────────────────────────────────── */
  function confirmDialog(msg, onConfirm) {
    setText("confirm-body", msg);
    $("confirm-ok").onclick = () => { closeConfirm(); onConfirm(); };
    $("confirm-backdrop").classList.add("open");
  }

  function closeConfirm() {
    $("confirm-backdrop").classList.remove("open");
  }

  /* ── Line-numbered code block ───────────────────────────────── */
  function renderLined(containerId, text) {
    const lines = text.split("\n");
    const nums  = lines.map((_, i) => i + 1).join("\n");
    const el    = $(containerId);
    if (!el) return;
    el.innerHTML =
      `<div class="code-lined">
         <div class="line-gutter">${esc(nums)}</div>
         <div class="line-content">${esc(text)}</div>
       </div>`;
  }

  /* ── Download helper ────────────────────────────────────────── */
  function download(text, filename) {
    const a  = document.createElement("a");
    a.href   = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" })
    );
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Format helpers ─────────────────────────────────────────── */
  function formatBytes(n) {
    if (n < 1024)           return `${n} B`;
    if (n < 1024 * 1024)    return `${(n / 1024).toFixed(1)} KB`;
    return                         `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function fmtDate(s) {
    if (!s) return "—";
    try { return new Date(s).toLocaleString(); } catch(e) { return s; }
  }

  return {
    $, val, setVal, setText, showBadge,
    showErr, clearErr,
    esc, escAttr, escRe, highlight,
    toast,
    confirmDialog, closeConfirm,
    renderLined, download,
    formatBytes, fmtDate,
  };
})();