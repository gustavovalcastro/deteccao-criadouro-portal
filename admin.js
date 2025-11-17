/* admin.js
   Extensão que adiciona:
   - Botão "Acesso Admin" na tela de login
   - Rotas #/admin-login e #/admin
   - Painel do admin (criar/editar/excluir usuários do PORTAL via backend)
   - Usa API.* (api.js) para falar com /userPortal/*
*/
(function () {
  const APP = document.getElementById("app");
  const ADMIN_AUTH_KEY = "portal.admin.auth";

  /* ----------------- estilos injetados (se não existirem) ----------------- */
  (function ensureStyles() {
    const id = "admin-bridge-styles";
    if (document.getElementById(id)) return;
    const css = `
      .admin-btn{position:fixed;top:16px;right:16px;z-index:60}
      .btn.danger{background:#ef4444;color:#fff;border:0}
      .btn.danger:hover{background:#dc2626}
    `;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  })();

  /* ----------------- auth do admin (separado do backend) ----------------- */
  const AdminAuth = {
    login(email, password) {
      // autenticação local de admin
      if (email === "admin@gmail.com" && password === "admin123") {
        localStorage.setItem(
          ADMIN_AUTH_KEY,
          JSON.stringify({ token: "admintoken" })
        );
        return { token: "admintoken" };
      }
      return null;
    },
    logout() {
      localStorage.removeItem(ADMIN_AUTH_KEY);
    },
    isAuthed() {
      try {
        return !!JSON.parse(localStorage.getItem(ADMIN_AUTH_KEY))?.token;
      } catch {
        return false;
      }
    },
  };

  /* ----------------- patch: adicionar botão "Acesso Admin" ----------------- */
  function patchLoginRender() {
    if (!window.Login || typeof window.Login.render !== "function") return false;
    if (window.Login.__patchedForAdmin) return true;
    const original = window.Login.render;
    window.Login.render = function () {
      const html = original.call(window.Login);
      // injeta o botão antes do conteúdo atual
      return (
        `<a class="btn small admin-btn" href="#/admin-login">Acesso Admin</a>` +
        html
      );
    };
    window.Login.__patchedForAdmin = true;
    return true;
  }

  // tenta patch agora e novamente quando a página carregar
  patchLoginRender();
  window.addEventListener("load", patchLoginRender);

  /* ----------------- View: Login do Admin ----------------- */
  const AdminLogin = {
    render() {
      return `
        <div class="login-wrap">
          <form class="card login-card p24" onsubmit="return AdminLogin.submit(event)" autocomplete="off">
            <h2 style="margin:0 0 12px">Admin – Login</h2>

            <label class="label">E-mail</label>
            <input id="a-email" class="input" type="email" placeholder="admin@email.com"
                   autocomplete="username" autocapitalize="none" spellcheck="false"/>

            <div class="mt12">
                <label class="label">Senha</label>
                <div class="input-with-icon">
                    <input
                      id="a-password"
                      class="input"
                      type="password"
                      placeholder="sua senha"
                      autocomplete="current-password"
                    />
                    <button
                      id="a-toggle-pass"
                      type="button"
                      class="toggle-pass"
                      aria-label="Mostrar senha"
                      onclick="AdminLogin.togglePassword()"
                      title="Mostrar senha"
                    >${AdminLogin.icons.eye}</button>
                </div>
            </div>

            <div class="mt12" style="display:flex;gap:8px;justify-content:space-between">
              <a class="btn" href="#/login">Voltar ao Portal</a>
              <button class="btn primary">Entrar</button>
            </div>
            <div id="a-error" style="color:#dc2626;font-size:13px;margin-top:6px;display:none"></div>
          </form>
        </div>
      `;
    },
    submit(e) {
      e.preventDefault();
      const email = document.getElementById("a-email").value.trim();
      const pass = document.getElementById("a-password").value;
      const res = AdminAuth.login(email, pass);
      const err = document.getElementById("a-error");
      if (!res) {
        err.textContent = "Admin inválido";
        err.style.display = "block";
        return false;
      }
      location.hash = "#/admin";
      return false;
    },
    icons: {
      // olho aberto
      eye: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      // olho cortado
      eyeOff:
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M1 1l22 22"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/></svg>',
    },
    togglePassword() {
      const input = document.getElementById("a-password");
      const btn = document.getElementById("a-toggle-pass");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.setAttribute(
        "title",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.innerHTML = showing ? AdminLogin.icons.eye : AdminLogin.icons.eyeOff;
    },
  };

  /* ----------------- View: Painel do Admin (CRUD via backend) ----------------- */
  const AdminPanel = {
    _users: [], // cache local dos UserPortal retornados do backend

    render() {
      if (!AdminAuth.isAuthed()) {
        location.hash = "#/admin-login";
        return "";
      }

      return `
        <div class="header" style="position:sticky;top:0;z-index:10">
          <div class="brand">Admin</div>
          <div style="display:flex;gap:8px">
            <a class="btn" href="#/login" onclick="AdminPanel.logout()">Sair do Admin</a>
          </div>
        </div>

        <div class="content">
          <div class="card p24" style="max-width:720px;margin:0 auto">
            <h2 style="margin-top:0">Cadastrar novo usuário do portal</h2>
            <form onsubmit="return AdminPanel.createUser(event)">
              <div class="row cols-2">
                <div>
                  <label class="label">Nome</label>
                  <input class="input" id="u-name" placeholder="Nome do usuário" required />
                </div>
                <div>
                  <label class="label">Cidade</label>
                  <input class="input" id="u-city" placeholder="Cidade" required />
                </div>
              </div>
              <div class="row cols-2 mt12">
                <div>
                  <label class="label">E-mail</label>
                  <input class="input" id="u-email" type="email" placeholder="email@exemplo.com" required />
                </div>
                <div>
                  <label class="label">Senha</label>
                  <div class="input-with-icon">
                    <input class="input" id="u-pass" type="password" placeholder="senha" required />
                    <button
                      id="u-toggle-pass"
                      type="button"
                      class="toggle-pass"
                      aria-label="Mostrar senha"
                      title="Mostrar senha"
                      onclick="AdminPanel.togglePassword()"
                    >${AdminPanel.icons.eye}</button>
                  </div>
                </div>
              </div>
              <div class="mt16" style="display:flex;gap:8px;justify-content:flex-end">
                <a class="btn" href="#/login">Ir para Login do Portal</a>
                <button class="btn primary">Salvar usuário</button>
              </div>
              <div id="u-msg" class="mt8" style="font-size:13px;color:#16a34a;display:none"></div>
              <div id="u-err" class="mt8" style="font-size:13px;color:#dc2626;display:none"></div>
            </form>
          </div>

          <div class="card p24" style="max-width:960px;margin:16px auto 0">
            <h3 style="margin:0 0 10px">Usuários cadastrados no portal</h3>
            <div class="card" style="overflow:auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Cidade</th>
                    <th class="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody id="admin-users-body">
                  <tr><td colspan="4" class="muted">Carregando usuários...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal de edição -->
        <div class="modal" id="modal-user">
          <div class="box">
            <h3 style="margin-top:0">Editar usuário</h3>
            <form onsubmit="return AdminPanel.saveEdit(event)">
              <input type="hidden" id="edit-id" />
              <div class="row cols-2">
                <div>
                  <label class="label">Nome</label>
                  <input class="input" id="edit-name" required/>
                </div>
                <div>
                  <label class="label">Cidade</label>
                  <input class="input" id="edit-city" required/>
                </div>
              </div>
              <div class="row cols-2 mt12">
                <div>
                  <label class="label">E-mail</label>
                  <input class="input" id="edit-email" type="email" required />
                </div>
                <div>
                  <label class="label">Nova senha (opcional)</label>
                  <div class="input-with-icon">
                    <input class="input" id="edit-pass" type="password" placeholder="deixe em branco para manter" />
                    <button
                      id="edit-toggle-pass"
                      type="button"
                      class="toggle-pass"
                      aria-label="Mostrar senha"
                      title="Mostrar senha"
                      onclick="AdminPanel.toggleEditPassword()"
                    >${AdminPanel.icons.eye}</button>
                  </div>
                </div>
              </div>
              <div class="mt16" style="display:flex;gap:8px;justify-content:flex-end">
                <button type="button" class="btn" onclick="AdminPanel.closeEdit()">Cancelar</button>
                <button class="btn primary">Salvar alterações</button>
              </div>
              <div id="edit-msg" class="mt8" style="font-size:13px;color:#16a34a;display:none"></div>
              <div id="edit-err" class="mt8" style="font-size:13px;color:#dc2626;display:none"></div>
            </form>
          </div>
        </div>
      `;
    },

    /** Busca usuários no backend e preenche a tabela */
    loadUsers() {
      const tbody = document.getElementById("admin-users-body");
      if (!tbody) return;

      tbody.innerHTML =
        '<tr><td colspan="4" class="muted">Carregando usuários...</td></tr>';

        API.get("/userPortal/getAllUserPortals")
        .then((users) => {
          if (!Array.isArray(users) || users.length === 0) {
            AdminPanel._users = [];
            tbody.innerHTML =
              '<tr><td colspan="4" class="muted">Nenhum usuário cadastrado.</td></tr>';
            return;
          }

          // 🔹 Ordena por cidade (ordem alfabética crescente, ignorando acentos)
          const sorted = users.slice().sort((a, b) => {
            const ca = (a.city || "").trim();
            const cb = (b.city || "").trim();

            // quem não tem cidade vai pro fim
            if (!ca && !cb) return 0;
            if (!ca) return 1;
            if (!cb) return -1;

            // compara o nome COMPLETO da cidade (funciona para até 5 palavras ou mais)
            return ca.localeCompare(cb, "pt-BR", { sensitivity: "base" });
          });

          AdminPanel._users = sorted;

          const rows = sorted
            .map((u) => {
              const isProtected = u.email === "teste@gmail.com"; // protege gestor padrão, se existir
              return `
                <tr>
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td>${u.city || "—"}</td>
                  <td class="text-right">
                    <button class="btn small" onclick="AdminPanel.openEdit(${u.id})">Editar</button>
                    ${
                      isProtected
                        ? '<span class="muted" style="font-size:12px;margin-left:8px">—</span>'
                        : `<button class="btn small danger" onclick="AdminPanel.deleteUser(${u.id})">Excluir</button>`
                    }
                  </td>
                </tr>
              `;
            })
            .join("");
          tbody.innerHTML = rows;
        })
        .catch((err) => {
          console.error("Erro ao buscar usuários do portal:", err);
          tbody.innerHTML = `
            <tr>
              <td colspan="4" style="color:#dc2626;font-size:13px;">
                Erro ao carregar usuários do portal. ${err.message || ""}
              </td>
            </tr>`;
        });
    },

    refresh() {
      // Se já está na rota /admin, apenas recarrega a lista
      if (location.hash.startsWith("#/admin")) {
        this.loadUsers();
      } else {
        location.hash = "#/admin";
      }
    },

    createUser(e) {
      e.preventDefault();
      const name = document.getElementById("u-name").value.trim();
      const email = (document.getElementById("u-email").value || "").trim();
      const password = document.getElementById("u-pass").value;
      const city = document.getElementById("u-city").value.trim();
      const msg = document.getElementById("u-msg");
      const err = document.getElementById("u-err");
      msg.style.display = "none";
      err.style.display = "none";

      if (!name) {
        err.textContent = "Nome é obrigatório";
        err.style.display = "block";
        return false;
      }
      if (!city) {
        err.textContent = "Cidade é obrigatória";
        err.style.display = "block";
        return false;
      }
      if (!email) {
        err.textContent = "E-mail é obrigatório";
        err.style.display = "block";
        return false;
      }
      if (!password) {
        err.textContent = "Senha é obrigatória";
        err.style.display = "block";
        return false;
      }

      const payload = { name, email, password, city };

      API.post("/userPortal/createUserPortal", payload)
        .then(() => {
          msg.textContent = "Usuário criado com sucesso!";
          msg.style.display = "block";
          ["u-name", "u-email", "u-pass", "u-city"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          AdminPanel.refresh();
        })
        .catch((ex) => {
          console.error("Erro ao criar usuário do portal:", ex);
          err.textContent =
            ex?.data?.message ||
            ex?.message ||
            "Erro ao criar usuário do portal";
          err.style.display = "block";
        });

      return false;
    },

    openEdit(id) {
      const u =
        (AdminPanel._users || []).find((x) => String(x.id) === String(id)) ||
        null;
      if (!u) return;
      document.getElementById("edit-id").value = u.id;
      document.getElementById("edit-name").value = u.name || "";
      document.getElementById("edit-city").value = u.city || "";
      document.getElementById("edit-email").value = u.email || "";
      document.getElementById("edit-pass").value = "";
      document.getElementById("edit-msg").style.display = "none";
      document.getElementById("edit-err").style.display = "none";
      document.getElementById("modal-user").classList.add("show");
    },

    closeEdit() {
      const modal = document.getElementById("modal-user");
      if (modal) modal.classList.remove("show");
    },

    saveEdit(e) {
      e.preventDefault();
      const id = parseInt(document.getElementById("edit-id").value, 10);
      const name = document.getElementById("edit-name").value.trim();
      const email = document.getElementById("edit-email").value.trim();
      const city = document.getElementById("edit-city").value.trim();
      const password = document.getElementById("edit-pass").value; // opcional

      const msg = document.getElementById("edit-msg");
      const err = document.getElementById("edit-err");
      msg.style.display = "none";
      err.style.display = "none";

      if (!name) {
        err.textContent = "Nome é obrigatório";
        err.style.display = "block";
        document.getElementById("edit-name").focus();
        return false;
      }
      if (!city) {
        err.textContent = "Cidade é obrigatória";
        err.style.display = "block";
        document.getElementById("edit-city").focus();
        return false;
      }
      if (!email) {
        err.textContent = "E-mail é obrigatório";
        err.style.display = "block";
        document.getElementById("edit-email").focus();
        return false;
      }

      const payload = {
        name,
        email,
        city,
      };
      if (password) payload.password = password;

      API.put(`/userPortal/updateUserPortal/${id}`, payload)
        .then(() => {
          msg.textContent = "Usuário atualizado!";
          msg.style.display = "block";

          setTimeout(() => {
            AdminPanel.closeEdit();
            AdminPanel.refresh();
          }, 250);
        })
        .catch((ex) => {
          console.error("Erro ao atualizar usuário do portal:", ex);
          err.textContent =
            ex?.data?.message ||
            ex?.message ||
            "Erro ao salvar alterações do usuário";
          err.style.display = "block";
        });

      return false;
    },

    deleteUser(id) {
      const u =
        (AdminPanel._users || []).find((x) => String(x.id) === String(id)) ||
        null;
      if (!u) return;

      if (u.email === "teste@gmail.com") {
        alert("Não é permitido apagar o gestor padrão.");
        return;
      }

      if (
        !confirm(`Excluir o usuário "${u.name}" (${u.email}) do portal?`)
      )
        return;

      API.delete(`/userPortal/deleteUserPortal/${id}`)
        .then(() => {
          // Opcional: limpar dados locais associados (campanhas, prefs) se existirem
          if (window.Store && typeof Store.clearUserData === "function") {
            try {
              Store.clearUserData(id);
            } catch (e) {
              console.warn("Falha ao limpar dados locais do usuário:", e);
            }
          }
          AdminPanel.refresh();
        })
        .catch((ex) => {
          console.error("Erro ao excluir usuário do portal:", ex);
          alert(
            ex?.data?.message ||
              ex?.message ||
              "Erro ao excluir usuário do portal"
          );
        });
    },

    icons: {
      eye: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      eyeOff:
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M1 1l22 22"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/></svg>',
    },

    togglePassword() {
      const input = document.getElementById("u-pass");
      const btn = document.getElementById("u-toggle-pass");
      if (!input || !btn) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.setAttribute(
        "title",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.innerHTML = showing ? AdminPanel.icons.eye : AdminPanel.icons.eyeOff;
    },

    toggleEditPassword() {
      const input = document.getElementById("edit-pass");
      const btn = document.getElementById("edit-toggle-pass");
      if (!input || !btn) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.setAttribute(
        "title",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.innerHTML = showing ? AdminPanel.icons.eye : AdminPanel.icons.eyeOff;
    },

    logout() {
      AdminAuth.logout();
    },
  };

  // expõe globalmente para handlers inline
  window.AdminLogin = AdminLogin;
  window.AdminPanel = AdminPanel;

  /* ----------------- roteamento (sem tocar no router original) ----------------- */
  function routeAdmin() {
    const h = location.hash || "#/login";
    // Se for rota de admin, renderizamos aqui por cima do app.js
    if (h.startsWith("#/admin-login")) {
      APP.innerHTML = AdminLogin.render();
      return true;
    }
    if (h.startsWith("#/admin")) {
      if (!AdminAuth.isAuthed()) {
        location.hash = "#/admin-login";
        return true;
      }
      APP.innerHTML = AdminPanel.render();
      // depois de montar o HTML, carrega a lista do backend
      setTimeout(() => AdminPanel.loadUsers(), 0);
      return true;
    }
    return false;
  }

  // Executa junto com o router existente do app.js
  window.addEventListener("load", routeAdmin);
  window.addEventListener("hashchange", routeAdmin);
})();
