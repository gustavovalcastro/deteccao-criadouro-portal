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
    if (raw) return JSON.parse(raw);
    const seed = {
      auth: { token: null, userId: null },
      users: [defaultUser],
      campaigns: [sampleCampaign]
    };
    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  }
  function setStore(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  // ---- API simples exposta em window.Store
  const Store = {
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
    listCampaigns() { return getStore().campaigns.map(c => ({...c, results: undefined})); },
    getCampaign(id) {
      const c = getStore().campaigns.find(x => x.id == id);
      return c ? JSON.parse(JSON.stringify(c)) : null; // cópia defensiva
    },
    createCampaign(payload) {
      const s = getStore();
      const id = (s.campaigns.at(-1)?.id || 0) + 1;
      const c = { id, title: payload.title, description: payload.description || '', image_url: payload.image_url || '',
        period: payload.period || {start:'', end:''}, is_active: !!payload.is_active,
        campaignInfos: payload.campaignInfos || [], instructionInfos: payload.instructionInfos || [], results: [] };
      s.campaigns.push(c); setStore(s); return c;
    },
    updateCampaign(id, patch) {
      const s = getStore();
      const idx = s.campaigns.findIndex(x => x.id == id);
      if (idx === -1) return null;
      s.campaigns[idx] = { ...s.campaigns[idx], ...patch };
      setStore(s);
      return s.campaigns[idx];
    },
    deleteCampaign(id) {
      const s = getStore();
      const idx = s.campaigns.findIndex(x => x.id == id);
      if (idx === -1) return false;
      s.campaigns.splice(idx, 1); setStore(s); return true;
    },

    // Detecções usadas pelo mapa (com filtro opcional por campaignId)
    listDetections(campaignId) {
      const s = getStore();
      const all = s.campaigns.flatMap(c => (c.results || []).map(r => ({...r, campaignId: c.id})));
      return campaignId ? all.filter(x => x.campaignId == campaignId) : all;
    }
  };

  // Expondo globalmente para o restante do app
  w.Store = Store;
})(window);