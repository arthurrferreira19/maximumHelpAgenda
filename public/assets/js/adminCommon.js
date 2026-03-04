function validateTokenOrRedirect() {
  const me = API.getUser();
  const token = API.getToken();

  if (!token || !me) {
    window.location.href = "/admin/login.html";
    return false;
  }

  if (me.role !== "ADMIN") {
    API.clearAuth();
    window.location.href = "/admin/login.html";
    return false;
  }

  return true;
}

function mountSidebar(activeKey = "dashboard") {
  const me = API.getUser() || { nome: "Admin" };

  const el = document.getElementById("sidebar");
  el.innerHTML = `
    <div class="side-head">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-title">Maximum Help</div>
          <div class="brand-sub">Painel Admin</div>
        </div>
      </div>

      <button class="mh-sidebar-close" id="btnSidebarClose" type="button" aria-label="Fechar menu">
        <i data-lucide="x" class="ico"></i>
      </button>

      <div class="profile-card">
        <div class="avatar">${(me.nome || "A").slice(0,1).toUpperCase()}</div>
        <div>
          <div class="profile-name">${me.nome || "Administrador"}</div>
          <div class="profile-sub">Role: ADMIN</div>
        </div>
      </div>
    </div>

    <div class="side-nav">
      <div class="nav-section">Navegação</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="dashboard"?"active":""}" href="/admin/dashboardAdmin.html">
          <i data-lucide="layout-dashboard" class="ico"></i>
          Dashboard
        </a>
      </div>

      <div class="nav-section mt-3">Gerenciamento</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="setores"?"active":""}" href="/admin/setoresAdmin.html">
          <i data-lucide="layers" class="ico"></i>
          Setores
        </a>
        <a class="nav-linkx ${activeKey==="usuarios"?"active":""}" href="/admin/usuariosAdmin.html">
          <i data-lucide="users" class="ico"></i>
          Usuários
        </a>
      </div>

      
      <div class="nav-section mt-3">Agenda</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="agenda"?"active":""}" href="/admin/agendaAdmin.html">
          <i data-lucide="calendar" class="ico"></i>
          Agenda
        </a>
      </div>

<div class="nav-section mt-3">Suporte</div>
      <div class="nav-list">
        <a class="nav-linkx ${activeKey==="chamados"?"active":""}" href="/admin/chamadosAdmin.html">
          <i data-lucide="ticket" class="ico"></i>
          Chamados
        </a>
      </div>

      <div class="nav-section mt-3">Conta</div>
      <div class="nav-list">
        <button class="nav-linkx w-100 text-start" id="btnLogoutAdmin" type="button">
          <i data-lucide="log-out" class="ico"></i>
          Sair do Painel
        </button>
      </div>
    </div>
  `;

  document.getElementById("btnLogoutAdmin").addEventListener("click", () => {
    API.clearAuth();
    window.location.href = "/admin/login.html";
  });

  if (window.lucide) window.lucide.createIcons();
}

function showTopbarModule(title) {
  const el = document.getElementById("moduleTitle");
  if (el) el.textContent = title || "Admin";
}

function setupSidebarToggle() {
  const btn = document.getElementById("btnSidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (!btn || !sidebar) return;

  let backdrop = document.getElementById("mhSidebarBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "mhSidebarBackdrop";
    backdrop.className = "mh-sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;

  const openMobile = () => { sidebar.classList.add("open"); backdrop.classList.add("open"); };
  const closeMobile = () => { sidebar.classList.remove("open"); backdrop.classList.remove("open"); };

  const btnClose = document.getElementById("btnSidebarClose");
  btnClose?.addEventListener("click", closeMobile);

  btn.addEventListener("click", () => {
    if (isMobile()) {
      sidebar.classList.contains("open") ? closeMobile() : openMobile();
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  });

  backdrop.addEventListener("click", closeMobile);

  sidebar.addEventListener("click", (e) => {
    const a = e.target.closest("a.nav-linkx");
    if (a && isMobile()) closeMobile();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobile();
  });
}

