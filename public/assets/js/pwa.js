(function () {
  // --- Service Worker ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(console.warn);
    });
  }

  // --- Install Button (Android/Chromium) ---
  let deferredPrompt = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }
  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function ensureInstallButton() {
    if (document.getElementById("btnInstallApp")) return;

    const btn = document.createElement("button");
    btn.id = "btnInstallApp";
    btn.type = "button";
    btn.className = "pwa-install-btn";
    btn.innerHTML = `
      <span class="pwa-install-ic" aria-hidden="true">⬇</span>
      <span class="pwa-install-tx">Instalar</span>
    `;
    btn.setAttribute("aria-label", "Instalar Maximum Help");
    btn.style.display = "none";

    btn.addEventListener("click", async () => {
      // iOS: show instructions (no beforeinstallprompt)
      if (isIOS() && !isInStandaloneMode()) {
        alert("No iPhone/iPad: toque em Compartilhar (⤴) e depois em 'Adicionar à Tela de Início'.");
        return;
      }

      if (!deferredPrompt) return;

      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        btn.style.display = "none";
        deferredPrompt = null;
      } catch (err) {
        console.warn(err);
      }
    });

    document.body.appendChild(btn);

    // iOS helper (optional)
    if (isIOS() && !isInStandaloneMode()) {
      btn.style.display = "inline-flex";
      const tx = btn.querySelector(".pwa-install-tx");
      if (tx) tx.textContent = "Adicionar";
    }

    // Hide if already installed
    if (isInStandaloneMode()) btn.style.display = "none";
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const show = () => {
      ensureInstallButton();
      const btn = document.getElementById("btnInstallApp");
      if (btn) btn.style.display = "inline-flex";
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", show);
    } else {
      show();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    const btn = document.getElementById("btnInstallApp");
    if (btn) btn.style.display = "none";
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureInstallButton);
  } else {
    ensureInstallButton();
  }
})();
