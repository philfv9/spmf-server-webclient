/*
 * SPMF-Web — Navigation / Routing
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";

const Nav = (() => {

  const LABELS = {
    dashboard:  "Dashboard",
    algorithms: "Algorithms",
    run:        "Run Job",
    jobs:       "Jobs",
    settings:   "Settings",
    about:      "About",
  };

  function go(page) {
    // Deactivate all nav items and views
    document.querySelectorAll(".nav-item")
      .forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view")
      .forEach(v => v.classList.remove("active"));

    // Activate target
    const navEl  = document.getElementById(`nav-${page}`);
    const viewEl = document.getElementById(`view-${page}`);
    if (navEl)  navEl.classList.add("active");
    if (viewEl) viewEl.classList.add("active");

    // Breadcrumb
    UI.setText("breadcrumb", LABELS[page] || page);

    // Lazy-load data for views that need it
    if (page === "dashboard")  Dashboard.refresh();
    if (page === "algorithms") AlgoBrowser.load();
    if (page === "jobs")       JobsView.load();
    if (page === "about")      Config.applyToUI();
  }

  return { go };
})();