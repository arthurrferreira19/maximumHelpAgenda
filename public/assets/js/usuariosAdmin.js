let modalUser;
let modalDelete;

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function badgeStatus(ativo) {
  return ativo
    ? `<span class="badge text-bg-success" style="border-radius:999px;">Ativo</span>`
    : `<span class="badge text-bg-secondary" style="border-radius:999px;">Inativo</span>`;
}

function badgeRole(role) {
  const map = {
    ADMIN: "text-bg-danger",
    RESPONSAVEL: "text-bg-primary",
    USER: "text-bg-dark"
  };
  return `<span class="badge ${map[role] || "text-bg-secondary"}" style="border-radius:999px;">${escapeHtml(role)}</span>`;
}

async function loadSectorsOptions(selectedId = "", allowEmpty = true) {
  const select = document.getElementById("setor");
  try {
    const sectors = await API.request("/api/sectors?ativo=true", { method: "GET" });
    select.innerHTML = `
      ${allowEmpty ? `<option value="">${allowEmpty ? "Selecione..." : ""}</option>` : ""}
      ${sectors.map(s => `<option value="${s._id}" ${String(s._id)===String(selectedId)?"selected":""}>${escapeHtml(s.nome)}</option>`).join("")}
    `;
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    select.innerHTML = `<option value="">Erro ao carregar setores</option>`;
  }
}

function resetModal() {
  document.getElementById("userId").value = "";
  document.getElementById("modalTitle").textContent = "Criar usuário";
  document.getElementById("nome").value = "";
  document.getElementById("email").value = "";
  document.getElementById("senha").value = "";
  document.getElementById("role").value = "USER";
  document.getElementById("ativo").value = "true";
  showAlert("modalAlert", "", "");
}

function applySectorRule() {
  const role = document.getElementById("role").value;
  const setorSel = document.getElementById("setor");
  const hint = document.getElementById("setorHint");

  if (role === "USER") {
    hint.textContent = "(obrigatório para USER)";
    setorSel.disabled = false;
  } else {
    hint.textContent = "(opcional)";
    // deixa habilitado mas opcional
    setorSel.disabled = false;
  }
}

async function loadTable() {
  const tbody = document.getElementById("tblBody");
  tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);">Carregando...</td></tr>`;

  const search = document.getElementById("search").value.trim();
  const role = document.getElementById("filterRole").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (role) qs.set("role", role);

  try {
    const users = await API.request(`/api/users?${qs.toString()}`, { method: "GET" });

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);">Nenhum usuário encontrado</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:800;">${escapeHtml(u.nome)}</div>
          <div style="color:var(--muted); font-size:12px;">Criado em: ${new Date(u.createdAt).toLocaleString()}</div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${badgeRole(u.role)}</td>
        <td>${escapeHtml(u.setor?.nome || "—")}</td>
        <td>${badgeStatus(!!u.ativo)}</td>
        <td class="text-end">
          <div class="d-flex justify-content-end gap-2 flex-wrap">
            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="edit"
              data-id="${u._id}">
              <i data-lucide="pencil" style="width:16px;height:16px;"></i>
            </button>

            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="toggle"
              data-id="${u._id}">
              <i data-lucide="${u.ativo ? "pause-circle" : "play-circle"}" style="width:16px;height:16px;"></i>
            </button>

            <button class="btn btn-outline-danger btn-sm" style="border-radius:12px;"
              data-action="delete"
              data-id="${u._id}"
              data-name="${escapeHtml(u.nome)}">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("pageAlert", "danger", `<strong>Erro:</strong> ${escapeHtml(err.message || "Falha ao carregar usuários")}`);
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);">Erro ao carregar</td></tr>`;
  }
}

async function fetchUserByIdFromList(id) {
  const search = document.getElementById("search").value.trim();
  const role = document.getElementById("filterRole").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (role) qs.set("role", role);

  const users = await API.request(`/api/users?${qs.toString()}`, { method: "GET" });
  return users.find(x => String(x._id) === String(id)) || null;
}

async function openCreateModal() {
  resetModal();
  await loadSectorsOptions("", true);
  applySectorRule();
  if (window.lucide) window.lucide.createIcons();
}

async function openEditModal(user) {
  document.getElementById("userId").value = user._id;
  document.getElementById("modalTitle").textContent = "Editar usuário";
  document.getElementById("nome").value = user.nome || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("senha").value = ""; // opcional ao editar
  document.getElementById("role").value = user.role || "USER";
  document.getElementById("ativo").value = String(!!user.ativo);

  await loadSectorsOptions(user.setor?._id || "", true);
  applySectorRule();
  showAlert("modalAlert", "", "");
  if (window.lucide) window.lucide.createIcons();
}

async function onSave() {
  const id = document.getElementById("userId").value;
  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;
  const role = document.getElementById("role").value;
  const setor = document.getElementById("setor").value || null;
  const ativo = document.getElementById("ativo").value === "true";

  if (!nome) return showAlert("modalAlert", "warning", "Informe o <strong>nome</strong>.");
  if (!email) return showAlert("modalAlert", "warning", "Informe o <strong>e-mail</strong>.");

  if (!id && (!senha || senha.trim().length < 4)) {
    return showAlert("modalAlert", "warning", "Informe uma <strong>senha</strong> (mínimo recomendado: 4 caracteres).");
  }

  if (role === "USER" && !setor) {
    return showAlert("modalAlert", "warning", "Para <strong>USER</strong>, selecione um <strong>setor</strong>.");
  }

  setSaving(true);
  try {
    if (!id) {
      await API.request("/api/users", {
        method: "POST",
        body: { nome, email, senha, role, setor, ativo }
      });
      showAlert("pageAlert", "success", "Usuário criado com sucesso.");
    } else {
      // senha é opcional
      await API.request(`/api/users/${id}`, {
        method: "PUT",
        body: { nome, email, senha: senha?.trim() ? senha : "", role, setor, ativo }
      });
      showAlert("pageAlert", "success", "Usuário atualizado com sucesso.");
    }

    modalUser.hide();
    await loadTable();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    if (err.status === 409) {
      showAlert("modalAlert", "danger", "Já existe um usuário com esse e-mail.");
      return;
    }
    showAlert("modalAlert", "danger", escapeHtml(err.message || "Erro ao salvar"));
  } finally {
    setSaving(false);
  }
}

async function onToggle(id) {
  try {
    await API.request(`/api/users/${id}/toggle`, { method: "PATCH" });
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
    await API.request(`/api/users/${id}`, { method: "DELETE" });
    modalDelete.hide();
    showAlert("pageAlert", "success", "Usuário excluído com sucesso.");
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
  mountSidebar("usuarios");
  showTopbarModule("Usuários");
  setupSidebarToggle();

  modalUser = new bootstrap.Modal(document.getElementById("modalUser"));
  modalDelete = new bootstrap.Modal(document.getElementById("modalDelete"));

  // Create modal
  document.querySelector('[data-bs-target="#modalUser"]').addEventListener("click", () => {
    openCreateModal();
  });

  // Role change => adjust setor rule
  document.getElementById("role").addEventListener("change", applySectorRule);

  // Toggle password visibility
  const btnToggle = document.getElementById("btnTogglePass");
  const senhaEl = document.getElementById("senha");
  btnToggle.addEventListener("click", () => {
    const isPass = senhaEl.type === "password";
    senhaEl.type = isPass ? "text" : "password";
    btnToggle.innerHTML = isPass
      ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i><span class="ms-1">Ocultar</span>`
      : `<i data-lucide="eye" style="width:16px;height:16px;"></i><span class="ms-1">Mostrar</span>`;
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById("btnSave").addEventListener("click", onSave);
  document.getElementById("btnConfirmDelete").addEventListener("click", confirmDelete);

  document.getElementById("btnApply").addEventListener("click", loadTable);
  document.getElementById("btnRefresh").addEventListener("click", loadTable);

  document.getElementById("btnClear").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("filterRole").value = "";
    loadTable();
  });

  // table actions
  document.getElementById("tblBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const user = await fetchUserByIdFromList(id);
      if (!user) return showAlert("pageAlert", "warning", "Não foi possível abrir esse usuário.");
      await openEditModal(user);
      modalUser.show();
      return;
    }

    if (action === "toggle") return onToggle(id);

    if (action === "delete") {
      const name = btn.getAttribute("data-name") || "—";
      return openDeleteModal(id, name);
    }
  });

  loadTable();
  if (window.lucide) window.lucide.createIcons();
})();
