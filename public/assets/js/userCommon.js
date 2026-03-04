function escapeHtmlRole(r){
  return String(r||"USER")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function userValidateTokenOrRedirect() {
  const me = API.getUser();
  const token = API.getToken();

  if (!token || !me) {
    window.location.href = "/user/login.html";
    return false;
  }

  const allowed = ["USER", "RESPONSAVEL"];
  if (!allowed.includes(me.role)) {
    API.clearAuth();
    window.location.href = "/user/login.html";
    return false;
  }

  return true;
}

function userMountSidebar(activeKey = "dashboard") {
  const me = API.getUser() || { nome: "Usuário" };

  const el = document.getElementById("sidebar");
  el.innerHTML = `
    <div class="side-head">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-title">Maximum Help</div>
          <div class="brand-sub">Painel do Usuário/Responsável</div>
        </div>
      </div>

      <button class="mh-sidebar-close" id="btnSidebarClose" type="button" aria-label="Fechar menu">
        <i data-lucide="x" class="ico"></i>
      </button>

      <div class="profile-card">
        <div class="avatar">${(me.nome || "U").slice(0,1).toUpperCase()}</div>
        <div>
          <div class="profile-name">${me.nome || "Usuário"}</div>
          <div class="profile-sub">Role: ${escapeHtmlRole(me.role)}${me.role==="RESPONSAVEL" ? " • pode gerenciar chamados" : ""}</div>
        </div>
      </div>
    </div>

    <div class="side-nav">
      <div class="nav-section">Navegação</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="dashboard"?"active":""}" href="/user/dashboardUser.html">
          <i data-lucide="layout-dashboard" class="ico"></i>
          Dashboard
        </a>
        <a class="nav-linkx ${activeKey==="chamados"?"active":""}" href="/user/chamadosUser.html">
          <i data-lucide="ticket" class="ico"></i>
          Chamados
        </a>
      </div>

      <div class="nav-section mt-3">Agenda</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="agenda"?"active":""}" href="/user/agendaUser.html">
          <i data-lucide="calendar" class="ico"></i>
          Agenda
        </a>
      </div>

      <div class="nav-section mt-3">Conta</div>
      <div class="nav-list">
        <button class="nav-linkx w-100 text-start" id="btnLogoutUser" type="button">
          <i data-lucide="log-out" class="ico"></i>
          Sair
        </button>
      </div>
    </div>
  `;

  document.getElementById("btnLogoutUser").addEventListener("click", () => {
    API.clearAuth();
    window.location.href = "/user/login.html";
  });

  if (window.lucide) window.lucide.createIcons();
  // habilita toggle no header (hambúrguer no mobile)
  setTimeout(userSetupSidebarToggle, 0);
}

function userSetupSidebarToggle() {
  const btn = document.getElementById("btnSidebarToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });
}
function userSetupSidebarToggle() {
  const btn = document.getElementById("btnSidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (!btn || !sidebar) return;

  // backdrop (mobile)
  let backdrop = document.getElementById("mhSidebarBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "mhSidebarBackdrop";
    backdrop.className = "mh-sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  function isMobile() { return window.matchMedia("(max-width: 992px)").matches; }

  function openMobileSidebar() {
    sidebar.classList.add("open");
    backdrop.classList.add("open");
    document.body.classList.add("mobile-sidebar-open");
  }
  function closeMobileSidebar() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.classList.remove("mobile-sidebar-open");
  }

  const btnClose = document.getElementById("btnSidebarClose");
  btnClose?.addEventListener("click", closeMobileSidebar);

  btn.addEventListener("click", () => {
    if (isMobile()) {
      if (sidebar.classList.contains("open")) closeMobileSidebar();
      else openMobileSidebar();
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  });

  backdrop.addEventListener("click", closeMobileSidebar);

  // fecha ao navegar no mobile
  sidebar.addEventListener("click", (e) => {
    const a = e.target.closest("a.nav-linkx");
    if (a && isMobile()) closeMobileSidebar();
  });

  window.addEventListener("resize", () => {
    // sempre fecha no mobile ao trocar de tamanho
    if (!isMobile()) closeMobileSidebar();
  });
}

