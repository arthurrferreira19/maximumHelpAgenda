// public/assets/js/userLogin.js

function showAlert(type, message) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.innerHTML = `
    <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
      ${message}
    </div>
  `;
}

function setLoading(v) {
  const btn = document.getElementById("btnSubmit");
  const spn = document.getElementById("btnSpinner");
  const txt = document.getElementById("btnText");
  if (btn) btn.disabled = v;
  if (spn) spn.classList.toggle("d-none", !v);
  if (txt) txt.textContent = v ? "Entrando..." : "Entrar";
}

function togglePassword() {
  const senha = document.getElementById("senha");
  const btn = document.getElementById("btnTogglePass");
  if (!senha || !btn) return;

  const isPass = senha.type === "password";
  senha.type = isPass ? "text" : "password";

  btn.innerHTML = isPass
    ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i><span class="ms-1">Ocultar</span>`
    : `<i data-lucide="eye" style="width:16px;height:16px;"></i><span class="ms-1">Mostrar</span>`;

  try { if (window.lucide) window.lucide.createIcons(); } catch {}
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeUserShape(user) {
  const u = user || {};

  // suporte a id/_id
  const id = u.id || u._id;

  // setor pode vir como string OU objeto populado
  const setor = (u.setor && typeof u.setor === "object")
    ? (u.setor._id || u.setor.id || null)
    : (u.setor || null);

  return {
    ...u,
    id,
    _id: u._id || id,
    role: normalizeRole(u.role),
    setor: setor ? String(setor) : null
  };
}

async function doLogin(e) {
  e.preventDefault();

  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");
  const email = emailEl ? emailEl.value.trim() : "";
  const senha = senhaEl ? senhaEl.value : "";

  if (!email || !senha) {
    return showAlert("warning", "Informe e-mail e senha.");
  }

  setLoading(true);

  try {
    const data = await API.request("/api/auth/login", {
      method: "POST",
      body: { email, senha }
    });

    const token = data.token || data.accessToken;
    const rawUser = data.user || data.usuario;

    if (!token || !rawUser) {
      showAlert("danger", "Resposta inválida do servidor (token/usuário ausente).");
      return;
    }

    const user = normalizeUserShape(rawUser);

    // ✅ USER e RESPONSAVEL podem entrar
    const allowedRoles = ["USER", "RESPONSAVEL"];
    if (!allowedRoles.includes(user.role)) {
      showAlert("danger", "Acesso negado: este login é apenas para USER ou RESPONSÁVEL.");
      try { API.clearAuth(); } catch {}
      return;
    }

    // Salva auth
    API.setAuth(token, user);

    // Ambos USER e RESPONSAVEL vão para a dashboard do usuário
    window.location.href = "/user/dashboardUser.html";
  } catch (err) {
    showAlert("danger", err?.message || "Falha ao entrar");
  } finally {
    setLoading(false);
  }
}

(function init() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  const btnToggle = document.getElementById("btnTogglePass");
  if (btnToggle) btnToggle.addEventListener("click", togglePassword);

  const form = document.getElementById("loginForm") || document.getElementById("loginForm") || document.getElementById("loginForm");
  // (mantém compatibilidade caso seu HTML use id diferente)
  const f = document.getElementById("loginForm") || document.getElementById("loginForm") || document.getElementById("loginForm");

  // ✅ seu HTML atual usa id="loginForm"
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", doLogin);

  try { if (window.lucide) window.lucide.createIcons(); } catch {}
})();