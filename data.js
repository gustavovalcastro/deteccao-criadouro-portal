/* ==========================================================================
   data.js
   - Camada de dados simples usando localStorage (sem backend)
   - Expõe "window.Store" com métodos: login, listCampaigns, getCampaign,
     createCampaign, updateCampaign, deleteCampaign, listDetections, etc.
   ========================================================================== */
(function (w) {
  const KEY = 'portal.store.v1'; // chave única do localStorage

  // ---- Usuário padrão (pode alterar aqui)
  const defaultUser = {
    id: 1, name: 'Usuário Teste',
    email: 'teste@gmail.com', password: 'teste123',
    city: 'Maravilhas'
  };

  // ---- Campanha de exemplo + detecções (para o mapa)
  const sampleCampaign = {
    id: 1,
    title: 'Campanha Bairro Caiçara',
    description: 'Varredura do bairro para identificar focos.',
    campaignInfos: ['Bater de porta em porta', 'Validar endereços GPS'],
    instructionInfos: ['Usar EPI', 'Fotografe apenas área externa'],
    image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80',
    period: { start: '2025-08-01', end: '2025-09-30' },
    is_active: true,
    results: [] // preenchido abaixo
  };

  // 12 pontos aleatórios próximos a BH para “popular” o mapa
  const base = { lat: -19.909, lng: -43.973 };
  const rand = () => (Math.random() * 0.02 - 0.01);
  const imgs = [
    'https://images.unsplash.com/photo-1523755231516-e43fd2e8dca5?w=800&q=80',
    'https://images.unsplash.com/photo-1542228262-3d663b306a56?w=800&q=80',
    'https://images.unsplash.com/photo-1587502537745-84b94b1c3d9d?w=800&q=80',
    'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80'
  ];
  for (let i = 0; i < 12; i++) {
    const lat = base.lat + rand();
    const lng = base.lng + rand();
    const type = i % 3 === 0 ? 'terreno' : (i % 2 === 0 ? 'propriedade' : 'residencia');
    const status = ['visualized','finished','processing','failed'][i % 4];
    sampleCampaign.results.push({
      id: i + 1,
      originalImage: imgs[i % imgs.length],
      resultImage: imgs[i % imgs.length],
      type, status,
      feedback: { like: i % 2 === 0, comment: i % 2 ? '' : 'ok' },
      created_at: Date.now() - i * 86400000,
      lat, lng, address: 'Belo Horizonte - MG'
    });
  }

  // ---- Carrega ou cria o "banco" no localStorage
  function getStore() {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw)); // <- usa a migração se já houver dados

    // --- Usuário gestor padrão (você já tem defaultUser definido acima) ---
    // defaultUser deve ter id, name, email: 'teste@gmail.com', password: 'teste123', city, role: 'manager'

    // --- Campanha exemplo (se você já tem sampleCampaign definido, mantenha) ---
    // sampleCampaign: { id, title, description, image_url, period, is_active, campaignInfos, instructionInfos }

    // Agora o seed nasce com buckets por usuário
    const seed = {
      auth: { token: null, userId: null },
      users: [defaultUser],

      // >>> DADOS “POR USUÁRIO” <<<
      campaignsByUser: { [defaultUser.id]: [sampleCampaign] },
      detectionsByUser: { [defaultUser.id]: [] },
      prefsByUser: {}
    };

    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  }

  function setStore(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  // Converte estrutura antiga (campaigns/detections globais) para buckets por usuário
  function migrate(s) {
    // Se já está migrado, só devolve
    if (s.campaignsByUser && s.detectionsByUser) return s;

    const users = s.users || [];
    const manager = users.find(u => u.email === 'teste@gmail.com') || users[0];
    const mid = manager ? manager.id : 1;

    s.campaignsByUser = s.campaignsByUser || {};
    s.detectionsByUser = s.detectionsByUser || {};
    s.prefsByUser = s.prefsByUser || {};

    // Move arrays antigos (se existirem) para o gestor
    if (Array.isArray(s.campaigns) && !s.campaignsByUser[mid]) {
      s.campaignsByUser[mid] = s.campaigns;
      delete s.campaigns;
    }
    if (Array.isArray(s.detections) && !s.detectionsByUser[mid]) {
      s.detectionsByUser[mid] = s.detections;
      delete s.detections;
    }

    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  // ---- API simples exposta em window.Store
  const Store = {

    clearUserData(userId){
      const s = getStore();
      if (s.campaignsByUser) delete s.campaignsByUser[userId];
      if (s.detectionsByUser) delete s.detectionsByUser[userId];
      if (s.prefsByUser) delete s.prefsByUser[userId];
      setStore(s);
      return true;
    },


    _currentUserId(){
      return getStore().auth?.userId || null;
    },
    _ensureBuckets(uid){
      const s = getStore();
      s.campaignsByUser = s.campaignsByUser || {};
      s.detectionsByUser = s.detectionsByUser || {};
      s.prefsByUser = s.prefsByUser || {};
      if (!s.campaignsByUser[uid]) s.campaignsByUser[uid] = [];
      if (!s.detectionsByUser[uid]) s.detectionsByUser[uid] = [];
      if (!s.prefsByUser[uid]) s.prefsByUser[uid] = {};
      setStore(s);
    },

    // Autenticação
    login(email, password) {
      const s = getStore();
      const u = s.users.find(x => x.email === email && x.password === password);
      if (!u) return null;
      s.auth = { token: 'devtoken', userId: u.id };
      setStore(s);
      return { token: 'devtoken', user: { id: u.id, name: u.name, email: u.email, city: u.city } };
    },
    logout() { const s = getStore(); s.auth = { token: null, userId: null }; setStore(s); },
    currentUser() {
      const s = getStore();
      const u = s.users.find(x => x.id === s.auth.userId);
      return u ? { id: u.id, name: u.name, email: u.email, city: u.city } : null;
    },
    isAuthed() { return !!getStore().auth.token; },
    

    // Campanhas
    listCampaigns(){
      const uid = this._currentUserId(); if (!uid) return [];
      const s = getStore(); this._ensureBuckets(uid);
      return (s.campaignsByUser[uid] || []).slice();
    },

    getCampaign(id){
      const uid = this._currentUserId(); if (!uid) return null;
      const s = getStore(); this._ensureBuckets(uid);
      return (s.campaignsByUser[uid] || []).find(c => c.id == id) || null;
    },

    createCampaign(payload){
      const uid = this._currentUserId(); if (!uid) throw new Error('Sem usuário logado');
      const s = getStore(); this._ensureBuckets(uid);
      const list = s.campaignsByUser[uid];
      const nextId = list.reduce((m,c)=>Math.max(m, Number(c.id)||0), 0) + 1;

      const c = {
        id: nextId,
        title: payload.title?.trim() || 'Sem título',
        description: payload.description || '',
        image_url: payload.image_url || '',
        period: payload.period || { start: '', end: '' },
        is_active: !!payload.is_active,
        campaignInfos: payload.campaignInfos || [],
        instructionInfos: payload.instructionInfos || [],
        results: payload.results || []
      };
      list.push(c);
      setStore(s);
      return c;
    },

    updateCampaign(id, patch){
      const uid = this._currentUserId(); if (!uid) throw new Error('Sem usuário logado');
      const s = getStore(); this._ensureBuckets(uid);
      const list = s.campaignsByUser[uid];
      const i = list.findIndex(c => c.id == id);
      if (i === -1) throw new Error('Campanha não encontrada');

      list[i] = {
        ...list[i],
        ...patch,
        title: (patch.title ?? list[i].title)?.trim()
      };
      setStore(s);
      return list[i];
    },

    deleteCampaign(id){
      const uid = this._currentUserId(); if (!uid) throw new Error('Sem usuário logado');
      const s = getStore(); this._ensureBuckets(uid);
      const list = s.campaignsByUser[uid];
      const i = list.findIndex(c => c.id == id);
      if (i === -1) throw new Error('Campanha não encontrada');

      list.splice(i, 1);
      setStore(s);
      return true;
    },


    // Detecções usadas pelo mapa (com filtro opcional por campaignId)
    listDetections(campaignId){
      const uid = this._currentUserId(); if (!uid) return [];
      const s = getStore(); this._ensureBuckets(uid);
      let arr = (s.detectionsByUser[uid] || []);
      if (campaignId) {
        arr = arr.filter(d => String(d.campaignId) === String(campaignId));
      }
      return arr.slice();
    },

  };

  // Expondo globalmente para o restante do app
  w.Store = Store;
})(window);