// public/assets/js/dashboardUser.js
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const STATUS = [
    { key: "Pendente", cls: "st-pendente" },
    { key: "Em Andamento", cls: "st-andamento" },
    { key: "Aguardando Solicitante", cls: "st-sol" },
    { key: "Aguardando Fornecedor", cls: "st-forn" },
    { key: "Concluído", cls: "st-conc" },
  ];

  let scope = localStorage.getItem("mh_tickets_scope") || "mine";
  let tickets = [];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if (!userValidateTokenOrRedirect()) return;

    userMountSidebar("dashboard");

    const btnSidebarToggle = $("btnSidebarToggle");
    if (btnSidebarToggle) btnSidebarToggle.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));

    const btnLogoutTop = $("btnLogoutTop");
    if (btnLogoutTop) btnLogoutTop.addEventListener("click", () => { API.clearAuth(); window.location.href = "/user/login.html"; });

    const me = API.getUser() || {};
    paintHeader(me);

    // scope filter
    const scopeFilter = $("scopeFilter");
    if (scopeFilter) {
      // se não tem setor, remove option setor
      if (!me.setor) {
        const opt = scopeFilter.querySelector('option[value="sector"]');
        if (opt) opt.remove();
        scope = "mine";
        localStorage.setItem("mh_tickets_scope", "mine");
      } else {
        scope = (scope === "sector" || scope === "mine") ? scope : "mine";
      }
      scopeFilter.value = scope;

      scopeFilter.addEventListener("change", async () => {
        scope = scopeFilter.value === "sector" ? "sector" : "mine";
        localStorage.setItem("mh_tickets_scope", scope);
        await load();
        render();
      });
    }

    const btnRefresh = $("btnRefresh");
    if (btnRefresh) btnRefresh.addEventListener("click", async () => {
      await load();
      render();
    });

    const btnTour = $("btnTour");
    if (btnTour) btnTour.addEventListener("click", startTour);

    await load();
    render();

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  function paintHeader(me) {
    const hello = $("helloName");
    const roleLabel = $("roleLabel");
    const sectorChip = $("sectorChip");
    const sectorLabel = $("sectorLabel");

    if (hello) hello.textContent = `Olá, ${me.nome || me.email || "usuário"}!`;

    const role = String(me.role || "").toUpperCase();
    if (roleLabel) roleLabel.textContent = role === "RESPONSAVEL" ? "RESPONSÁVEL" : (role || "—");

    if (me.setor) {
      if (sectorChip) sectorChip.style.display = "";
      if (sectorLabel) sectorLabel.textContent = me.setorNome ? `Setor: ${me.setorNome}` : "Setor definido";
    } else {
      if (sectorChip) sectorChip.style.display = "none";
    }
  }

  async function load() {
    setAlert(null, null);
    const badge = $("scopeBadge");
    if (badge) badge.textContent = (scope === "sector") ? "Meu setor" : "Somente meus";

    const data = await API.request(`/api/tickets?scope=${encodeURIComponent(scope)}`);
    tickets = Array.isArray(data) ? data : (data.items || []);
  }

  function render() {
    const total = tickets.length;
    const urgent = tickets.filter(t => !!t.urgente).length;
    const emAnd = tickets.filter(t => normStatus(t.status) === "Em Andamento").length;
    const concl = tickets.filter(t => normStatus(t.status) === "Concluído").length;

    setText("kTotal", total);
    setText("kUrg", urgent);
    setText("kAnd", emAnd);
    setText("kConc", concl);

    renderBars();
    renderRecent();

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  function renderBars() {
    const wrap = $("statusBars");
    if (!wrap) return;

    const total = Math.max(1, tickets.length);

    wrap.innerHTML = STATUS.map(s => {
      const count = tickets.filter(t => normStatus(t.status) === s.key).length;
      const pct = Math.round((count / total) * 100);

      return `
        <div class="mh-bar-row">
          <div class="mh-bar-label">
            <span class="dot ${s.cls}"></span>
            <span>${escapeHtml(s.key)}</span>
            <span class="ms-auto text-muted small">${count}</span>
          </div>
          <div class="mh-bar-track">
            <div class="mh-bar-fill ${s.cls}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderRecent() {
    const list = $("recentList");
    const empty = $("recentEmpty");
    if (!list || !empty) return;

    const sorted = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recent = sorted.slice(0, 8);

    if (!recent.length) {
      empty.classList.remove("d-none");
      list.innerHTML = "";
      return;
    }

    empty.classList.add("d-none");
    list.innerHTML = recent.map(t => {
      const st = normStatus(t.status);
      const cls = statusClass(st);
      const title = escapeHtml(t.titulo || "Sem título");
      const sub = escapeHtml(t.solicitanteAberto || (t.solicitante?.nome || t.solicitante?.email || "—"));
      const date = fmtDate(t.createdAt);

      return `
        <a class="mh-recent-item" href="/user/chamadosUser.html#${t._id}" title="Abrir chamado">
          <div class="mh-recent-left">
            <div class="mh-recent-title">${title}</div>
            <div class="mh-recent-sub">${sub} • ${date}</div>
          </div>
          <div class="mh-recent-right">
            ${t.urgente ? `<span class="mh-badge-danger"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> URG</span>` : ``}
            <span class="badge badge-status ${cls}">${escapeHtml(st)}</span>
            <i data-lucide="chevron-right" style="width:18px;height:18px;"></i>
          </div>
        </a>
      `;
    }).join("");
  }

  // Tour simples (sem libs)
  function startTour() {
    const steps = [
      { el: "#tourHeader", title: "Bem-vindo!", text: "Aqui você alterna entre Somente meus e Meu setor, e vê seu perfil." },
      { el: "#scopeFilter", title: "Filtro de visão", text: "Escolha Somente meus ou Meu setor para ver chamados do setor (se tiver setor)." },
      { el: "#tourKpis", title: "KPIs", text: "Resumo rápido do seu volume de chamados e urgentes." },
      { el: "#tourDistrib", title: "Distribuição", text: "Veja quantos chamados existem em cada status." },
      { el: "#tourRecent", title: "Últimos chamados", text: "Clique em um item para abrir no módulo de chamados." },
      { el: "#tourQuickActions", title: "Ações rápidas", text: "Acesse a lista completa e abra um novo chamado." },
    ];
    runTour(steps);
  }

  function runTour(steps) {
    cleanupTour();

    const overlay = document.createElement("div");
    overlay.className = "mh-tour-overlay";
    overlay.addEventListener("click", cleanupTour);
    document.body.appendChild(overlay);

    const pop = document.createElement("div");
    pop.className = "mh-tour-pop";
    pop.innerHTML = `
      <div class="mh-tour-top">
        <div>
          <div class="mh-tour-step" id="mhTourStep"></div>
          <div class="mh-tour-title" id="mhTourTitle"></div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" id="mhTourClose" type="button">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>
      <div class="mh-tour-text" id="mhTourText"></div>
      <div class="mh-tour-actions">
        <button class="btn btn-sm btn-outline-secondary" id="mhTourPrev" type="button">Voltar</button>
        <button class="btn btn-sm btn-marsala" id="mhTourNext" type="button">Próximo</button>
      </div>
    `;
    document.body.appendChild(pop);

    const $step = pop.querySelector("#mhTourStep");
    const $title = pop.querySelector("#mhTourTitle");
    const $text = pop.querySelector("#mhTourText");
    const $prev = pop.querySelector("#mhTourPrev");
    const $next = pop.querySelector("#mhTourNext");
    const $close = pop.querySelector("#mhTourClose");

    let i = 0;

    const highlight = (el) => {
      document.querySelectorAll(".mh-tour-highlight").forEach(x => x.classList.remove("mh-tour-highlight"));
      el.classList.add("mh-tour-highlight");
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
      positionPopover(pop, el);
    };

    const renderStep = () => {
      const s = steps[i];
      const el = document.querySelector(s.el);
      if (!el) return;

      $step.textContent = `Passo ${i + 1} de ${steps.length}`;
      $title.textContent = s.title;
      $text.textContent = s.text;

      $prev.disabled = i === 0;
      $next.textContent = i === steps.length - 1 ? "Concluir" : "Próximo";

      highlight(el);
      try { if (window.lucide) window.lucide.createIcons(); } catch {}
    };

    $prev.addEventListener("click", () => { if (i > 0) { i--; renderStep(); } });
    $next.addEventListener("click", () => { if (i < steps.length - 1) { i++; renderStep(); } else cleanupTour(); });
    $close.addEventListener("click", cleanupTour);

    window.__mhDashTour = { overlay, pop };

    renderStep();
  }

  function cleanupTour() {
    document.querySelectorAll(".mh-tour-highlight").forEach(x => x.classList.remove("mh-tour-highlight"));
    const ov = document.querySelector(".mh-tour-overlay"); if (ov) ov.remove();
    const pop = document.querySelector(".mh-tour-pop"); if (pop) pop.remove();
    window.__mhDashTour = null;
  }

  function positionPopover(pop, target) {
    const r = target.getBoundingClientRect();
    const pad = 10;

    const popW = pop.offsetWidth || 360;
    const popH = pop.offsetHeight || 160;

    let left = r.right + 14;
    let top = Math.max(pad, r.top + (r.height / 2) - (popH / 2));

    if (left + popW > window.innerWidth - pad) left = Math.max(pad, r.left - popW - 14);
    if (top + popH > window.innerHeight - pad) top = window.innerHeight - popH - pad;

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function setAlert(type, msg) {
    const el = $("pageAlert");
    if (!el) return;
    if (!msg) { el.classList.add("d-none"); el.innerHTML = ""; return; }
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove("d-none");
  }

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = String(v ?? "");
  }

  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "-"; }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function normStatus(s) {
    const raw = String(s || "").trim();
    const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
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

  function statusClass(st) {
    switch (st) {
      case "Pendente": return "st-pendente";
      case "Em Andamento": return "st-andamento";
      case "Aguardando Solicitante": return "st-sol";
      case "Aguardando Fornecedor": return "st-forn";
      case "Concluído": return "st-conc";
      default: return "st-pendente";
    }
  }
})();