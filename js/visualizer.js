/*
 * SPMF-Web — Result Visualization
 * Copyright (C) 2026 Philippe Fournier-Viger
 * GNU GPL v3 — https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";

const Visualizer = (() => {

  function render(output, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!output || !output.trim()) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">📊</div>
          <div class="es-title">No Data</div>
          <div class="es-sub">No output to visualize.</div>
        </div>`;
      return;
    }

    const lines      = output.trim().split("\n").filter(l => l.trim());
    const ruleLines  = lines.filter(l => l.includes("==>"));
    const supLines   = lines.filter(l => l.includes("#SUP:"));

    if (ruleLines.length > 0) {
      container.innerHTML = _buildRules(ruleLines);
    } else if (supLines.length > 0) {
      container.innerHTML = _buildItemsets(supLines);
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">📄</div>
          <div class="es-title">Format Not Recognized</div>
          <div class="es-sub">
            See the Raw Output tab for full results.
          </div>
        </div>`;
    }
  }

  /* ── Association rules ────────────────────────────────────── */
  function _buildRules(lines) {
    const rules = lines.map(line => {
      const [left, right] = line.split("==>");
      const ant  = (left  || "").trim();
      const rest = (right || "").trim();
      return {
        ant,
        cons: rest.replace(/#\w+:\s*[\d.]+/g, "").trim(),
        sup:  _num(rest, "#SUP:"),
        conf: _num(rest, "#CONF:"),
        lift: _num(rest, "#LIFT:"),
      };
    });

    const maxConf = Math.max(
      ...rules.map(r => parseFloat(r.conf) || 0), 1
    );

    const kpis = `
      <div class="viz-summary">
        <div class="viz-kpi">
          <div class="viz-kpi-label">Total Rules</div>
          <div class="viz-kpi-value">${rules.length}</div>
        </div>
        <div class="viz-kpi">
          <div class="viz-kpi-label">Max Support</div>
          <div class="viz-kpi-value">
            ${Math.max(...rules.map(r => parseFloat(r.sup) || 0))}
          </div>
        </div>
        <div class="viz-kpi">
          <div class="viz-kpi-label">Max Confidence</div>
          <div class="viz-kpi-value">
            ${(maxConf <= 1
              ? (maxConf * 100).toFixed(1)
              : maxConf.toFixed(1))}%
          </div>
        </div>
      </div>`;

    const top  = [...rules]
      .sort((a,b) => (parseFloat(b.conf)||0) - (parseFloat(a.conf)||0))
      .slice(0, 20);

    const bars = `
      <div class="section-divider">
        Top ${top.length} Rules by Confidence
      </div>
      ${top.map(r => {
        const v   = parseFloat(r.conf) || 0;
        const pct = (v <= 1 ? v : v / 100) * 100;
        return `
          <div class="bar-chart-row">
            <div class="bar-label"
                 title="${UI.esc(r.ant)} ==> ${UI.esc(r.cons)}">
              ${UI.esc(r.ant)} → ${UI.esc(r.cons)}
            </div>
            <div class="bar-track">
              <div class="bar-fill"
                   style="width:${pct.toFixed(1)}%"></div>
            </div>
            <div class="bar-val">${pct.toFixed(1)}%</div>
          </div>`;
      }).join("")}`;

    const tableRows = rules.slice(0, 300).map(r => {
      const v   = parseFloat(r.conf) || 0;
      const pct = v <= 1 ? (v * 100).toFixed(2) + "%" : v.toFixed(2) + "%";
      return `
        <tr>
          <td class="mono">${UI.esc(r.ant)}</td>
          <td class="mono">${UI.esc(r.cons)}</td>
          <td>${r.sup  ?? "—"}</td>
          <td>${r.conf != null ? pct : "—"}</td>
          <td>${r.lift ?? "—"}</td>
        </tr>`;
    }).join("");

    const overflow = rules.length > 300
      ? `<tr><td colspan="5" class="text-center text-muted text-sm">
           … ${rules.length - 300} more rules in Raw Output
         </td></tr>`
      : "";

    const table = `
      <div class="section-divider mt-14">Full Rule Table</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Antecedent</th><th>Consequent</th>
              <th>Support</th><th>Confidence</th><th>Lift</th>
            </tr>
          </thead>
          <tbody>${tableRows}${overflow}</tbody>
        </table>
      </div>`;

    return kpis + bars + table;
  }

  /* ── Frequent itemsets ────────────────────────────────────── */
  function _buildItemsets(lines) {
    const sets = lines.map(line => {
      const m    = line.match(/#SUP:\s*(\d+)/);
      const sup  = m ? parseInt(m[1]) : 0;
      const items = line.replace(/#SUP:\s*\d+/, "").trim();
      return { items, sup, size: items.split(/\s+/).length };
    }).sort((a,b) => b.sup - a.sup);

    const maxSup = sets[0]?.sup || 1;
    const avgSz  = (sets.reduce((s,i) => s + i.size, 0) / sets.length)
      .toFixed(1);

    const kpis = `
      <div class="viz-summary">
        <div class="viz-kpi">
          <div class="viz-kpi-label">Itemsets Found</div>
          <div class="viz-kpi-value">${sets.length}</div>
        </div>
        <div class="viz-kpi">
          <div class="viz-kpi-label">Max Support</div>
          <div class="viz-kpi-value">${maxSup}</div>
        </div>
        <div class="viz-kpi">
          <div class="viz-kpi-label">Avg Size</div>
          <div class="viz-kpi-value">${avgSz}</div>
        </div>
      </div>`;

    const bars = `
      <div class="section-divider">Top 20 by Support</div>
      ${sets.slice(0, 20).map(s => {
        const pct = (s.sup / maxSup * 100).toFixed(1);
        return `
          <div class="bar-chart-row">
            <div class="bar-label" title="${UI.esc(s.items)}">
              ${UI.esc(s.items)}
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="bar-val">${s.sup}</div>
          </div>`;
      }).join("")}`;

    const tableRows = sets.slice(0, 300).map((s, i) => `
      <tr>
        <td class="text-muted">${i + 1}</td>
        <td class="mono">${UI.esc(s.items)}</td>
        <td>${s.size}</td>
        <td><span class="badge badge-blue">${s.sup}</span></td>
      </tr>`).join("");

    const overflow = sets.length > 300
      ? `<tr><td colspan="4" class="text-center text-muted text-sm">
           … ${sets.length - 300} more in Raw Output
         </td></tr>`
      : "";

    const table = `
      <div class="section-divider mt-14">Full Itemset Table</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Itemset</th>
              <th>Size</th><th>Support</th>
            </tr>
          </thead>
          <tbody>${tableRows}${overflow}</tbody>
        </table>
      </div>`;

    return kpis + bars + table;
  }

  /* ── Helper ───────────────────────────────────────────────── */
  function _num(str, key) {
    const m = str.match(
      new RegExp(key.replace(":", "\\:") + "\\s*([\\d.]+)")
    );
    return m ? m[1] : null;
  }

  return { render };
})();