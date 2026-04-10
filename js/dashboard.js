/*
 * SPMF-Web — Dashboard View
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";

const Dashboard = (() => {

  async function refresh() {
    const dot   = document.getElementById("pulse-dot");
    const label = document.getElementById("server-label");
    dot.className     = "pulse-dot checking";
    label.textContent = "Checking…";
    document.getElementById("conn-banner").classList.remove("show");

    try {
      const h = await API.GET("/api/health");

      dot.className     = "pulse-dot up";
      label.textContent = h.version ? `v${h.version}` : "UP";

      UI.setText("ds-status",  h.status ?? "UP");
      UI.setText("ds-algos",   h.spmfAlgorithmsLoaded ?? "—");
      UI.setText("ds-active",  h.activeJobs ?? "—");
      UI.setText("ds-queued",  `${h.queuedJobs ?? "—"} queued`);
      UI.setText("ds-total",   h.totalJobsInRegistry ?? "—");
      UI.setText("ds-uptime",  h.uptimeSeconds ?? "—");
      UI.setText("ds-version", h.version ? `v${h.version}` : "");

      if (h.spmfAlgorithmsLoaded) {
        UI.showBadge("algo-nav-badge", h.spmfAlgorithmsLoaded);
      }

    } catch(e) {
      dot.className     = "pulse-dot down";
      label.textContent = "Unreachable";
      const addr = document.getElementById("conn-banner-addr");
      const cfg  = Config.get();
      if (addr) addr.textContent = `${cfg.host}:${cfg.port}`;
      document.getElementById("conn-banner").classList.add("show");
      ["ds-status","ds-algos","ds-active","ds-queued","ds-total","ds-uptime"]
        .forEach(id => UI.setText(id, "—"));
    }

    try {
      const info  = await API.GET("/api/info");
      const tbody = document
        .querySelector("#server-info-table tbody");
      tbody.innerHTML = Object.entries(info)
        .map(([k, v]) =>
          `<tr>
             <td>${UI.esc(k)}</td>
             <td>${UI.esc(String(v))}</td>
           </tr>`)
        .join("");
    } catch(e) {
      const tbody = document
        .querySelector("#server-info-table tbody");
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="2" class="text-muted text-sm">
             Server configuration unavailable.
           </td></tr>`;
      }
    }

    Config.renderRecent();
  }

  return { refresh };
})();