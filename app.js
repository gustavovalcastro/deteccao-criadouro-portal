/* ==========================================================================
   app.js
   - SPA muito simples com "hash router" (#/rota)
   - Telas: Login, Home, Mapa, Campanhas (CRUD), Editar, Configurações
   - Usa Store (data.js) e MapView (map.js)
   ========================================================================== */
(function () {
  const app = document.getElementById("app");

  // ---------------- helpers de UI/roteamento ----------------
  const h = {
    html(strings, ...vals) {
      return strings.map((s, i) => s + (vals[i] ?? "")).join("");
    },
    nav(to) {
      location.hash = to;
    },
    // redireciona para login se não autenticado
    requireAuth() {
      if (!Store.isAuthed()) {
        location.hash = "#/login";
        return false;
      }
      return true;
    },
    // Casca (layout) comum às páginas internas
    shell(contentHTML) {
      const u = Store.currentUser();
      return `
        <div class="layout">
          <aside class="aside">
            <div class="title">Menu</div>
            <a href="#/home" class="${isActive("#/home")}">Home</a>
            <a href="#/map" class="${isActive("#/map")}">Mapa</a>
            <a href="#/campaigns" class="${isActive(
              "#/campaigns"
            )}">Gerenciar Campanhas</a>
            <a href="#/settings" class="${isActive(
              "#/settings"
            )}">Configurações</a>
          </aside>

          <div class="main">
            <header class="header">
              <div class="brand">Portal WEB</div>
              <div style="display:flex;align-items:center;gap:12px">
                <div class="user">
                  <div style="font-weight:600">${u?.name ?? ""}</div>
                  <div class="muted">${u?.email ?? ""}</div>
                </div>
                <button class="logout" onclick="(Store.logout(),location.hash='#/login')">Logout</button>
              </div>
            </header>
            <div class="content">${contentHTML}</div>
          </div>
        </div>
      `;
      function isActive(prefix) {
        return location.hash.startsWith(prefix) ? "active" : "";
      }
    },
  };

  // ------------------- Telas (Views) -------------------

  // LOGIN: usa onsubmit inline (precisa de window.Login no final do arquivo)
  const Login = {
    render() {
      return `
      <div class="login-wrap">
        <form class="card login-card p24" onsubmit="return Login.submit(event)" autocomplete="off">
          <h2 style="margin:0 0 12px">Portal – Login</h2>

          <label class="label">E-mail</label>
          <input
            id="email"
            class="input"
            type="email"
            placeholder="seu@email.com"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
          />

          <div class="mt12">
            <label class="label">Senha</label>
            <div class="input-with-icon">
              <input
                id="password"
                class="input"
                type="password"
                placeholder="sua senha"
                autocomplete="current-password"
              />
              <button
                id="toggle-pass"
                type="button"
                class="toggle-pass"
                aria-label="Mostrar senha"
                onclick="Login.togglePassword()"
                title="Mostrar senha"
              >${Login.icons.eye}</button>
            </div>
          </div>

          <button class="btn primary login-submit">Entrar</button>


          <!-- Removido o texto “Usuário padrão: ...” -->
          <div id="login-error" style="color:#dc2626;font-size:13px;margin-top:6px;display:none"></div>
        </form>
      </div>
    `;
    },
    async submit(e) {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const pass = document.getElementById("password").value;
      const err = document.getElementById("login-error");
      const submitBtn = document.querySelector(".login-submit");

      // Limpa erro anterior
      err.style.display = "none";
      err.textContent = "";

      // Validação básica
      if (!email || !pass) {
        err.textContent = "Por favor, preencha todos os campos";
        err.style.display = "block";
        return false;
      }

      // Desabilita botão e mostra loading
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Entrando...";

      try {
        const res = await Store.login(email, pass);

        if (!res || !res.user) {
          err.textContent = "Credenciais inválidas";
          err.style.display = "block";
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          return false;
        }

        // Sucesso - redireciona
        location.hash = "#/home";
        return false;
      } catch (error) {
        // Tratamento de erros
        let errorMessage = "Erro ao fazer login";

        if (error.status === 401 || error.status === 403) {
          errorMessage = "E-mail ou senha incorretos";
        } else if (error.status === 0) {
          errorMessage =
            "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (error.status >= 500) {
          errorMessage = "Erro no servidor. Tente novamente mais tarde.";
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message;
        }

        err.textContent = errorMessage;
        err.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return false;
      }
    },
    icons: {
      // olho aberto
      eye: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      // olho cortado
      eyeOff:
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M1 1l22 22"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/></svg>',
    },
    togglePassword() {
      const input = document.getElementById("password");
      const btn = document.getElementById("toggle-pass");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      btn.setAttribute("title", showing ? "Mostrar senha" : "Ocultar senha");
      btn.innerHTML = showing ? Login.icons.eye : Login.icons.eyeOff;
    },
  };

  // HOME: dois cards levando a Mapa e Campanhas
  const Home = {
    render() {
      if (!h.requireAuth()) return "";
      return h.shell(`
        <div class="grid cols-2">
          <a class="card p24" href="#/map">
            <div style="font-weight:600;font-size:18px;margin-bottom:6px">Mapas</div>
            <div class="muted">Acesse o mapa de detecções</div>
          </a>
          <a class="card p24" href="#/campaigns">
            <div style="font-weight:600;font-size:18px;margin-bottom:6px">Gerenciamento de Campanhas</div>
            <div class="muted">Crie e edite campanhas</div>
          </a>
        </div>
      `);
    },
  };

  // MAPA: botões de tamanho + sem filtro de campanha
  const MapPage = {
    _grid: 0.02, // padrão (Médio)

    render() {
      if (!h.requireAuth()) return "";
      return h.shell(`
        <div class="card p16">
          <div class="row cols-2">
            <div>
              <div class="label">Tamanho do quadrante</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${sizeBtn(0.01, "Pequeno")}
                ${sizeBtn(0.02, "Médio")}
                ${sizeBtn(0.05, "Grande")}
              </div>
            </div>
            <div></div>
          </div>
        </div>

        <div id="map" class="mt16"></div>

        <!-- Legenda abaixo do mapa -->
        <div class="legend">
          <span><span class="dot" style="background:var(--orange)"></span> Terreno</span>
          <span><span class="dot" style="background:var(--blue)"></span> Residência/Propriedade</span>
        </div>
      `);

      function sizeBtn(val, label) {
        const active = MapPage._grid === val ? " primary" : "";
        return `<button class="btn${active}" onclick="MapPage.setGrid(${val})">${label}</button>`;
      }
    },

    setGrid(val) {
      this._grid = val;
      // re-render para refletir o "ativo" nos botões
      app.innerHTML = MapPage.render();
      // e já recarrega o mapa
      this.load();
    },

    async load() {
      try {
        // Aguarda os dados da API
        const data = await Store.listDetections();

        // Obtém a cidade do usuário logado
        const user = Store.currentUser();
        const city = user?.city;

        // Tenta obter coordenadas da cidade do usuário
        let center = null;
        if (city && window.google && google.maps && google.maps.Geocoder) {
          try {
            center = await this.getCityCoordinates(city);
          } catch (error) {
            console.warn("Erro ao obter coordenadas da cidade:", error);
          }
        }

        // limite de zoom para exibir a malha/badges
        // (quadrante pequeno requer mais zoom para não "poluir")
        const minZoomByGrid = {
          0.01: 14, // pequeno → esconder malha quando afastar mais que isso
          0.02: 13, // médio
          0.05: 12, // grande
        };
        const min = minZoomByGrid[this._grid] ?? 13;

        const opts = {
          gridSize: this._grid,
          minGridZoom: min,
        };

        // Se tiver centro definido, adiciona às opções
        // (mesmo com dados, o mapa começará na cidade do usuário antes de ajustar aos bounds)
        if (center) {
          opts.center = center;
        }

        MapView.init("map", data, opts);
      } catch (error) {
        console.error("Erro ao carregar mapa:", error);
        // Inicializa o mapa com array vazio em caso de erro
        MapView.init("map", [], {
          gridSize: this._grid,
          minGridZoom: 13,
        });
      }
    },

    // Obtém coordenadas de uma cidade usando Geocoding do Google Maps
    getCityCoordinates(cityName) {
      return new Promise((resolve, reject) => {
        if (!window.google || !google.maps || !google.maps.Geocoder) {
          reject(new Error("Google Maps API não carregada"));
          return;
        }

        const geocoder = new google.maps.Geocoder();
        
        // Adiciona ", Brasil" para melhorar a precisão da busca
        const address = `${cityName}, Brasil`;

        geocoder.geocode({ address }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            reject(new Error(`Geocoding falhou: ${status}`));
          }
        });
      });
    },
  };

  // ---------------------------------------------
  // Helpers de data para campanhas
  // ---------------------------------------------

  // pega a data de hoje em AAAA-MM-DD
  function getTodayISO() {
    const now = new Date(); // aqui é só pra saber "hoje", não converte string nenhuma
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`; // ex: "2025-11-16"
  }

  // garante que a string fique só em "AAAA-MM-DD"
  function onlyDate(isoLike) {
    if (!isoLike) return "";
    return String(isoLike).substring(0, 10); 
    // "2025-11-17T00:00:00.000Z" -> "2025-11-17"
  }

  // recebe "AAAA-MM-DD" ou "AAAA-MM-DDT..." e devolve "dd/MM/AAAA"
  function formatDateBR(isoLike) {
    const iso = onlyDate(isoLike);
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // monta o texto do período em pt-BR
  function formatPeriodBR(period) {
    if (!period || !period.start || !period.end) return "—";
    return `${formatDateBR(period.start)} a ${formatDateBR(period.end)}`;
  }

  // LISTA de campanhas com botão para abrir modal de criação
  const Campaigns = {
    _campaigns: [], // cache das campanhas para usar na visualização

    render() {
      if (!h.requireAuth()) return "";
      return h.shell(`
        <div class="card p24">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h2 style="margin:0">Campanhas</h2>
            <button class="btn primary" onclick="Campaigns.openModal()">Criar nova campanha</button>
          </div>
          <div class="card" style="overflow:auto">
            <table class="table">
              <thead><tr><th>Nome</th><th>Período</th><th>Ativa</th><th></th></tr></thead>
              <tbody id="campaigns-body">
                <tr><td colspan="4" class="muted">Carregando campanhas...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal de criação (abre/fecha via classe .show) -->
        <div class="modal" id="modal-campaign">
          <div class="box">
            <h3 style="margin:0 0 10px">Nova Campanha</h3>
            <form onsubmit="return Campaigns.create(event)">
              <label class="label">Nome</label>
              <input class="input" id="c-title" required/>

              <label class="label mt12">Descrição</label>
              <textarea class="input" id="c-desc" required></textarea>

              <div class="row cols-2 mt12">
                <div>
                  <label class="label">Início</label>
                  <input type="date" class="input" id="c-start" required />
                </div>
                <div>
                  <label class="label">Fim</label>
                  <input type="date" class="input" id="c-end" required />
                </div>
              </div>

              <div class="row cols-2 mt12">
                <div>
                  <label class="label">Informações da campanha (separe por ;)</label>
                  <input class="input" id="c-infos" placeholder="info 1; info 2" />
                </div>
                <div>
                  <label class="label">Orientações (separe por ;)</label>
                  <input class="input" id="c-ori" placeholder="orientação 1; orientação 2" />
                </div>
              </div>

              <!-- área de erro -->
              <div id="c-err" style="color:#dc2626;font-size:13px;margin-top:8px;display:none"></div>

              <div class="mt16" style="display:flex;gap:8px;justify-content:flex-end">
                <button type="button" class="btn" onclick="Campaigns.closeModal()">Cancelar</button>
                <button class="btn primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal de visualização de campanha -->
        <div class="modal" id="modal-campaign-details">
          <div class="box" style="position:relative">
            <button
              type="button"
              onclick="Campaigns.closeDetails()"
              style="position:absolute;top:12px;right:12px;border:none;background:transparent;font-size:20px;cursor:pointer"
              aria-label="Fechar"
            >×</button>

            <h3 style="margin:0 0 10px">Detalhes da Campanha</h3>

            <div class="mt12">
              <div class="label"><b>Nome</b></div>
              <div id="cd-title" class="muted"></div>
            </div>

            <div class="mt12">
              <div class="label"><b>Descrição</b></div>
              <div id="cd-desc" class="muted"></div>
            </div>

            <div class="row cols-2 mt12">
              <div>
                <div class="label"><b>Início</b></div>
                <div id="cd-start" class="muted"></div>
              </div>
              <div>
                <div class="label"><b>Fim</b></div>
                <div id="cd-end" class="muted"></div>
              </div>
            </div>

            <div class="mt12">
              <div class="label"><b>Informações da campanha</b></div>
              <div id="cd-infos" class="muted"></div>
            </div>

            <div class="mt12">
              <div class="label"><b>Orientações</b></div>
              <div id="cd-ori" class="muted"></div>
            </div>
          </div>
        </div>
      `);
    },

    // carrega campanhas do backend e preenche a tabela
    async load() {
      const tbody = document.getElementById("campaigns-body");
      if (!tbody) return;

      try {
        const rows = await Store.listCampaigns();

        if (!rows || !rows.length) {
          Campaigns._campaigns = [];
          tbody.innerHTML =
            `<tr><td colspan="4" class="muted">Nenhuma campanha</td></tr>`;
          return;
        }

        // ordena por data de início (crescente)
        // se início for igual, desempata pela data de fim (crescente)
        const ordered = rows.slice().sort((a, b) => {
          const sa = onlyDate(a.period?.start);
          const sb = onlyDate(b.period?.start);

          // --- comparação por início ---
          if (sa && sb) {
            const cmpStart = sa.localeCompare(sb);
            if (cmpStart !== 0) return cmpStart; // diferentes → já retorna
          } else if (sa && !sb) {
            return -1; // quem tem início definido vem antes
          } else if (!sa && sb) {
            return 1; // quem não tem início vai pro fim
          }

          // --- desempate pela data de fim ---
          const ea = onlyDate(a.period?.end);
          const eb = onlyDate(b.period?.end);

          if (ea && eb) {
            return ea.localeCompare(eb);
          } else if (ea && !eb) {
            return -1;
          } else if (!ea && eb) {
            return 1;
          }

          return 0;
        });

        // guarda em memória para a visualização
        Campaigns._campaigns = ordered;

        tbody.innerHTML = ordered
          .map((c) => {
            const periodText = formatPeriodBR(c.period);
            const active = isCampaignActiveByPeriod(c.period);

            // clique em Nome / Período / Ativa → abre detalhes
            const clickAttrs = `onclick="Campaigns.openDetails(${c.id})" style="cursor:pointer"`;

            return `
              <tr>
                <td ${clickAttrs}>${c.title}</td>
                <td ${clickAttrs}>${periodText}</td>
                <td ${clickAttrs}>${active ? "Sim" : "Não"}</td>
                <td class="text-right">
                  <a href="#/campaigns/${c.id}" class="btn small" onclick="event.stopPropagation()">Editar</a>
                  <button class="btn small danger" onclick="event.stopPropagation(); Campaigns.remove(${c.id})">Excluir</button>
                </td>
              </tr>`;
          })
          .join("");
      } catch (error) {
        console.error(error);
        tbody.innerHTML =
          `<tr><td colspan="4" class="muted">Erro ao carregar campanhas.</td></tr>`;
      }
    },
    
    openDetails(id) {
      const modal = document.getElementById("modal-campaign-details");
      if (!modal) return;

      const c = (Campaigns._campaigns || []).find(
        (x) => String(x.id) === String(id)
      );
      if (!c) return;

      const startText =
        c.period && c.period.start ? formatDateBR(c.period.start) : "—";
      const endText =
        c.period && c.period.end ? formatDateBR(c.period.end) : "—";

      const infosArr = c.campaignInfos || [];
      const oriArr = c.instructionInfos || [];

      const titleEl = document.getElementById("cd-title");
      const descEl = document.getElementById("cd-desc");
      const startEl = document.getElementById("cd-start");
      const endEl = document.getElementById("cd-end");
      const infosEl = document.getElementById("cd-infos");
      const oriEl = document.getElementById("cd-ori");

      if (titleEl) titleEl.textContent = c.title || "";
      if (descEl)
        descEl.textContent =
          c.description && c.description.trim() ? c.description : "—";
      if (startEl) startEl.textContent = startText;
      if (endEl) endEl.textContent = endText;
      if (infosEl)
        infosEl.textContent = infosArr.length ? infosArr.join("; ") : "—";
      if (oriEl)
        oriEl.textContent = oriArr.length ? oriArr.join("; ") : "—";

      modal.classList.add("show");
    },

    closeDetails() {
      const modal = document.getElementById("modal-campaign-details");
      if (modal) modal.classList.remove("show");
    },

    openModal() {
      const modal = document.getElementById("modal-campaign");
      modal.classList.add("show");

      // 🔄 sempre limpar os campos ao abrir o modal
      ["c-title", "c-desc", "c-start", "c-end", "c-img", "c-infos", "c-ori"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      // limpar mensagem de erro, se tiver
      const errEl = document.getElementById("c-err");
      if (errEl) {
        errEl.style.display = "none";
        errEl.textContent = "";
      }

      // definir mínimo como hoje
      const todayStr = new Date().toISOString().slice(0, 10);
      const s = document.getElementById("c-start");
      const e = document.getElementById("c-end");
      if (s) s.min = todayStr;
      if (e) e.min = todayStr;
    },


    closeModal() {
      document.getElementById("modal-campaign").classList.remove("show");
    },

    async create(e) {
      e.preventDefault();

      const title = (document.getElementById("c-title").value || "").trim();
      const description = (
        document.getElementById("c-desc").value || ""
      ).trim();
      const start = document.getElementById("c-start").value;
      const end = document.getElementById("c-end").value;
      const infos = (document.getElementById("c-infos").value || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const ori = (document.getElementById("c-ori").value || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const errEl = document.getElementById("c-err");

      // limpa erro
      errEl.style.display = "none";
      errEl.textContent = "";

      const errors = [];
      if (!description) errors.push("Descrição é obrigatória.");
      if (!start || !end)
        errors.push("Datas de início e término são obrigatórias.");

      // hoje no formato "YYYY-MM-DD" (mesmo formato do input date)
      const todayStr = new Date().toISOString().slice(0, 10);

      // comparação por string evita problema de fuso horário
      if (start && start < todayStr)
        errors.push("Data de início não pode ser anterior a hoje.");
      if (end && end < todayStr)
        errors.push("Data de término não pode ser anterior a hoje.");
      if (start && end && end < start)
        errors.push("Data de término não pode ser anterior à data de início.");

      if (errors.length) {
        errEl.innerHTML = errors.join("<br>");
        errEl.style.display = "block";
        return false;
      }

      const payload = {
        title,
        description,
        period: { start, end },
        is_active: true,
        campaignInfos: infos,
        instructionInfos: ori,
      };

      try {
        await Store.createCampaign(payload);
        Campaigns.closeModal();
        await Campaigns.load();
      } catch (error) {
        console.error(error);
        errEl.textContent =
          error?.message || "Erro ao salvar campanha. Tente novamente.";
        errEl.style.display = "block";
      }

      return false;
    },

    async remove(id) {
      if (!confirm("Excluir campanha?")) return;

      try {
        await Store.deleteCampaign(id);
        // Recarrega a tabela na mesma tela
        await Campaigns.load();
      } catch (error) {
        console.error(error);
        alert(error?.message || "Erro ao excluir campanha.");
      }
    },

  };


  // EDIÇÃO: atualiza ou remove a campanha (buscando no backend)
  const EditCampaign = {
    render(id) {
      if (!h.requireAuth()) return "";
      // casca com placeholder; depois o load() preenche
      return h.shell(`
        <div id="edit-campaign-root">
          <div class="card p24">Carregando campanha...</div>
        </div>
      `);
    },

    async load(id) {
      const root = document.getElementById("edit-campaign-root");
      if (!root) return;

      try {
        const c = await Store.getCampaign(id);

        if (!c) {
          root.innerHTML = `<div class="card p24">Campanha não encontrada.</div>`;
          return;
        }

        root.innerHTML = `
        <form class="card p24" onsubmit="return EditCampaign.save(event, ${
          c.id
        })">
          <h2 style="margin-top:0">Editar Campanha</h2>

          <label class="label">Nome</label>
          <input class="input" id="e-title" value="${escapeHtml(
            c.title
          )}" required />

          <label class="label mt12">Descrição</label>
          <textarea class="input" id="e-desc" required>${escapeHtml(
            c.description || ""
          )}</textarea>

          <div class="row cols-2 mt12">
            <div>
              <label class="label">Início</label>
              <input type="date" class="input" id="e-start" value="${
                c.period?.start || ""
              }" required />
            </div>
            <div>
              <label class="label">Fim</label>
              <input type="date" class="input" id="e-end" value="${
                c.period?.end || ""
              }" required />
            </div>
          </div>

          <div class="row cols-2 mt12">
            <div>
              <label class="label">Informações (separe por ;)</label>
              <input class="input" id="e-infos" value="${escapeHtml(
                (c.campaignInfos || []).join("; ")
              )}" />
            </div>
            <div>
              <label class="label">Orientações (separe por ;)</label>
              <input class="input" id="e-ori" value="${escapeHtml(
                (c.instructionInfos || []).join("; ")
              )}" />
            </div>
          </div>

          <!-- área de erro -->
          <div id="e-err" style="color:#dc2626;font-size:13px;margin-top:8px;display:none"></div>

          <div class="mt16" style="display:flex;justify-content:flex-end">
            <button class="btn primary">Salvar</button>
          </div>

        </form>
        `;
      } catch (error) {
        console.error(error);
        root.innerHTML =
          `<div class="card p24">Erro ao carregar campanha.</div>`;
      }
    },

    async save(e, id) {
      e.preventDefault();

      const title = (document.getElementById("e-title").value || "").trim();
      const description = (
        document.getElementById("e-desc").value || ""
      ).trim();
      const start = document.getElementById("e-start").value;
      const end = document.getElementById("e-end").value;
      const infos = (document.getElementById("e-infos").value || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const ori = (document.getElementById("e-ori").value || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const errEl = document.getElementById("e-err");

      errEl.style.display = "none";
      errEl.textContent = "";

      const errors = [];
      if (!title) errors.push("Nome é obrigatório.");
      if (!description) errors.push("Descrição é obrigatória.");
      if (!start || !end)
        errors.push("Datas de início e término são obrigatórias.");

      const todayStr = new Date().toISOString().slice(0, 10);

      if (start && start < todayStr)
        errors.push("Data de início não pode ser anterior a hoje.");
      if (end && end < todayStr)
        errors.push("Data de término não pode ser anterior a hoje.");
      if (start && end && end < start)
        errors.push("Data de término não pode ser anterior à data de início.");

      if (errors.length) {
        errEl.innerHTML = errors.join("<br>");
        errEl.style.display = "block";
        return false;
      }

      try {
        await Store.updateCampaign(id, {
          title,
          description,
          period: { start, end },
          is_active: true,
          campaignInfos: infos,
          instructionInfos: ori,
        });

        location.hash = "#/campaigns";
      } catch (error) {
        console.error(error);
        errEl.textContent =
          error?.message || "Erro ao salvar campanha. Tente novamente.";
        errEl.style.display = "block";
      }

      return false;
    },

    async remove(id) {
      if (!confirm("Excluir campanha?")) return;
      try {
        await Store.deleteCampaign(id);
        location.hash = "#/campaigns";
      } catch (error) {
        console.error(error);
        alert(error?.message || "Erro ao excluir campanha.");
      }
    },
  };


  // CONFIGURAÇÕES: mostra dados básicos do usuário logado
  const Settings = {
    render() {
      if (!h.requireAuth()) return "";
      const u = Store.currentUser();
      return h.shell(`
      <div class="card p24" style="max-width:560px">
        <h2 style="margin-top:0">Configurações</h2>
        <div class="muted">Prefeitura de <strong>${
          u?.city || "—"
        }</strong></div>
        <div class="muted">E-mail cadastrado: <strong>${
          u?.email || "—"
        }</strong></div>
      </div>
    `);
    },
  };

  // ------------------- Router (controla #/rotas) -------------------
  function router() {
    const r = location.hash || "#/login";

    if (r.startsWith("#/login")) app.innerHTML = Login.render();

    else if (r.startsWith("#/home")) app.innerHTML = Home.render();

    else if (r.startsWith("#/map")) {
      app.innerHTML = MapPage.render();
      MapPage.load();
    } 
    else if (r.startsWith("#/campaigns/")) {
      const id = r.split("/")[2];
      app.innerHTML = EditCampaign.render(id);
      EditCampaign.load(id);
    } 
    else if (r.startsWith("#/campaigns")) {
      app.innerHTML = Campaigns.render();
      if (Campaigns.load) Campaigns.load();
    } 
    else if (r.startsWith("#/settings")) app.innerHTML = Settings.render();
  }
  
  window.addEventListener("hashchange", router);
  window.addEventListener("load", router);

  // ------------------- Utilitário -------------------
  function escapeHtml(s) {
    return (s || "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }

  // Campanha ativa se: início <= hoje <= fim
  function isCampaignActiveByPeriod(period) {
    if (!period || !period.start || !period.end) return false;

    const today = getTodayISO();          // "2025-11-16"
    const start = onlyDate(period.start); // "2025-11-17"
    const end   = onlyDate(period.end);   // "2025-11-28"

    // como tudo está em "AAAA-MM-DD" com zero à esquerda,
    // a comparação de string funciona perfeitamente
    if (today < start) return false;  // ainda não começou
    if (today > end)   return false;  // já terminou
    return true;                      // está dentro do intervalo (inclusive)
  }



  // =================================================================
  // IMPORTANTE: como usamos onsubmit/onclick inline no HTML gerado,
  // precisamos expor as views no escopo global (window) para que
  // o navegador encontre as funções (ex.: Login.submit).
  // =================================================================
  window.Login = Login;
  window.MapPage = MapPage;
  window.Campaigns = Campaigns;
  window.EditCampaign = EditCampaign;
  window.Settings = Settings;
})();
