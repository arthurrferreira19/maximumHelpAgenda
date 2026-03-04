// public/assets/js/chamadosUser.js
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function fmtDate(d) { if (!d) return "-"; try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "-"; } }
  function fmtDateTime(d) { if (!d) return "-"; try { return new Date(d).toLocaleString("pt-BR"); } catch { return "-"; } }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function setAlert(type, msg) {
    const el = $("pageAlert");
    if (!el) return;
    if (!msg) { el.classList.add("d-none"); el.innerHTML = ""; return; }
    el.className = `alert alert-${type} d-flex align-items-start gap-2`;
    el.innerHTML = `<i data-lucide="${type==="danger"?"alert-triangle":"info"}" style="width:18px;height:18px;"></i><div>${escapeHtml(msg)}</div>`;
    el.classList.remove("d-none");
    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  // ==========
  // Status (canon + normalização)
  // ==========
  const STATUS_LIST = [
    "Pendente",
    "Em Andamento",
    "Aguardando Solicitante",
    "Aguardando Fornecedor",
    "Concluído"
  ];

  function normalizeStatus(s) {
    const raw = String(s || "").trim();
    const key = raw
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const map = {
      "pendente": "Pendente",
      "em andamento": "Em Andamento",
      "aguardando solicitante": "Aguardando Solicitante",
      "aguardando fornecedor": "Aguardando Fornecedor",
      "aguardando forncedor": "Aguardando Fornecedor",
      "aguardando responsavel": "Aguardando Fornecedor", // legado -> novo
      "concluido": "Concluído",
      "concluído": "Concluído"
    };
    return map[key] || (raw || "Pendente");
  }

  function statusBadgeClass(status) {
    switch (normalizeStatus(status)) {
      case "Pendente": return "st-pendente";
      case "Em Andamento": return "st-andamento";
      case "Aguardando Solicitante": return "st-sol";
      case "Aguardando Fornecedor": return "st-forn";
      case "Concluído": return "st-conc";
      default: return "st-pendente";
    }
  }

  // ==========
  // State
  // ==========
  let TICKETS = [];
  let CURRENT_ID = null;

  let VIEW_MODE = localStorage.getItem("mh_tickets_view") || "list"; // list | kanban
  let SCOPE_MODE = localStorage.getItem("mh_tickets_scope") || "mine"; // mine | sector

  let modalTicket, modalDetails;

  // Filters/Top buttons
  const scopeFilter = $("scopeFilter");
  const q = $("q");
  const statusFilter = $("statusFilter");
  const urgFilter = $("urgFilter");

  const btnTour = $("btnTour");
  const btnToggleView = $("btnToggleView");
  const btnRefresh = $("btnRefresh");
  const btnOpenCreate = $("btnOpenCreate");

  const listView = $("listView");
  const ticketsGrid = $("ticketsGrid");
  const ticketsEmpty = $("ticketsEmpty");

  const kanbanView = $("kanbanView");
  const kanbanBoard = $("kanbanBoard");

  // Modal create/edit
  const ticketForm = $("ticketForm");
  const modalTicketTitle = $("modalTicketTitle");
  const createErr = $("createErr");
  const btnSaveTicket = $("btnSaveTicket");

  const fTitulo = $("fTitulo");
  const fSolicitanteAberto = $("fSolicitanteAberto");
  const fDescricao = $("fDescricao");
  const fStatus = $("fStatus");
  const fUrgente = $("fUrgente");
  const fUrgenteToggle = $("fUrgenteToggle");
  const urgentAlert = $("urgentAlert");
  const urgentPill = $("urgentPill");
  const ticketModalContent = $("ticketModalContent");
  const fPrazoDias = $("fPrazoDias");
  const fFiles = $("fFiles");
  const selectedFiles = $("selectedFiles");

  // Modal details
  const detailsBody = $("detailsBody");

  document.addEventListener("DOMContentLoaded", async () => {
    if (!userValidateTokenOrRedirect()) return;
    userMountSidebar("chamados");

    const btnSidebarToggle = $("btnSidebarToggle");
    if (btnSidebarToggle) btnSidebarToggle.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));

    const btnLogoutTop = $("btnLogoutTop");
    if (btnLogoutTop) btnLogoutTop.addEventListener("click", () => { API.clearAuth(); window.location.href="/user/login.html"; });

    modalTicket = new bootstrap.Modal($("modalTicket"));
    modalDetails = new bootstrap.Modal($("modalDetails"));

    // inicializa scope selector
    if (scopeFilter) {
      // só deixa “sector” habilitado se o usuário tiver setor definido
      const me = API.getUser() || {};
      const hasSector = !!me.setor;
      if (!hasSector) {
        // remove option sector se não tiver setor
        const opt = scopeFilter.querySelector('option[value="sector"]');
        if (opt) opt.remove();
        SCOPE_MODE = "mine";
        localStorage.setItem("mh_tickets_scope", "mine");
      } else if (SCOPE_MODE !== "mine" && SCOPE_MODE !== "sector") {
        SCOPE_MODE = "mine";
        localStorage.setItem("mh_tickets_scope", "mine");
      }

      scopeFilter.value = SCOPE_MODE;
    }

    bindEvents();
    applyViewModeUI();

    // Delegação: botões dentro do modal de detalhes
    if (detailsBody) {
      detailsBody.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-action]");
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();

        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        if (action === "edit") return openEdit(id);
        if (action === "status") return onStatus(id, btn.getAttribute("data-status"));
        if (action === "sendUpdate") return sendUpdate(id);
      });
    }

    try {
      await loadTickets();
      render();
    } catch (e) {
      setAlert("danger", e.message || "Falha ao carregar chamados.");
    }

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  });

  function bindEvents() {
    if (btnTour) btnTour.addEventListener("click", () => startTour());

    if (btnRefresh) btnRefresh.addEventListener("click", async () => {
      await loadTickets();
      render();
    });

    if (btnOpenCreate) btnOpenCreate.addEventListener("click", () => openCreate());

    if (btnToggleView) {
      btnToggleView.addEventListener("click", () => {
        VIEW_MODE = (VIEW_MODE === "list") ? "kanban" : "list";
        localStorage.setItem("mh_tickets_view", VIEW_MODE);
        applyViewModeUI();
        render();
      });
    }

    if (scopeFilter) {
      scopeFilter.addEventListener("change", async () => {
        SCOPE_MODE = scopeFilter.value === "sector" ? "sector" : "mine";
        localStorage.setItem("mh_tickets_scope", SCOPE_MODE);

        await loadTickets();
        render();
      });
    }

    [q, statusFilter, urgFilter].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    if (btnSaveTicket) btnSaveTicket.addEventListener("click", onSave);

    if (fUrgenteToggle) {
      fUrgenteToggle.addEventListener("change", () => setUrgentUI(!!fUrgenteToggle.checked));
    }

    if (fFiles) {
      fFiles.addEventListener("change", () => {
        const files = Array.from(fFiles.files || []);
        if (!selectedFiles) return;
        selectedFiles.innerHTML = files.length
          ? files.map(f => `<span class="chip">${escapeHtml(f.name)} <small class="text-muted">(${Math.round(f.size/1024)} KB)</small></span>`).join("")
          : `<span class="text-muted">Nenhum arquivo selecionado.</span>`;
      });
    }
  }

  function applyViewModeUI() {
    const isKanban = VIEW_MODE === "kanban";

    if (listView) listView.classList.toggle("d-none", isKanban);
    if (kanbanView) kanbanView.classList.toggle("d-none", !isKanban);

    if (btnToggleView) {
      btnToggleView.innerHTML = isKanban
        ? `<i data-lucide="list" style="width:16px;height:16px;"></i> Lista`
        : `<i data-lucide="columns-3" style="width:16px;height:16px;"></i> Kanban`;
      try { if (window.lucide) window.lucide.createIcons(); } catch {}
    }
  }

  function setUrgentUI(on) {
    if (fUrgente) fUrgente.value = on ? "true" : "false";

    if (urgentPill) {
      urgentPill.className = "badge " + (on ? "text-bg-danger" : "text-bg-secondary");
      urgentPill.textContent = on ? "Sim" : "Não";
    }
    if (urgentAlert) urgentAlert.classList.toggle("d-none", !on);
    if (ticketModalContent) ticketModalContent.classList.toggle("mh-urgent-modal", on);

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  function currentScope() {
    const v = (scopeFilter && scopeFilter.value) ? scopeFilter.value : SCOPE_MODE;
    return v === "sector" ? "sector" : "mine";
  }

  async function loadTickets() {
    setAlert(null, null);

    const me = API.getUser() || {};
    const meId = me._id || me.id;

    // Busca do BACK-END já respeitando escopo
    const scope = currentScope();
    const data = await API.request(`/api/tickets?scope=${encodeURIComponent(scope)}`);

    const all = Array.isArray(data) ? data : (data.items || []);
    let list = all.map(t => ({ ...t, status: normalizeStatus(t.status) }));

    // Segurança extra: se scope=mine, garante no front também
    if (scope === "mine") {
      list = list.filter(t => {
        const sid = (t.solicitante && (t.solicitante._id || t.solicitante.id)) || t.solicitante;
        const rid = (t.responsavel && (t.responsavel._id || t.responsavel.id)) || t.responsavel;
        return String(sid) === String(meId) || String(rid) === String(meId);
      });
    }

    TICKETS = list;

    if (statusFilter) {
      const current = statusFilter.value || "";
      statusFilter.innerHTML =
        `<option value="">Status (todos)</option>` +
        STATUS_LIST.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
      statusFilter.value = current;
    }
  }

  function applyFilters(list) {
    const text = (q && q.value ? q.value.trim().toLowerCase() : "");
    const st = statusFilter ? statusFilter.value : "";
    const urg = urgFilter ? urgFilter.value : "";

    return (list || []).filter(t => {
      const tStatus = normalizeStatus(t.status);

      const hay = [
        t.titulo, t.descricao, t.solicitanteAberto,
        (t.solicitante && (t.solicitante.nome || t.solicitante.email)),
        (t.responsavel && (t.responsavel.nome || t.responsavel.email)),
        (t.setor && (t.setor.nome))
      ].filter(Boolean).join(" ").toLowerCase();

      if (text && !hay.includes(text)) return false;
      if (st && tStatus !== st) return false;

      if (urg !== "") {
        const u = urg === "true";
        if (!!t.urgente !== u) return false;
      }
      return true;
    });
  }

  function render() {
    const filtered = applyFilters(TICKETS);
    if (VIEW_MODE === "kanban") return renderKanban(filtered);
    return renderList(filtered);
  }

  function renderList(filtered) {
    if (!ticketsGrid) return;

    if (!filtered.length) {
      ticketsGrid.innerHTML = "";
      if (ticketsEmpty) ticketsEmpty.classList.remove("d-none");
      try { if (window.lucide) window.lucide.createIcons(); } catch {}
      return;
    }
    if (ticketsEmpty) ticketsEmpty.classList.add("d-none");

    ticketsGrid.innerHTML = filtered.map(renderCard).join("");

    ticketsGrid.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        if (action === "open") return openDetails(id);
        if (action === "edit") return openEdit(id);
        if (action === "status") return onStatus(id, btn.getAttribute("data-status"));
      });
    });

    ticketsGrid.querySelectorAll(".ticket-card").forEach((card) => {
      card.addEventListener("click", (ev) => {
        if (ev.target.closest("button") || ev.target.closest("a")) return;
        const id = card.getAttribute("data-id");
        if (id) openDetails(id);
      });
    });

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  function renderKanban(filtered) {
    if (!kanbanBoard) return;

    const byStatus = {};
    STATUS_LIST.forEach(s => byStatus[s] = []);
    filtered.forEach(t => {
      const s = normalizeStatus(t.status);
      (byStatus[s] || byStatus["Pendente"]).push(t);
    });

    kanbanBoard.innerHTML = `
      <div class="mh-kanban-row">
        ${STATUS_LIST.map((status) => {
          const items = byStatus[status] || [];
          const dotCls = statusBadgeClass(status);
          return `
            <div class="mh-kanban-col" data-col-status="${escapeHtml(status)}">
              <div class="mh-kanban-col-head">
                <div class="mh-kanban-col-title">
                  <span class="dot ${dotCls}"></span>
                  <span>${escapeHtml(status)}</span>
                </div>
                <span class="mh-kanban-count">${items.length}</span>
              </div>

              <div class="mh-kanban-drop" data-drop-status="${escapeHtml(status)}">
                ${items.length ? items.map(t => renderKanbanCard(t)).join("") : `
                  <div class="mh-kanban-empty">Arraste cartões para cá</div>
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    kanbanBoard.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        if (action === "open") return openDetails(id);
        if (action === "edit") return openEdit(id);
      });
    });

    kanbanBoard.querySelectorAll(".mh-kcard").forEach((card) => {
      card.addEventListener("click", (ev) => {
        if (ev.target.closest("button") || ev.target.closest("a")) return;
        const id = card.getAttribute("data-id");
        if (id) openDetails(id);
      });
    });

    // Drag & Drop
    kanbanBoard.querySelectorAll(".mh-kcard").forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        card.classList.add("is-dragging");
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", card.getAttribute("data-id") || "");
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
    });

    kanbanBoard.querySelectorAll("[data-drop-status]").forEach((drop) => {
      drop.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("is-over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
      drop.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        drop.classList.remove("is-over");

        const id = ev.dataTransfer.getData("text/plain");
        const newStatus = normalizeStatus(drop.getAttribute("data-drop-status"));
        if (!id || !newStatus) return;

        const t = TICKETS.find(x => String(x._id) === String(id));
        if (t && normalizeStatus(t.status) === newStatus) return;

        await onStatus(id, newStatus);
      });
    });

    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  function renderCard(t) {
    const urgent = !!t.urgente;
    const prazo = (t.prazoDias ?? "-");
    const anexosCount = Array.isArray(t.anexos) ? t.anexos.length : 0;

    const st = normalizeStatus(t.status);
    const stCls = statusBadgeClass(st);

    const setorNome = (t.setor && (t.setor.nome || t.setor)) ? (t.setor.nome || t.setor) : null;
    const responsavelNome = (t.responsavel && (t.responsavel.nome || t.responsavel.email)) ? (t.responsavel.nome || t.responsavel.email) : null;

    return `
      <div class="ticket-card mh-card ${urgent ? "is-urgent" : ""}" data-id="${t._id}">
        <div class="ticket-head">
          <div class="d-flex align-items-center gap-2">
            <span class="badge badge-status ${stCls}">${escapeHtml(st || "-")}</span>
            ${urgent ? `<span class="urgent-chip"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> URGENTE</span>` : ``}
          </div>
          <div class="ticket-actions">
            <button class="icon-btn" data-action="open" data-id="${t._id}" title="Abrir">
              <i data-lucide="maximize-2" style="width:16px;height:16px;"></i>
            </button>
            <button class="icon-btn" data-action="edit" data-id="${t._id}" title="Editar">
              <i data-lucide="pencil" style="width:16px;height:16px;"></i>
            </button>
          </div>
        </div>

        <div class="ticket-title">${escapeHtml(t.titulo || "Sem título")}</div>
        <div class="ticket-desc">${escapeHtml(t.descricao || "").slice(0, 180)}${(t.descricao || "").length > 180 ? "…" : ""}</div>

        <div class="ticket-meta">
          ${setorNome ? `<div><span class="k">Setor:</span> ${escapeHtml(setorNome)}</div>` : ``}
          <div><span class="k">Solicitante:</span> ${escapeHtml(t.solicitanteAberto || "-")}</div>
          ${responsavelNome ? `<div><span class="k">Resp.:</span> ${escapeHtml(responsavelNome)}</div>` : ``}
        </div>

        <div class="ticket-foot">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="muted"><i data-lucide="calendar" style="width:14px;height:14px;"></i> ${fmtDate(t.createdAt)}</span>
            <span class="muted"><i data-lucide="hourglass" style="width:14px;height:14px;"></i> ${escapeHtml(String(prazo))} dia(s)</span>
            <span class="muted"><i data-lucide="paperclip" style="width:14px;height:14px;"></i> ${anexosCount}</span>
          </div>

          <div class="mh-chipbar">
            ${STATUS_LIST.map(s => `
              <button class="mini-btn" data-action="status" data-id="${t._id}" data-status="${escapeHtml(s)}" type="button">
                ${escapeHtml(s)}
              </button>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderKanbanCard(t) {
    const urgent = !!t.urgente;
    const anexosCount = Array.isArray(t.anexos) ? t.anexos.length : 0;

    const st = normalizeStatus(t.status);
    const stCls = statusBadgeClass(st);

    return `
      <div class="mh-kcard ${urgent ? "is-urgent" : ""}" draggable="true" data-id="${t._id}">
        <div class="mh-kcard-top">
          <div class="mh-kcard-badges">
            <span class="badge badge-status ${stCls}" style="padding:4px 8px;font-size:12px;">${escapeHtml(st)}</span>
            ${urgent ? `<span class="mh-badge-danger"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> URG</span>` : ``}
          </div>
          <div class="mh-kcard-actions">
            <button class="icon-btn" data-action="open" data-id="${t._id}" title="Abrir"><i data-lucide="maximize-2" style="width:16px;height:16px;"></i></button>
            <button class="icon-btn" data-action="edit" data-id="${t._id}" title="Editar"><i data-lucide="pencil" style="width:16px;height:16px;"></i></button>
          </div>
        </div>

        <div class="mh-kcard-title">${escapeHtml(t.titulo || "Sem título")}</div>
        <div class="mh-kcard-sub">${escapeHtml((t.setor && t.setor.nome) || t.solicitanteAberto || "—")}</div>

        <div class="mh-kcard-foot">
          <span class="muted"><i data-lucide="paperclip" style="width:14px;height:14px;"></i> ${anexosCount}</span>
          <span class="muted"><i data-lucide="calendar" style="width:14px;height:14px;"></i> ${fmtDate(t.createdAt)}</span>
        </div>
      </div>
    `;
  }

  function openCreate() {
    CURRENT_ID = null;

    if (modalTicketTitle) modalTicketTitle.textContent = "Novo chamado";
    if (createErr) { createErr.classList.add("d-none"); createErr.textContent = ""; }
    if (ticketForm) ticketForm.reset();

    const me = API.getUser() || {};
    const defaultName = me.nome || me.email || "";
    if (fSolicitanteAberto) fSolicitanteAberto.value = defaultName;

    if (fStatus) fStatus.value = "Pendente";

    if (fUrgenteToggle) fUrgenteToggle.checked = false;
    setUrgentUI(false);

    if (fPrazoDias) fPrazoDias.value = "";

    if (fFiles) fFiles.value = "";
    if (selectedFiles) selectedFiles.innerHTML = `<span class="text-muted">Nenhum arquivo selecionado.</span>`;

    modalTicket.show();
    try { if (window.lucide) window.lucide.createIcons(); } catch {}
  }

  async function openEdit(id) {
    try {
      const t = await API.request(`/api/tickets/${id}`);
      CURRENT_ID = t._id;

      if (modalTicketTitle) modalTicketTitle.textContent = "Editar chamado";
      if (createErr) { createErr.classList.add("d-none"); createErr.textContent = ""; }

      if (fTitulo) fTitulo.value = t.titulo || "";
      if (fSolicitanteAberto) fSolicitanteAberto.value = t.solicitanteAberto || "";
      if (fDescricao) fDescricao.value = t.descricao || "";
      if (fStatus) fStatus.value = normalizeStatus(t.status) || "Pendente";
      if (fPrazoDias) fPrazoDias.value = (t.prazoDias ?? "");

      const on = !!t.urgente;
      if (fUrgenteToggle) fUrgenteToggle.checked = on;
      setUrgentUI(on);

      if (fFiles) fFiles.value = "";
      if (selectedFiles) selectedFiles.innerHTML = `<span class="text-muted">Você pode anexar mais arquivos ao salvar.</span>`;

      modalTicket.show();
      try { if (window.lucide) window.lucide.createIcons(); } catch {}
    } catch (e) {
      setAlert("danger", e.message || "Falha ao abrir chamado.");
    }
  }

  async function openDetails(id) {
    try {
      const t = await API.request(`/api/tickets/${id}`);
      if (!detailsBody) return;

      const st = normalizeStatus(t.status);
      const stCls = statusBadgeClass(st);

      const anexos = Array.isArray(t.anexos) ? t.anexos : [];
      const updates = Array.isArray(t.atualizacoes) ? t.atualizacoes : [];

      detailsBody.innerHTML = `
        <div class="details-grid">
          <div class="details-item wide" id="tourDetailsActions">
            <div class="lbl">Ações rápidas</div>
            <div class="val" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${STATUS_LIST.map(s =>
                `<button class="btn btn-sm ${normalizeStatus(s)===st ? "btn-marsala" : "btn-outline-secondary"}"
                  data-action="status" data-id="${t._id}" data-status="${escapeHtml(s)}" type="button">${escapeHtml(s)}</button>`
              ).join("")}
              <button class="btn btn-sm btn-outline-secondary ms-auto" data-action="edit" data-id="${t._id}" type="button">
                <i data-lucide="pencil" style="width:16px;height:16px;"></i> Editar
              </button>
            </div>
          </div>

          <div class="details-item"><div class="lbl">Título</div><div class="val">${escapeHtml(t.titulo||"-")}</div></div>
          <div class="details-item"><div class="lbl">Status</div><div class="val"><span class="badge badge-status ${stCls}">${escapeHtml(st)}</span></div></div>
          <div class="details-item"><div class="lbl">Setor</div><div class="val">${escapeHtml((t.setor && t.setor.nome) || "-")}</div></div>
          <div class="details-item"><div class="lbl">Urgente</div><div class="val">${t.urgente ? '<span class="badge text-bg-danger">SIM</span>' : '<span class="badge text-bg-secondary">NÃO</span>'}</div></div>
          <div class="details-item"><div class="lbl">Prazo (dias)</div><div class="val">${escapeHtml(String(t.prazoDias ?? "-"))}</div></div>
          <div class="details-item"><div class="lbl">Criado em</div><div class="val">${fmtDateTime(t.createdAt)}</div></div>

          <div class="details-item wide"><div class="lbl">Descrição</div><div class="val pre">${escapeHtml(t.descricao||"-")}</div></div>

          <div class="details-item wide">
            <div class="lbl">Anexos (${anexos.length})</div>
            <div class="val">
              ${anexos.length ? anexos.map(a => `
                <a class="attach-row" href="${escapeHtml(a.url || "#")}" target="_blank" rel="noopener">
                  <i data-lucide="paperclip" style="width:16px;height:16px;"></i>
                  <span>${escapeHtml(a.originalName || a.filename || "arquivo")}</span>
                  <small class="text-muted ms-auto">${escapeHtml(a.mimeType || "")}</small>
                </a>`).join("") : `<span class="text-muted">Sem anexos.</span>`}
            </div>
          </div>

          <div class="details-item wide" id="tourReply">
            <div class="lbl">Respostas / Andamento</div>

            <div class="mh-updates">
              ${updates.length ? updates.map(u => `
                <div class="mh-update">
                  <div class="mh-update-head">
                    <strong>${escapeHtml((u.autor && (u.autor.nome || u.autor.email)) || "Usuário")}</strong>
                    <span class="text-muted small">${fmtDateTime(u.createdAt || u.updatedAt)}</span>
                  </div>
                  <div class="mh-update-msg">${escapeHtml(u.mensagem || "")}</div>
                </div>
              `).join("") : `<div class="text-muted">Nenhuma atualização ainda.</div>`}
            </div>

            <div class="mt-3">
              <label class="form-label">Responder</label>
              <textarea class="form-control" id="updMsg" rows="3" placeholder="Escreva uma atualização para o chamado..."></textarea>
              <div class="d-flex justify-content-end mt-2">
                <button class="btn btn-marsala" data-action="sendUpdate" data-id="${t._id}" type="button">
                  <i data-lucide="send" style="width:16px;height:16px;"></i>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      modalDetails.show();
      try { if (window.lucide) window.lucide.createIcons(); } catch {}
    } catch (e) {
      setAlert("danger", e.message || "Falha ao abrir detalhes.");
    }
  }

  async function sendUpdate(ticketId) {
    const el = $("updMsg");
    const msg = el ? String(el.value || "").trim() : "";
    if (!msg) return;

    try {
      await API.request(`/api/tickets/${ticketId}/updates`, { method: "POST", body: { mensagem: msg } });
      await loadTickets();
      await openDetails(ticketId);
    } catch (e) {
      setAlert("danger", e.message || "Falha ao enviar resposta.");
    }
  }

  async function onSave() {
    try {
      if (createErr) { createErr.classList.add("d-none"); createErr.textContent=""; }

      const me = API.getUser() || {};
      const meId = me._id || me.id;

      const payload = {
        titulo: (fTitulo && fTitulo.value ? fTitulo.value.trim() : "") || "Sem título",
        solicitanteAberto: (fSolicitanteAberto && fSolicitanteAberto.value ? fSolicitanteAberto.value.trim() : ""),
        descricao: (fDescricao && fDescricao.value ? fDescricao.value.trim() : ""),
        status: normalizeStatus(fStatus ? fStatus.value : "Pendente"),
        urgente: fUrgente ? (fUrgente.value === "true") : false,
        prazoDias: (fPrazoDias && fPrazoDias.value !== "") ? Number(fPrazoDias.value) : undefined,
        solicitante: meId,
        responsavel: meId
      };

      const files = fFiles ? Array.from(fFiles.files || []) : [];

      if (!CURRENT_ID) {
        if (files.length) {
          const fd = new FormData();
          Object.entries(payload).forEach(([k,v]) => { if (v !== undefined) fd.append(k, String(v)); });
          files.forEach(f => fd.append("files", f));
          await API.upload("/api/tickets", fd, { method:"POST" });
        } else {
          await API.request("/api/tickets", { method:"POST", body: payload });
        }
      } else {
        await API.request(`/api/tickets/${CURRENT_ID}`, { method:"PUT", body: payload });
        if (files.length) {
          const fd = new FormData();
          files.forEach(f => fd.append("files", f));
          await API.upload(`/api/tickets/${CURRENT_ID}/attachments`, fd, { method:"POST" });
        }
      }

      modalTicket.hide();
      await loadTickets();
      render();

      setAlert("success", "Chamado salvo com sucesso!");
      setTimeout(() => setAlert(null, null), 1800);
    } catch (e) {
      if (createErr) { createErr.textContent = e.message || "Falha ao salvar."; createErr.classList.remove("d-none"); }
      else setAlert("danger", e.message || "Falha ao salvar.");
    }
  }

  async function onStatus(id, status) {
    try {
      const canonical = normalizeStatus(status);
      await API.request(`/api/tickets/${id}/status`, { method:"PATCH", body:{ status: canonical } });
      await loadTickets();
      render();
    } catch (e) {
      setAlert("danger", e.message || "Falha ao atualizar status.");
    }
  }

  // =======================
  // TOUR (inclui o filtro do setor)
  // =======================
  function setViewMode(mode) {
    if (mode !== "list" && mode !== "kanban") return;
    VIEW_MODE = mode;
    localStorage.setItem("mh_tickets_view", VIEW_MODE);
    applyViewModeUI();
    render();
  }

  function startTour() {
    const steps = [
      { el: "#scopeFilter", title: "Visão (Meus / Meu setor)", text: "Aqui você escolhe se quer ver só seus chamados ou todos do seu setor (colegas)." },
      { el: "#tourFilters", title: "Filtros e busca", text: "Use busca e filtros para encontrar chamados rapidamente." },

      { el: "#btnOpenCreate", title: "Novo chamado", text: "Clique aqui para abrir o formulário e registrar um chamado." },

      { el: "#modalTicket", title: "Abertura de chamado", text: "Vamos abrir o formulário e ver cada campo.", before: () => openCreate() },

      { el: "#tourTitulo", title: "Título", text: "Dê um título curto e claro para facilitar o atendimento." },
      { el: "#tourSolicitante", title: "Solicitante", text: "Vem preenchido com quem abriu, mas você pode apagar e digitar outro nome." },
      { el: "#tourDescricao", title: "Descrição", text: "Explique o pedido/problema com detalhes e contexto." },
      { el: "#tourStatus", title: "Status", text: "Escolha o status inicial. Normalmente começa em “Pendente”." },

      {
        el: "#tourUrgente",
        title: "Urgente (liga/desliga)",
        text: "Ao ligar, o chamado ganha destaque vermelho e prioridade.",
        before: () => { if (fUrgenteToggle && !fUrgenteToggle.checked) { fUrgenteToggle.checked = true; setUrgentUI(true); } },
        after: () => { if (fUrgenteToggle) { fUrgenteToggle.checked = false; setUrgentUI(false); } }
      },

      { el: "#tourPrazo", title: "Prazo estimado", text: "Informe em quantos dias seria ideal resolver." },
      { el: "#tourAnexos", title: "Anexos", text: "Selecione arquivos (prints, PDFs, etc). Eles aparecem listados e serão enviados ao salvar." },
      { el: "#tourSalvar", title: "Salvar", text: "Ao salvar, o chamado será criado/atualizado e aparecerá na lista/kanban." },

      { el: "#btnToggleView", title: "Modo Kanban", text: "No Kanban você arrasta cartões para mudar o status.", before: () => setViewMode("kanban") },
      { el: "#kanbanBoard", title: "Quadro Kanban", text: "Cada coluna é um status. Arraste e solte para atualizar." },

      { el: "#btnRefresh", title: "Atualizar", text: "Recarrega os chamados e atualizações." }
    ];

    runTour(steps);
  }

  function runTour(steps) {
    const filtered = steps.filter(s => !!s.el);
    if (!filtered.length) return;

    cleanupTour();

    const overlay = document.createElement("div");
    overlay.className = "mh-tour-overlay";
    overlay.addEventListener("click", () => cleanupTour());
    document.body.appendChild(overlay);

    const pop = document.createElement("div");
    pop.className = "mh-tour-pop";
    pop.innerHTML = `
      <div class="mh-tour-top">
        <div>
          <div class="mh-tour-step" id="mhTourStep"></div>
          <div class="mh-tour-title" id="mhTourTitle"></div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" id="mhTourClose" type="button" aria-label="Fechar">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>
      <div class="mh-tour-text" id="mhTourText"></div>
      <div class="mh-tour-actions">
        <button class="btn btn-sm btn-outline-secondary" id="mhTourPrev" type="button">Voltar</button>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" id="mhTourSkip" type="button">Pular</button>
          <button class="btn btn-sm btn-marsala" id="mhTourNext" type="button">Próximo</button>
        </div>
      </div>
    `;
    document.body.appendChild(pop);

    const arrow = document.createElement("div");
    arrow.className = "mh-tour-arrow";
    pop.appendChild(arrow);

    const $step = pop.querySelector("#mhTourStep");
    const $title = pop.querySelector("#mhTourTitle");
    const $text = pop.querySelector("#mhTourText");
    const $prev = pop.querySelector("#mhTourPrev");
    const $next = pop.querySelector("#mhTourNext");
    const $skip = pop.querySelector("#mhTourSkip");
    const $close = pop.querySelector("#mhTourClose");

    const state = { i: 0, steps: filtered, highlighted: null, lastAfter: null };

    function findTarget(selector) { return selector ? document.querySelector(selector) : null; }

    function positionPopover(target) {
      const r = target.getBoundingClientRect();
      const pad = 10;

      pop.style.left = "10px";
      pop.style.top = "10px";

      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;

      let top = Math.max(pad, r.top + (r.height / 2) - (popH / 2));
      let left = r.right + 14;

      if (left + popW > window.innerWidth - pad) {
        left = Math.max(pad, r.left - popW - 14);
      }
      if (left < pad) left = pad;
      if (top + popH > window.innerHeight - pad) top = window.innerHeight - popH - pad;

      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;

      const popRect = pop.getBoundingClientRect();
      const arrowTop = Math.min(popRect.height - 20, Math.max(20, (r.top + r.height/2) - popRect.top));
      arrow.style.top = `${arrowTop}px`;

      const popOnRight = left > r.left;
      if (popOnRight) { arrow.style.left = `-6px`; arrow.style.right = `auto`; arrow.style.transform = "rotate(45deg)"; }
      else { arrow.style.right = `-6px`; arrow.style.left = `auto`; arrow.style.transform = "rotate(225deg)"; }
    }

    function clearHighlight() {
      try { if (state.highlighted) state.highlighted.classList.remove("mh-tour-highlight"); } catch {}
      state.highlighted = null;
    }

    async function waitForSelector(selector, timeoutMs = 2200) {
      const start = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          const el = findTarget(selector);
          if (el) return resolve(el);
          if (Date.now() - start > timeoutMs) return resolve(null);
          requestAnimationFrame(tick);
        };
        tick();
      });
    }

    async function renderStep() {
      if (typeof state.lastAfter === "function") { try { state.lastAfter(); } catch {} state.lastAfter = null; }
      const s = state.steps[state.i];

      if (typeof s.before === "function") { try { s.before(); } catch {} }

      const el = await waitForSelector(s.el, 2400);
      if (!el) {
        if (state.i < state.steps.length - 1) { state.i += 1; return renderStep(); }
        return cleanupTour();
      }

      clearHighlight();
      state.highlighted = el;
      el.classList.add("mh-tour-highlight");
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}

      $step.textContent = `Passo ${state.i + 1} de ${state.steps.length}`;
      $title.textContent = s.title || "";
      $text.textContent = s.text || "";

      $prev.disabled = state.i === 0;
      $next.textContent = state.i === state.steps.length - 1 ? "Concluir" : "Próximo";

      positionPopover(el);

      state.lastAfter = (typeof s.after === "function") ? s.after : null;

      try { if (window.lucide) window.lucide.createIcons(); } catch {}
    }

    function next() { if (state.i >= state.steps.length - 1) return cleanupTour(); state.i += 1; renderStep(); }
    function prev() { if (state.i <= 0) return; state.i -= 1; renderStep(); }

    function onKey(e) {
      if (e.key === "Escape") return cleanupTour();
      if (e.key === "ArrowRight" || e.key === "Enter") return next();
      if (e.key === "ArrowLeft") return prev();
    }

    $next.addEventListener("click", next);
    $prev.addEventListener("click", prev);
    $skip.addEventListener("click", cleanupTour);
    $close.addEventListener("click", cleanupTour);
    window.addEventListener("keydown", onKey);
    window.__mhTourCleanup = () => window.removeEventListener("keydown", onKey);

    renderStep();
  }

  function cleanupTour() {
    try { const hl = document.querySelector(".mh-tour-highlight"); if (hl) hl.classList.remove("mh-tour-highlight"); } catch {}
    const overlay = document.querySelector(".mh-tour-overlay"); if (overlay) overlay.remove();
    const pop = document.querySelector(".mh-tour-pop"); if (pop) pop.remove();
    if (window.__mhTourCleanup) { try { window.__mhTourCleanup(); } catch {} window.__mhTourCleanup = null; }
  }

})();