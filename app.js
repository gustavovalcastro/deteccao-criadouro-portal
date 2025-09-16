/* ==========================================================================
   app.js
   - SPA muito simples com "hash router" (#/rota)
   - Telas: Login, Home, Mapa, Campanhas (CRUD), Editar, Configurações
   - Usa Store (data.js) e MapView (map.js)
   ========================================================================== */
(function () {
  const app = document.getElementById('app');

  // ---------------- helpers de UI/roteamento ----------------
  const h = {
    html(strings, ...vals){ return strings.map((s,i)=>s+(vals[i]??'')).join('') },
    nav(to){ location.hash = to },
    // redireciona para login se não autenticado
    requireAuth(){
      if (!Store.isAuthed()) { location.hash = '#/login'; return false; }
      return true;
    },
    // Casca (layout) comum às páginas internas
    shell(contentHTML){
      const u = Store.currentUser();
      return `
        <div class="layout">
          <aside class="aside">
            <div class="title">Menu</div>
            <a href="#/home" class="${isActive('#/home')}">Home</a>
            <a href="#/map" class="${isActive('#/map')}">Mapa</a>
            <a href="#/campaigns" class="${isActive('#/campaigns')}">Gerenciar Campanhas</a>
            <a href="#/settings" class="${isActive('#/settings')}">Configurações</a>
          </aside>

          <div class="main">
            <header class="header">
              <div class="brand">Portal WEB</div>
              <div style="display:flex;align-items:center;gap:12px">
                <div class="user">
                  <div style="font-weight:600">${u?.name ?? ''}</div>
                  <div class="muted">${u?.email ?? ''}</div>
                </div>
                <button class="logout" onclick="(Store.logout(),location.hash='#/login')">Logout</button>
              </div>
            </header>
            <div class="content">${contentHTML}</div>
          </div>
        </div>
      `;
      function isActive(prefix){ return location.hash.startsWith(prefix) ? 'active' : '' }
    }
  };

  // ------------------- Telas (Views) -------------------

  // LOGIN: usa onsubmit inline (precisa de window.Login no final do arquivo)
  const Login = {
  render(){
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
  submit(e){
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('password').value;

    const res = Store.login(email, pass); // valida contra os padrões do data.js
    const err = document.getElementById('login-error');

    if (!res){
      err.textContent = 'Credenciais inválidas';
      err.style.display='block';
      return false;
    }
    location.hash = '#/home';
    return false;
  },
  icons:{
      // olho aberto
      eye:'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      // olho cortado
      eyeOff:'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M1 1l22 22"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/></svg>'
  },
    togglePassword(){
      const input = document.getElementById('password');
      const btn = document.getElementById('toggle-pass');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      btn.setAttribute('title', showing ? 'Mostrar senha' : 'Ocultar senha');
      btn.innerHTML = showing ? Login.icons.eye : Login.icons.eyeOff;
  }
};


  // HOME: dois cards levando a Mapa e Campanhas
  const Home = {
    render(){
      if (!h.requireAuth()) return '';
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
    }
  };

  // MAPA: filtro opcional por ID de campanha e ajuste do tamanho de quadrante
  const MapPage = {
    render(){
      if (!h.requireAuth()) return '';
      return h.shell(`
        <div class="card p16">
          <div class="row cols-2">
            <div>
              <div class="label">Filtrar por ID de Campanha (opcional)</div>
              <input class="input" id="filter-campaign" placeholder="ex.: 1" />
            </div>
            <div>
              <div class="label">Tamanho do quadrante (graus)</div>
              <input class="input" id="grid-size" type="number" step="0.005" value="0.02" />
            </div>
          </div>
          <div class="mt12">
            <button class="btn primary" onclick="MapPage.load()">Recarregar</button>
          </div>
        </div>
        <div id="map" class="mt16"></div>
        <!-- Legenda das cores -->
        <div class="legend">
          <span><span class="dot" style="background:var(--orange)"></span> Terreno</span>
          <span><span class="dot" style="background:var(--blue)"></span> Residência/Propriedade</span>
        </div>
      `);
    },
    load(){
      const id = document.getElementById('filter-campaign').value.trim();
      const grid = parseFloat(document.getElementById('grid-size').value) || 0.02;
      const data = Store.listDetections(id || undefined);
      MapView.init('map', data, { gridSize: grid });
    }
  };

  // LISTA de campanhas com botão para abrir modal de criação
  const Campaigns = {
    render(){
      if (!h.requireAuth()) return '';
      const rows = Store.listCampaigns();
      const table = rows.map(c => `
        <tr>
          <td>${c.title}</td>
          <td>${(c.period?.start||'—')} – ${(c.period?.end||'—')}</td>
          <td>${c.is_active ? 'Sim' : 'Não'}</td>
          <td class="text-right">
            <a href="#/campaigns/${c.id}" class="btn small">Editar</a>
          </td>
        </tr>`).join('');
      return h.shell(`
        <div class="card p24">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h2 style="margin:0">Campanhas</h2>
            <button class="btn primary" onclick="Campaigns.openModal()">Criar nova campanha</button>
          </div>
          <div class="card" style="overflow:auto">
            <table class="table">
              <thead><tr><th>Nome</th><th>Período</th><th>Ativa</th><th></th></tr></thead>
              <tbody>${table || `<tr><td colspan="4" class="muted">Nenhuma campanha</td></tr>`}</tbody>
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

              <label class="label mt12">Imagem (URL)</label>
              <input class="input" id="c-img" />

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
      `);
    },
    openModal(){
      document.getElementById('modal-campaign').classList.add('show');
      // define o mínimo como hoje
      const todayStr = new Date().toISOString().slice(0,10);
      const s = document.getElementById('c-start');
      const e = document.getElementById('c-end');
      if (s) s.min = todayStr;
      if (e) e.min = todayStr;
    },
    closeModal(){ document.getElementById('modal-campaign').classList.remove('show'); },
    create(e){
      e.preventDefault();

      const title = (document.getElementById('c-title').value || '').trim();
      const description = (document.getElementById('c-desc').value || '').trim();
      const start = document.getElementById('c-start').value;
      const end   = document.getElementById('c-end').value;
      const image = (document.getElementById('c-img').value || '').trim();
      const infos = (document.getElementById('c-infos').value || '').split(';').map(s=>s.trim()).filter(Boolean);
      const ori   = (document.getElementById('c-ori').value || '').split(';').map(s=>s.trim()).filter(Boolean);
      const errEl = document.getElementById('c-err');

      // limpa erro
      errEl.style.display = 'none'; errEl.textContent = '';

      const errors = [];
      // regras solicitadas
      if (!description) errors.push('Descrição é obrigatória.');
      if (!start || !end) errors.push('Datas de início e término são obrigatórias.');

      const today = new Date(); today.setHours(0,0,0,0);
      const dStart = start ? new Date(start) : null;
      const dEnd   = end   ? new Date(end)   : null;

      if (dStart && dStart < today) errors.push('Data de início não pode ser anterior a hoje.');
      if (dEnd   && dEnd   < today) errors.push('Data de término não pode ser anterior a hoje.');
      // (opcional mas recomendado)
      if (dStart && dEnd && dEnd < dStart) errors.push('Data de término não pode ser anterior à data de início.');

      if (errors.length){
        errEl.innerHTML = errors.join('<br>');
        errEl.style.display = 'block';
        return false;
      }

      const payload = {
        title,
        description,
        image_url: image,
        period: { start, end },
        is_active: true,
        campaignInfos: infos,
        instructionInfos: ori
      };

      Store.createCampaign(payload);
      Campaigns.closeModal();
      location.reload();
      return false;
    }
  };

  // EDIÇÃO: atualiza ou remove a campanha
  const EditCampaign = {
    render(id){
      if (!h.requireAuth()) return '';
      const c = Store.getCampaign(id);
      if (!c) return h.shell(`<div class="card p24">Campanha não encontrada.</div>`);

      const todayStr = new Date().toISOString().slice(0,10);

      return h.shell(`
        <form class="card p24" onsubmit="return EditCampaign.save(event, ${c.id})">
          <h2 style="margin-top:0">Editar Campanha</h2>

          <label class="label">Nome</label>
          <input class="input" id="e-title" value="${escapeHtml(c.title)}" required />

          <label class="label mt12">Descrição</label>
          <textarea class="input" id="e-desc" required>${escapeHtml(c.description||'')}</textarea>

          <div class="row cols-2 mt12">
            <div>
              <label class="label">Início</label>
              <input type="date" class="input" id="e-start" value="${c.period?.start||''}" min="${todayStr}" required />
            </div>
            <div>
              <label class="label">Fim</label>
              <input type="date" class="input" id="e-end" value="${c.period?.end||''}" min="${todayStr}" required />
            </div>
          </div>

          <label class="label mt12">Imagem (URL)</label>
          <input class="input" id="e-img" value="${escapeHtml(c.image_url||'')}" />

          <div class="row cols-2 mt12">
            <div>
              <label class="label">Informações (separe por ;)</label>
              <input class="input" id="e-infos" value="${escapeHtml((c.campaignInfos||[]).join('; '))}" />
            </div>
            <div>
              <label class="label">Orientações (separe por ;)</label>
              <input class="input" id="e-ori" value="${escapeHtml((c.instructionInfos||[]).join('; '))}" />
            </div>
          </div>

          <!-- área de erro -->
          <div id="e-err" style="color:#dc2626;font-size:13px;margin-top:8px;display:none"></div>

          <div class="mt16" style="display:flex;justify-content:space-between">
            <button type="button" class="btn" onclick="EditCampaign.remove(${c.id})">Excluir</button>
            <button class="btn primary">Salvar</button>
          </div>
        </form>
      `);
    },
    save(e, id){
      e.preventDefault();

      const title = (document.getElementById('e-title').value || '').trim();
      const description = (document.getElementById('e-desc').value || '').trim();
      const start = document.getElementById('e-start').value;
      const end   = document.getElementById('e-end').value;
      const image = (document.getElementById('e-img').value || '').trim();
      const infos = (document.getElementById('e-infos').value || '').split(';').map(s=>s.trim()).filter(Boolean);
      const ori   = (document.getElementById('e-ori').value || '').split(';').map(s=>s.trim()).filter(Boolean);
      const errEl = document.getElementById('e-err');

      errEl.style.display = 'none'; errEl.textContent = '';

      const errors = [];
      // regras solicitadas
      if (!title) errors.push('Nome é obrigatório.');
      if (!description) errors.push('Descrição é obrigatória.');
      if (!start || !end) errors.push('Datas de início e término são obrigatórias.');

      const today = new Date(); today.setHours(0,0,0,0);
      const dStart = start ? new Date(start) : null;
      const dEnd   = end   ? new Date(end)   : null;

      if (dStart && dStart < today) errors.push('Data de início não pode ser anterior a hoje.');
      if (dEnd   && dEnd   < today) errors.push('Data de término não pode ser anterior a hoje.');
      // (opcional mas recomendado)
      if (dStart && dEnd && dEnd < dStart) errors.push('Data de término não pode ser anterior à data de início.');

      if (errors.length){
        errEl.innerHTML = errors.join('<br>');
        errEl.style.display = 'block';
        return false;
      }

      Store.updateCampaign(id, {
        title,
        description,
        image_url: image,
        period: { start, end },
        is_active: true,
        campaignInfos: infos,
        instructionInfos: ori
      });

      location.hash = '#/campaigns';
      return false;
    },

    remove(id){
      if (!confirm('Excluir campanha?')) return;
      Store.deleteCampaign(id);
      location.hash = '#/campaigns';
    }
  };

  // CONFIGURAÇÕES: mostra dados básicos do usuário logado
const Settings = {
  render(){
    if (!h.requireAuth()) return '';
    const u = Store.currentUser();
    return h.shell(`
      <div class="card p24" style="max-width:560px">
        <h2 style="margin-top:0">Configurações</h2>
        <div class="muted">Prefeitura de <strong>${u?.city || '—'}</strong></div>
        <div class="muted">E-mail cadastrado: <strong>${u?.email || '—'}</strong></div>
      </div>
    `);
  }
};

  // ------------------- Router (controla #/rotas) -------------------
  function router() {
    const r = location.hash || '#/login';
    if (r.startsWith('#/login')) app.innerHTML = Login.render();
    else if (r.startsWith('#/home')) app.innerHTML = Home.render();
    else if (r.startsWith('#/map')) { app.innerHTML = MapPage.render(); MapPage.load(); }
    else if (r.startsWith('#/campaigns/')) {
      const id = r.split('/')[2]; app.innerHTML = EditCampaign.render(id);
    }
    else if (r.startsWith('#/campaigns')) app.innerHTML = Campaigns.render();
    else if (r.startsWith('#/settings')) app.innerHTML = Settings.render();
    else app.innerHTML = Login.render();
  }
  window.addEventListener('hashchange', router);
  window.addEventListener('load', router);

  // ------------------- Utilitário -------------------
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }

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