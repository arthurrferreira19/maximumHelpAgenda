let modalSector;
let modalDelete;

function showAlert(containerId, type, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
      ${msg}
    </div>
  `;
}

function setSaving(v) {
  const btn = document.getElementById("btnSave");
  const spin = document.getElementById("btnSaveSpin");
  const text = document.getElementById("btnSaveText");
  btn.disabled = v;
  spin.classList.toggle("d-none", !v);
  text.textContent = v ? "Salvando..." : "Salvar";
}

async function loadResponsaveisOptions(selectedId = "") {
  const select = document.getElementById("responsavel");
  try {
    const data = await API.request("/api/sectors/responsaveis/options", { method: "GET" });

    if (!data.length) {
      select.innerHTML = `<option value="">Nenhum responsável disponível</option>`;
      return;
    }

    select.innerHTML = `
      <option value="">Selecione...</option>
      ${data.map(u => `
        <option value="${u.id}" ${String(u.id) === String(selectedId) ? "selected" : ""}>
          ${u.nome} • ${u.role} • ${u.email}
        </option>
      `).join("")}
    `;
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    select.innerHTML = `<option value="">Erro ao carregar responsáveis</option>`;
  }
}

function rowBadge(ativo) {
  return ativo
    ? `<span class="badge text-bg-success" style="border-radius:999px;">Ativo</span>`
    : `<span class="badge text-bg-secondary" style="border-radius:999px;">Inativo</span>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadTable() {
  const tbody = document.getElementById("tblBody");
  tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">Carregando...</td></tr>`;

  const search = document.getElementById("search").value.trim();
  const ativo = document.getElementById("filterAtivo").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (ativo !== "") qs.set("ativo", ativo);

  try {
    const data = await API.request(`/api/sectors?${qs.toString()}`, { method: "GET" });

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">Nenhum setor encontrado</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((s) => `
      <tr>
        <td>
          <div style="font-weight:800;">${escapeHtml(s.nome)}</div>
          <div style="color:var(--muted); font-size:12px;">Criado em: ${new Date(s.createdAt).toLocaleString()}</div>
        </td>
        <td>
          <div style="font-weight:700;">${escapeHtml(s.responsavel?.nome || "—")}</div>
          <div style="color:var(--muted); font-size:12px;">${escapeHtml(s.responsavel?.email || "")}</div>
        </td>
        <td>${rowBadge(!!s.ativo)}</td>
        <td class="text-end">
          <div class="d-flex justify-content-end gap-2 flex-wrap">
            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="edit"
              data-id="${s._id}">
              <i data-lucide="pencil" style="width:16px;height:16px;"></i>
            </button>

            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="toggle"
              data-id="${s._id}">
              <i data-lucide="${s.ativo ? "pause-circle" : "play-circle"}" style="width:16px;height:16px;"></i>
            </button>

            <button class="btn btn-outline-danger btn-sm" style="border-radius:12px;"
              data-action="delete"
              data-id="${s._id}"
              data-name="${escapeHtml(s.nome)}">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    lucide.createIcons();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("pageAlert", "danger", `<strong>Erro:</strong> ${escapeHtml(err.message || "Falha ao carregar setores")}`);
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">Erro ao carregar</td></tr>`;
  }
}

function resetModal() {
  document.getElementById("sectorId").value = "";
  document.getElementById("modalTitle").textContent = "Criar setor";
  document.getElementById("nome").value = "";
  document.getElementById("ativo").value = "true";
  showAlert("modalAlert", "", "");
}

async function openCreateModal() {
  resetModal();
  await loadResponsaveisOptions("");
  lucide.createIcons();
}

async function openEditModal(sector) {
  document.getElementById("sectorId").value = sector._id;
  document.getElementById("modalTitle").textContent = "Editar setor";
  document.getElementById("nome").value = sector.nome || "";
  document.getElementById("ativo").value = String(!!sector.ativo);

  await loadResponsaveisOptions(sector.responsavel?._id || "");
  showAlert("modalAlert", "", "");
  lucide.createIcons();
}

async function fetchSectorById(id) {
  // Como não criamos GET /:id, buscamos na list e filtra localmente (simples e suficiente agora)
  const search = document.getElementById("search").value.trim();
  const ativo = document.getElementById("filterAtivo").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (ativo !== "") qs.set("ativo", ativo);

  const data = await API.request(`/api/sectors?${qs.toString()}`, { method: "GET" });
  return data.find(x => String(x._id) === String(id)) || null;
}

async function onSave() {
  const id = document.getElementById("sectorId").value;
  const nome = document.getElementById("nome").value.trim();
  const responsavel = document.getElementById("responsavel").value;
  const ativo = document.getElementById("ativo").value === "true";

  if (!nome) {
    showAlert("modalAlert", "warning", "Informe o <strong>nome do setor</strong>.");
    return;
  }
  if (!responsavel) {
    showAlert("modalAlert", "warning", "Selecione um <strong>responsável</strong>.");
    return;
  }

  setSaving(true);
  try {
    if (!id) {
      await API.request("/api/sectors", { method: "POST", body: { nome, responsavel, ativo } });
      showAlert("pageAlert", "success", "Setor criado com sucesso.");
    } else {
      await API.request(`/api/sectors/${id}`, { method: "PUT", body: { nome, responsavel, ativo } });
      showAlert("pageAlert", "success", "Setor atualizado com sucesso.");
    }

    modalSector.hide();
    await loadTable();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }

    if (err.status === 409) {
      showAlert("modalAlert", "danger", "Já existe um setor com esse nome.");
      return;
    }
    showAlert("modalAlert", "danger", escapeHtml(err.message || "Erro ao salvar"));
  } finally {
    setSaving(false);
  }
}

async function onToggle(id) {
  try {
    await API.request(`/api/sectors/${id}/toggle`, { method: "PATCH" });
    await loadTable();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("pageAlert", "danger", escapeHtml(err.message || "Erro ao alterar status"));
  }
}

function openDeleteModal(id, name) {
  document.getElementById("delId").value = id;
  document.getElementById("delName").textContent = name || "—";
  modalDelete.show();
}

async function confirmDelete() {
  const id = document.getElementById("delId").value;
  try {
    await API.request(`/api/sectors/${id}`, { method: "DELETE" });
    modalDelete.hide();
    showAlert("pageAlert", "success", "Setor excluído com sucesso.");
    await loadTable();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("pageAlert", "danger", escapeHtml(err.message || "Erro ao excluir"));
  }
}

(function init() {
  validateTokenOrRedirect();
  mountSidebar("setores");
  showTopbarModule("Setores");
  setupSidebarToggle();

  modalSector = new bootstrap.Modal(document.getElementById("modalSector"));
  modalDelete = new bootstrap.Modal(document.getElementById("modalDelete"));

  // Ao abrir modal de criar
  document.getElementById("modalSector").addEventListener("show.bs.modal", async (ev) => {
    const id = document.getElementById("sectorId").value;
    // se não tem id, é criar
    if (!id) await openCreateModal();
  });

  document.getElementById("btnSave").addEventListener("click", onSave);

  document.getElementById("btnConfirmDelete").addEventListener("click", confirmDelete);

  document.getElementById("btnApply").addEventListener("click", loadTable);
  document.getElementById("btnRefresh").addEventListener("click", loadTable);

  document.getElementById("btnClear").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("filterAtivo").value = "";
    loadTable();
  });

  // Delegação de eventos na tabela
  document.getElementById("tblBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const sector = await fetchSectorById(id);
      if (!sector) return showAlert("pageAlert", "warning", "Não foi possível abrir esse setor.");
      await openEditModal(sector);
      modalSector.show();
      return;
    }

    if (action === "toggle") return onToggle(id);

    if (action === "delete") {
      const name = btn.getAttribute("data-name") || "—";
      return openDeleteModal(id, name);
    }
  });

  // Quando clicar no botão "Criar setor" (abre com reset)
  document.querySelector('[data-bs-target="#modalSector"]').addEventListener("click", () => {
    resetModal();
  });

  loadTable();
  lucide.createIcons();
})();
