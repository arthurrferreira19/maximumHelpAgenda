// public/assets/js/api.js
// Helper único (MaximumHelp + Agenda)
// Mantém compatibilidade com scripts antigos (MaximumAgenda)

window.API = (function () {
  const TOKEN_KEY = "mh_token";
  const USER_KEY = "mh_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAuth(token, user) {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearAuth() {
    clearToken();
    localStorage.removeItem(USER_KEY);
  }

  async function upload(url, formData, { method = "POST" } = {}) {
    const token = getToken();
    const opts = { method, headers: {} };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    opts.body = formData;

    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `Erro ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  /**
   * request(url, { method, body, headers, auth })
   * - auth=true: exige token (compatibilidade com MaximumAgenda)
   */
  async function request(url, { method = "GET", body = null, headers = {}, auth = false } = {}) {
    const token = getToken();

    if (auth && !token) {
      const err = new Error("Sem token (faça login novamente).");
      err.status = 401;
      throw err;
    }

    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };

    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

    if (!res.ok) {
      const msg = data?.message || data?.error || `Erro HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  return {
    // auth
    getToken, setToken, clearToken,
    getUser, setAuth, clearAuth,

    // http
    request, upload
  };
})();
