(function () {
  // --- Service Worker ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(console.warn);
    });
  }

  // --- Install UX ---
  let deferredPrompt = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }
  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }
  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  // Floating button
  function ensureFloatingInstallButton() {
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
    btn.addEventListener("click", onInstallClick);
    document.body.appendChild(btn);

    // iOS helper: show button to teach user
    if (isIOS() && !isInStandaloneMode() && isMobile()) {
      btn.style.display = "inline-flex";
      const tx = btn.querySelector(".pwa-install-tx");
      if (tx) tx.textContent = "Adicionar";
    }

    if (isInStandaloneMode()) btn.style.display = "none";
  }

  // Bottom-sheet modal (mobile)
  function ensureInstallSheet() {
    if (document.getElementById("pwaInstallBackdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "pwaInstallBackdrop";
    backdrop.className = "pwa-install-backdrop";

    const sheet = document.createElement("div");
    sheet.id = "pwaInstallSheet";
    sheet.className = "pwa-install-sheet";
    sheet.innerHTML = `
      <div class="pwa-install-card" role="dialog" aria-modal="true" aria-label="Instalar Maximum Help">
        <div class="hd">
          <div class="pwa-install-badge">MH</div>
          <div class="tx">
            <p class="title">Instalar Maximum Help?</p>
            <p class="desc">Acesse mais rápido pela tela inicial e use como aplicativo.</p>
          </div>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-btn ghost" id="pwaInstallLater" type="button">Agora não</button>
          <button class="pwa-btn primary" id="pwaInstallNow" type="button">Instalar</button>
        </div>
      </div>
    `;

    backdrop.addEventListener("click", hideInstallSheet);
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    document.getElementById("pwaInstallLater").addEventListener("click", () => {
      localStorage.setItem("mh_pwa_install_dismissed", "1");
      hideInstallSheet();
    });
    document.getElementById("pwaInstallNow").addEventListener("click", async () => {
      await onInstallClick();
      hideInstallSheet();
    });
  }

  function showInstallSheet() {
    if (!isMobile()) return;
    if (isInStandaloneMode()) return;

    ensureInstallSheet();
    const backdrop = document.getElementById("pwaInstallBackdrop");
    const sheet = document.getElementById("pwaInstallSheet");
    if (backdrop) backdrop.style.display = "block";
    if (sheet) sheet.style.display = "block";
  }

  function hideInstallSheet() {
    const backdrop = document.getElementById("pwaInstallBackdrop");
    const sheet = document.getElementById("pwaInstallSheet");
    if (backdrop) backdrop.style.display = "none";
    if (sheet) sheet.style.display = "none";
  }

  async function onInstallClick() {
    // iOS: instructions
    if (isIOS() && !isInStandaloneMode()) {
      alert("No iPhone/iPad: toque em Compartilhar (⤴) e depois em 'Adicionar à Tela de Início'.");
      return;
    }

    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt(); // must be called from a user gesture (click)
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      const btn = document.getElementById("btnInstallApp");
      if (btn) btn.style.display = "none";
    } catch (err) {
      console.warn(err);
    }
  }

  // Sidebar button hook (user/admin sidebars)
  function bindSidebarInstallButton() {
    const btn = document.getElementById("btnInstallSidebar");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      // show sheet first (mobile) so user confirms
      if (isMobile() && !isInStandaloneMode() && !isIOS() && deferredPrompt) {
        showInstallSheet();
        return;
      }
      await onInstallClick();
    });
  }

  // Capture install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show floating button on mobile (and desktop if you want)
    const showBtn = () => {
      ensureFloatingInstallButton();
      const btn = document.getElementById("btnInstallApp");
      if (btn && !isInStandaloneMode()) btn.style.display = "inline-flex";
      bindSidebarInstallButton();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBtn);
    } else {
      showBtn();
    }

    // On first entry (mobile), show a friendly prompt (requires tap to actually install)
    const dismissed = localStorage.getItem("mh_pwa_install_dismissed") === "1";
    if (isMobile() && !dismissed) {
      const later = () => showInstallSheet();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", later, { once: true });
      } else {
        later();
      }
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallSheet();
    const btn = document.getElementById("btnInstallApp");
    if (btn) btn.style.display = "none";
    localStorage.removeItem("mh_pwa_install_dismissed");
  });

  // Always prepare UI (iOS helper + sidebar hook + sheet structure)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureFloatingInstallButton();
      ensureInstallSheet();
      bindSidebarInstallButton();
    });
  } else {
    ensureFloatingInstallButton();
    ensureInstallSheet();
    bindSidebarInstallButton();
  }
})();
