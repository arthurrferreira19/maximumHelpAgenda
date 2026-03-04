// public/assets/js/partials.js
// Carrega partials em páginas (sem depender de template engine)

(async function () {
  try {
    const path = window.location.pathname || "";
    // ❌ não renderizar no login
    if (path.includes("/login")) return;

    // evita duplicar
    if (document.getElementById("mhChatFab")) return;

    const res = await fetch("/partials/chatWidget.html", { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();

    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);

    if (window.lucide) window.lucide.createIcons();

    // init
    if (window.MHChat && typeof window.MHChat.init === "function") {
      window.MHChat.init();
    } else {
      // carrega script do chat dinamicamente
      const s = document.createElement("script");
      s.src = "/assets/js/chatWidget.js";
      s.defer = true;
      s.onload = () => window.MHChat?.init?.();
      document.body.appendChild(s);
    }
  } catch (e) {
    // silencioso
  }
})();
