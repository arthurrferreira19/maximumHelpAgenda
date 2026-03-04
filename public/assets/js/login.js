(function () {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");
  const alertBox = document.getElementById("alertBox");

  const btnToggle = document.getElementById("btnTogglePass");
  const btnSubmit = document.getElementById("btnSubmit");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");

  // Se já estiver logado como ADMIN, manda pro dashboard
  const existingUser = API.getUser();
  if (API.token && existingUser?.role === "ADMIN") {
    window.location.href = "/admin/dashboardAdmin.html";
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("forbidden") === "1") {
    alertBox.innerHTML = `
      <div class="alert alert-warning fade-in" role="alert" style="border-radius:16px;">
        Seu usuário não tem permissão de <strong>ADMIN</strong>. Faça login com uma conta administrativa.
      </div>
    `;
  }

  btnToggle.addEventListener("click", () => {
    const isPass = senhaEl.type === "password";
    senhaEl.type = isPass ? "text" : "password";
    btnToggle.innerHTML = isPass
      ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i><span class="ms-1">Ocultar</span>`
      : `<i data-lucide="eye" style="width:16px;height:16px;"></i><span class="ms-1">Mostrar</span>`;
    lucide.createIcons();
  });

  function setLoading(v) {
    btnSubmit.disabled = v;
    btnSpinner.classList.toggle("d-none", !v);
    btnText.textContent = v ? "Entrando..." : "Entrar no painel";
  }

  function showError(message) {
    alertBox.innerHTML = `
      <div class="alert alert-danger fade-in" role="alert" style="border-radius:16px;">
        <strong>Erro:</strong> ${message}
      </div>
    `;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.innerHTML = "";
    setLoading(true);

    try {
      const email = emailEl.value.trim();
      const senha = senhaEl.value;

      const data = await API.request("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { email, senha }
      });

      // Salva token e user
      API.setToken(data.accessToken);
      API.setUser(data.user);

      // Bloqueia se não for ADMIN
      if (data.user.role !== "ADMIN") {
        API.clearAuth();
        window.location.href = "/admin/login.html?forbidden=1";
        return;
      }

      window.location.href = "/admin/dashboardAdmin.html";
    } catch (err) {
      if (err.status === 401) showError("E-mail ou senha inválidos.");
      else showError(err.message || "Não foi possível realizar o login.");
    } finally {
      setLoading(false);
    }
  });
})();
