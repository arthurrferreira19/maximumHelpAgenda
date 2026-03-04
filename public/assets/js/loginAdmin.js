function showAlert(type, message) {
  const box = document.getElementById("alertBox");
  box.innerHTML = `
    <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
      ${message}
    </div>
  `;
}

function setLoading(v) {
  document.getElementById("btnSubmit").disabled = v;
  document.getElementById("btnSpinner").classList.toggle("d-none", !v);
  document.getElementById("btnText").textContent = v ? "Entrando..." : "Entrar";
}

function togglePassword() {
  const senha = document.getElementById("senha");
  const btn = document.getElementById("btnTogglePass");
  const isPass = senha.type === "password";
  senha.type = isPass ? "text" : "password";

  btn.innerHTML = isPass
    ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i><span class="ms-1">Ocultar</span>`
    : `<i data-lucide="eye" style="width:16px;height:16px;"></i><span class="ms-1">Mostrar</span>`;

  if (window.lucide) window.lucide.createIcons();
}

async function doLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  if (!email || !senha) return showAlert("warning", "Informe e-mail e senha.");

  setLoading(true);
  try {
    const data = await API.request("/api/auth/login", {
      method: "POST",
      body: { email, senha }
    });

    const token = data.token || data.accessToken;
    const user = data.user || data.usuario;

    if (!token || !user) {
      showAlert("danger", "Resposta inválida do servidor (token/usuário ausente).");
      return;
    }

    if (user.role !== "ADMIN") {
      showAlert("danger", "Acesso negado: este login é somente para administradores (ADMIN).");
      API.clearAuth();
      return;
    }

    API.setAuth(token, user);
    window.location.href = "/admin/dashboardAdmin.html";
  } catch (err) {
    showAlert("danger", err.message || "Falha ao entrar");
  } finally {
    setLoading(false);
  }
}

(function init() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  document.getElementById("btnTogglePass").addEventListener("click", togglePassword);
  document.getElementById("loginForm").addEventListener("submit", doLogin);

  if (window.lucide) window.lucide.createIcons();
})();
