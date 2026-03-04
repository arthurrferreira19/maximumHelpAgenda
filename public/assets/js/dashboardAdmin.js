// public/assets/js/dashboardAdmin.js
(function () {
  const $ = (id) => document.getElementById(id);

  const WEEK = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const STATUS_ORDER = ["Pendente","Em Andamento","Aguardando Solicitante","Aguardando Fornecedor","Concluído"];

  const charts = {
    open30: null,
    statusDonut: null,
    due14: null,
    openWeekPie: null,
    topSectors: null,
    topOpeners: null,
  };

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normStatus(s) {
    const raw = String(s || "").trim();
    const key = raw.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const map = {
      "pendente": "Pendente",
      "em andamento": "Em Andamento",
      "aguardando solicitante": "Aguardando Solicitante",
      "aguardando fornecedor": "Aguardando Fornecedor",
      "aguardando forncedor": "Aguardando Fornecedor",
      "concluido": "Concluído",
      "concluído": "Concluído",
    };
    return map[key] || (raw || "Pendente");
  }

  function showAlert(type, msg) {
    const box = $("pageAlert");
    if (!box) return;
    if (!msg) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
        ${esc(msg)}
      </div>
    `;
  }

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = (v === undefined || v === null) ? "—" : String(v);
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function iso(d) {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function fmtShort(d) {
    try {
      return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return iso(d);
    }
  }

  function destroyChart(key) {
    try {
      if (charts[key]) charts[key].destroy();
    } catch {}
    charts[key] = null;
  }

  function dueDateForTicket(t) {
    if (normStatus(t.status) === "Concluído") return null;
    const prazo = Number(t.prazoDias);
    if (!Number.isFinite(prazo) || prazo <= 0) return null;

    const base = t.dataInicio ? new Date(t.dataInicio) : (t.createdAt ? new Date(t.createdAt) : null);
    if (!base || isNaN(base)) return null;

    return startOfDay(addDays(startOfDay(base), prazo));
  }

  function renderRecent(tickets) {
    const list = $("recentList");
    const empty = $("recentEmpty");
    if (!list || !empty) return;

    const recent = [...tickets]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    if (!recent.length) {
      empty.classList.remove("d-none");
      list.innerHTML = "";
      return;
    }

    empty.classList.add("d-none");
    list.innerHTML = recent.map(t => {
      const st = normStatus(t.status);
      const solicit = esc(t.solicitanteAberto || t.solicitante?.nome || t.solicitante?.email || "—");
      const title = esc(t.titulo || "Sem título");
      const setor = t.setor?.nome ? ` • ${esc(t.setor.nome)}` : "";
      const urg = t.urgente ? `<span class="badge" style="background:#ef4444;color:#fff;border-radius:999px;">URG</span>` : "";

      return `
        <a href="./chamadosAdmin.html#${esc(t._id)}" class="soft-card-sm p-3" style="text-decoration:none; color:inherit; display:block;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div style="min-width:0;">
              <div style="font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
              <div style="color:var(--muted); font-size:12px; margin-top:2px;">
                ${solicit}${setor}
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${urg}
              <span class="badge-accent">${esc(st)}</span>
              <i data-lucide="chevron-right" style="width:18px;height:18px;"></i>
            </div>
          </div>
        </a>
      `;
    }).join("");
  }

  function buildOpenLast30(tickets) {
    const today = startOfDay(new Date());
    const start = addDays(today, -29);

    const map = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      map.set(iso(d), 0);
    }

    tickets.forEach(t => {
      const d = t.createdAt ? startOfDay(new Date(t.createdAt)) : null;
      if (!d || isNaN(d)) return;
      if (d < start || d > today) return;
      const k = iso(d);
      map.set(k, (map.get(k) || 0) + 1);
    });

    const labels = [...map.keys()].map(k => fmtShort(k));
    const values = [...map.values()];
    return { labels, values };
  }

  function buildDueNext14(tickets) {
    const today = startOfDay(new Date());
    const end = addDays(today, 13);

    const map = new Map();
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      map.set(iso(d), 0);
    }

    tickets.forEach(t => {
      const due = dueDateForTicket(t);
      if (!due) return;
      if (due < today || due > end) return;
      const k = iso(due);
      map.set(k, (map.get(k) || 0) + 1);
    });

    const labels = [...map.keys()].map(k => `${fmtShort(k)} (${WEEK[new Date(k).getDay()]})`);
    const values = [...map.values()];
    return { labels, values };
  }

  function buildStatusCounts(tickets) {
    const map = new Map();
    STATUS_ORDER.forEach(s => map.set(s, 0));
    tickets.forEach(t => {
      const st = normStatus(t.status);
      map.set(st, (map.get(st) || 0) + 1);
    });

    const labels = STATUS_ORDER;
    const values = labels.map(l => map.get(l) || 0);
    return { labels, values };
  }

  function buildOpenByWeekday(tickets) {
    const c = Array(7).fill(0);
    tickets.forEach(t => {
      const d = t.createdAt ? new Date(t.createdAt) : null;
      if (!d || isNaN(d)) return;
      c[d.getDay()]++;
    });
    const labels = WEEK;
    return { labels, values: c };
  }

  function topNFromMap(map, n) {
    return [...map.entries()].sort((a,b) => b[1]-a[1]).slice(0, n);
  }

  function buildTopSectors(tickets) {
    const map = new Map();
    tickets.forEach(t => {
      const name = t.setor?.nome || "Sem setor";
      map.set(name, (map.get(name) || 0) + 1);
    });
    const arr = topNFromMap(map, 10);
    return { labels: arr.map(x => x[0]), values: arr.map(x => x[1]) };
  }

  function buildTopOpeners(tickets) {
    const map = new Map();
    tickets.forEach(t => {
      const nome = t.solicitante?.nome || t.solicitante?.email || t.solicitanteAberto || "Solicitante não informado";
      map.set(nome, (map.get(nome) || 0) + 1);
    });
    const arr = topNFromMap(map, 10);
    return { labels: arr.map(x => x[0]), values: arr.map(x => x[1]) };
  }

  function chartCommonOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      }
    };
  }

  function renderCharts(tickets) {
    if (!window.Chart) {
      showAlert("warning", "Chart.js não carregou. Verifique CSP/Internet.");
      return;
    }

    // Line: Open 30
    destroyChart("open30");
    const open30 = buildOpenLast30(tickets);
    charts.open30 = new Chart($("chartOpen30"), {
      type: "line",
      data: {
        labels: open30.labels,
        datasets: [{
          label: "Chamados abertos",
          data: open30.values,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        ...chartCommonOptions(),
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    // Doughnut: Status
    destroyChart("statusDonut");
    const status = buildStatusCounts(tickets);
    charts.statusDonut = new Chart($("chartStatusDonut"), {
      type: "doughnut",
      data: {
        labels: status.labels,
        datasets: [{
          label: "Status",
          data: status.values,
        }]
      },
      options: {
        ...chartCommonOptions(),
        cutout: "62%"
      }
    });

    // Bar (columns): Due 14
    destroyChart("due14");
    const due14 = buildDueNext14(tickets);
    charts.due14 = new Chart($("chartDue14"), {
      type: "bar",
      data: {
        labels: due14.labels,
        datasets: [{
          label: "Vencimentos (próximos 14 dias)",
          data: due14.values,
          borderWidth: 1
        }]
      },
      options: {
        ...chartCommonOptions(),
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    // Pie: Open by weekday
    destroyChart("openWeekPie");
    const week = buildOpenByWeekday(tickets);
    charts.openWeekPie = new Chart($("chartOpenWeekPie"), {
      type: "pie",
      data: {
        labels: week.labels,
        datasets: [{
          label: "Abertura por dia",
          data: week.values
        }]
      },
      options: {
        ...chartCommonOptions()
      }
    });

    // Bar: Top sectors
    destroyChart("topSectors");
    const topSec = buildTopSectors(tickets);
    charts.topSectors = new Chart($("chartTopSectors"), {
      type: "bar",
      data: {
        labels: topSec.labels,
        datasets: [{
          label: "Chamados abertos (por setor)",
          data: topSec.values,
          borderWidth: 1
        }]
      },
      options: {
        ...chartCommonOptions(),
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    // Bar: Top openers
    destroyChart("topOpeners");
    const topOp = buildTopOpeners(tickets);
    charts.topOpeners = new Chart($("chartTopOpeners"), {
      type: "bar",
      data: {
        labels: topOp.labels,
        datasets: [{
          label: "Chamados abertos (por solicitante)",
          data: topOp.values,
          borderWidth: 1
        }]
      },
      options: {
        ...chartCommonOptions(),
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  async function load() {
    showAlert("", "");

    const data = await API.request("/api/tickets", { method: "GET", auth: true });
    const tickets = Array.isArray(data) ? data : (data.items || []);

    const total = tickets.length;
    const done = tickets.filter(t => normStatus(t.status) === "Concluído").length;
    const open = tickets.filter(t => normStatus(t.status) !== "Concluído").length;
    const urg = tickets.filter(t => !!t.urgente && normStatus(t.status) !== "Concluído").length;

    setText("kTotal", total);
    setText("kOpen", open);
    setText("kUrg", urg);
    setText("kDone", done);

    renderRecent(tickets);
    renderCharts(tickets);

    // ícones sempre depois do render/sidebar
    try { window.lucide && lucide.createIcons(); } catch {}
  }

  function bind() {
    $("btnRefresh")?.addEventListener("click", load);

    $("btnLogoutTop")?.addEventListener("click", () => {
      API.clearAuth();
      window.location.href = "./login.html";
    });
  }

  (async function init() {
    if (typeof validateTokenOrRedirect === "function") {
      const ok = validateTokenOrRedirect();
      if (!ok) return;
    }

    if (typeof mountSidebar === "function") mountSidebar("dashboard");
    if (typeof setupSidebarToggle === "function") setupSidebarToggle();

    bind();

    try { window.lucide && lucide.createIcons(); } catch {}

    await load();
  })().catch((err) => {
    showAlert("danger", err?.message || "Falha ao carregar dashboard.");
  });
})();