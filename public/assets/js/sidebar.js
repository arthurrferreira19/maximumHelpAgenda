(function(){
  // Inject sidebar HTML into any <aside id="sidebar"></aside>
  const el = document.getElementById("sidebar");
  if(!el) return;

  // You can replace these from your auth/localStorage:
  const name = (window.MH_USER?.name) || "Arthur Ferreira";
  const role = (window.MH_USER?.role) || "Administrador";
  const initials = name.split(" ").filter(Boolean).slice(0,2).map(p=>p[0].toUpperCase()).join("") || "MH";

  const current = location.pathname;

  el.innerHTML = `
    <div class="sidebar-header">
      <h4 class="brand">
        <i class="brand-icon" data-lucide="calendar-days"></i>
        Maximum Agenda
      </h4>
      <button class="sidebar-close" type="button" id="btnSidebarClose" aria-label="Fechar menu">
        <i data-lucide="x"></i>
      </button>
    </div>

    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="user-meta">
        <strong>${name}</strong>
        <small>${role}</small>
      </div>
    </div>

    <nav class="sidebar-nav">
      <span class="nav-title">Navegação</span>

      <a href="/admin/dashboardAdmin.html" class="nav-link" data-path="/admin/dashboardAdmin.html">
        <i data-lucide="layout-dashboard"></i> Dashboard
      </a>

      <a href="/admin/usersAdmin.html" class="nav-link" data-path="/admin/usersAdmin.html">
        <i data-lucide="users"></i> Usuários
      </a>

      <a href="/admin/agendaAdmin.html" class="nav-link" data-path="/admin/agendaAdmin.html">
        <i data-lucide="calendar"></i> Agenda
      </a>

      <a href="/admin/chamadosAdmin.html" class="nav-link" data-path="/admin/chamadosAdmin.html">
        <i data-lucide="clipboard-list"></i> Chamados
      </a>

      <hr />

      <a href="#" id="btnLogout" class="nav-link logout">
        <i data-lucide="log-out"></i> Sair
      </a>
    </nav>
  `;

  // Active link
  document.querySelectorAll(".nav-link[data-path]").forEach(a=>{
    if(current.endsWith(a.getAttribute("data-path"))) a.classList.add("active");
  });

  // Mobile open/close
  const overlay = document.getElementById("sidebarOverlay");
  const openBtn = document.getElementById("btnSidebarOpen");
  const closeBtn = document.getElementById("btnSidebarClose");

  function open(){
    el.classList.add("open");
    overlay?.classList.add("show");
  }
  function close(){
    el.classList.remove("open");
    overlay?.classList.remove("show");
  }

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  // Logout hook (ajuste para sua lógica real)
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("#btnLogout");
    if(!btn) return;
    e.preventDefault();
    alert("Logout (exemplo). Integre com sua API.clearToken() / redirect aqui.");
  });

  // Lucide icons
  if(window.lucide && typeof window.lucide.createIcons === "function"){
    window.lucide.createIcons();
  }
})();