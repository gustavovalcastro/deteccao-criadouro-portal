/* ==========================================================================
   api.js
   - Módulo de comunicação com o backend
   - Gerencia requisições HTTP, token de autenticação e tratamento de erros
   ========================================================================== */
(function (w) {
  const BASE_URL =
    "https://deteccao-criadouro-api-949210563435.southamerica-east1.run.app";
  const AUTH_KEY = "portal.auth.token";

  // Proxy CORS público para desenvolvimento local
  // Usa corsproxy.io que suporta todos os métodos HTTP (GET, POST, PUT, DELETE)
  const CORS_PROXY = "https://corsproxy.io/?";

  // Detecta se está rodando localmente
  function isLocalhost() {
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === ""
    );
  }

  // Constrói a URL completa com proxy se necessário
  function buildUrl(endpoint) {
    const fullUrl = `${BASE_URL}${endpoint}`;

    // Se estiver em localhost, usa proxy CORS
    if (isLocalhost()) {
      return `${CORS_PROXY}${encodeURIComponent(fullUrl)}`;
    }

    // Em produção, usa URL direta
    return fullUrl;
  }

  // Obtém o token armazenado
  function getToken() {
    try {
      const store = JSON.parse(localStorage.getItem("portal.store.v1") || "{}");
      return store.auth?.token || null;
    } catch {
      return null;
    }
  }

  // Armazena o token
  function setToken(token) {
    try {
      const store = JSON.parse(localStorage.getItem("portal.store.v1") || "{}");
      if (!store.auth) store.auth = {};
      store.auth.token = token;
      localStorage.setItem("portal.store.v1", JSON.stringify(store));
    } catch (e) {
      console.error("Erro ao salvar token:", e);
    }
  }

  // Remove o token
  function clearToken() {
    try {
      const store = JSON.parse(localStorage.getItem("portal.store.v1") || "{}");
      if (store.auth) {
        store.auth.token = null;
        store.auth.userId = null;
      }
      localStorage.setItem("portal.store.v1", JSON.stringify(store));
    } catch (e) {
      console.error("Erro ao limpar token:", e);
    }
  }

  // Função principal para fazer requisições
  async function request(endpoint, options = {}) {
    const url = buildUrl(endpoint);
    const token = getToken();

    const headers = {
      "Content-Type": "application/json",
      accept: "application/json",
      ...options.headers,
    };

    // Adiciona token se existir
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
      method: options.method || "GET",
    };

    // Se houver body, converte para JSON
    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      // Tenta parsear JSON, mas trata caso não seja JSON
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : {};
      }

      // Se não for sucesso, lança erro
      if (!response.ok) {
        const error = new Error(
          data.message || `Erro ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      // Se for erro de rede (sem status), adiciona informação
      if (!error.status) {
        error.status = 0;
        error.message =
          error.message || "Erro de conexão. Verifique sua internet.";
      }
      throw error;
    }
  }

  // Métodos auxiliares
  const api = {
    // GET
    get(endpoint, options = {}) {
      return request(endpoint, { ...options, method: "GET" });
    },

    // POST
    post(endpoint, body, options = {}) {
      return request(endpoint, { ...options, method: "POST", body });
    },

    // PUT
    put(endpoint, body, options = {}) {
      return request(endpoint, { ...options, method: "PUT", body });
    },

    // DELETE
    delete(endpoint, options = {}) {
      return request(endpoint, { ...options, method: "DELETE" });
    },

    // Gerenciamento de token
    getToken,
    setToken,
    clearToken,
  };

  // Expõe globalmente
  w.API = api;
})(window);
