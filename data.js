/* ==========================================================================
   data.js
   - Camada de dados simples usando localStorage (sem backend)
   - Expõe "window.Store" com métodos: login, listCampaigns, getCampaign,
     createCampaign, updateCampaign, deleteCampaign, listDetections, etc.
   ========================================================================== */
(function (w) {
  const KEY = "portal.store.v1"; // chave única do localStorage

  // ---- Usuário padrão (pode alterar aqui)
  const defaultUser = {
    id: 1,
    name: "Usuário Teste",
    email: "teste@gmail.com",
    password: "teste123",
    city: "Maravilhas",
  };

  // ---- Campanha de exemplo + detecções (para o mapa)
  const sampleCampaign = {
    id: 1,
    title: "Campanha Bairro Caiçara",
    description: "Varredura do bairro para identificar focos.",
    campaignInfos: ["Bater de porta em porta", "Validar endereços GPS"],
    instructionInfos: ["Usar EPI", "Fotografe apenas área externa"],
    image_url:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80",
    period: { start: "2025-08-01", end: "2025-09-30" },
    is_active: true,
    results: [], // preenchido abaixo
  };

  // 12 pontos aleatórios próximos a BH para “popular” o mapa
  const base = { lat: -19.909, lng: -43.973 };
  const rand = () => Math.random() * 0.02 - 0.01;
  const imgs = [
    "https://images.unsplash.com/photo-1523755231516-e43fd2e8dca5?w=800&q=80",
    "https://images.unsplash.com/photo-1542228262-3d663b306a56?w=800&q=80",
    "https://images.unsplash.com/photo-1587502537745-84b94b1c3d9d?w=800&q=80",
    "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80",
  ];
  for (let i = 0; i < 12; i++) {
    const lat = base.lat + rand();
    const lng = base.lng + rand();
    const type =
      i % 3 === 0 ? "terreno" : i % 2 === 0 ? "propriedade" : "residencia";
    const status = ["visualized", "finished", "processing", "failed"][i % 4];
    sampleCampaign.results.push({
      id: i + 1,
      originalImage: imgs[i % imgs.length],
      resultImage: imgs[i % imgs.length],
      type,
      status,
      feedback: { like: i % 2 === 0, comment: i % 2 ? "" : "ok" },
      created_at: Date.now() - i * 86400000,
      lat,
      lng,
      address: "Belo Horizonte - MG",
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
      prefsByUser: {},
    };

    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  }

  function setStore(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  // Converte estrutura antiga (campaigns/detections globais) para buckets por usuário
  function migrate(s) {
    // Se já está migrado, só devolve
    if (s.campaignsByUser && s.detectionsByUser) return s;

    const users = s.users || [];
    const manager =
      users.find((u) => u.email === "teste@gmail.com") || users[0];
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

  // -------- Helpers de mapeamento backend <-> front (campanhas) --------
  function campaignFromBackend(c) {
    if (!c) return null;

    const start = c.created_at ? String(c.created_at).substring(0, 10) : "";
    const end = c.finish_at ? String(c.finish_at).substring(0, 10) : "";

    let isActive = true;
    if (c.finish_at) {
      const d = new Date(c.finish_at);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        isActive = d >= today;
      }
    }

    return {
      id: c.id,
      title: c.title || "Sem título",
      description: c.description || "",
      image_url: "", // backend ainda não envia imagem da campanha
      period: { start, end },
      is_active: isActive,
      campaignInfos: Array.isArray(c.campaign_infos) ? c.campaign_infos : [],
      instructionInfos: Array.isArray(c.instruction_infos)
        ? c.instruction_infos
        : [],
      results: Array.isArray(c.results) ? c.results : [],
    };
  }

  function toDateTime(dateStr, endOfDay) {
    if (!dateStr) return null;
    const parts = String(dateStr).split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    return endOfDay ? `${y}-${m}-${d}T23:59:59` : `${y}-${m}-${d}T00:00:00`;
  }

  // ---- API simples exposta em window.Store
  const Store = {
    clearUserData(userId) {
      const s = getStore();
      if (s.campaignsByUser) delete s.campaignsByUser[userId];
      if (s.detectionsByUser) delete s.detectionsByUser[userId];
      if (s.prefsByUser) delete s.prefsByUser[userId];
      setStore(s);
      return true;
    },

    _currentUserId() {
      return getStore().auth?.userId || null;
    },
    _ensureBuckets(uid) {
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
    async login(email, password) {
      try {
        // Chama a API do backend
        const response = await API.post("/userPortal/login", {
          email,
          password,
        });

        // Verifica se a resposta é de sucesso
        if (response.message !== "success" || !response.profile) {
          throw new Error("Resposta inválida do servidor");
        }

        // Extrai dados do profile
        const profile = response.profile;

        // Tenta achar a cidade em vários campos possíveis (fallback inicial)
        const city =
          profile.city ||
          profile.city_name ||
          profile.cityName ||
          profile.municipio ||
          profile.prefeitura ||
          profile.cidade ||
          "";

        const user = {
          id: profile.id,
          name: profile.name || "",
          email: profile.email || email,
          city, // <- cidade inicial (pode ser atualizada abaixo)
        };

        // Busca informações completas do usuário, incluindo a cidade
        try {
          const userData = await API.get(
            `/userPortal/getUserPortal/${profile.id}`
          );

          // Atualiza os dados do usuário com as informações retornadas
          if (userData) {
            if (userData.name) user.name = userData.name;
            if (userData.email) user.email = userData.email;
            if (userData.city) user.city = userData.city;
          }
        } catch (error) {
          // Se a segunda chamada falhar, continua com os dados do login inicial
          // (comportamento defensivo - não bloqueia o login)
          console.warn("Erro ao buscar dados completos do usuário:", error);
        }

        // Armazena dados do usuário (sem token)
        const s = getStore();
        s.auth = {
          userId: user.id,
          user: user, // armazena dados completos para currentUser()
        };
        setStore(s);

        return { user };
      } catch (error) {
        // Propaga o erro para ser tratado no app.js
        throw error;
      }
    },

    logout() {
      const s = getStore();
      s.auth = { userId: null, user: null };
      setStore(s);
    },
    currentUser() {
      const s = getStore();
      // Prioriza dados do usuário armazenados no auth (vindos do backend)
      if (s.auth && s.auth.user) {
        return s.auth.user;
      }
      // Fallback: tenta buscar do array de users (para compatibilidade)
      if (s.auth && s.auth.userId) {
        const u = s.users?.find((x) => x.id === s.auth.userId);
        if (u) {
          return { id: u.id, name: u.name, email: u.email, city: u.city };
        }
      }
      return null;
    },
    isAuthed() {
      const s = getStore();
      return !!(s.auth && s.auth.userId && s.auth.user);
    },

    // Campanhas (integração com backend)
    async listCampaigns() {
      const user = this.currentUser();
      if (!user || !user.id) return [];

      try {
        // lista campanhas da prefeitura logada
        const res = await API.get(
          `/campaigns/getCampaignByUserPortal/${user.id}`
        );

        const campaigns =
          res && Array.isArray(res.campaigns) ? res.campaigns : [];

        return campaigns.map(campaignFromBackend);
      } catch (error) {
        console.error("Erro ao carregar campanhas:", error);
        throw error;
      }
    },

    async getCampaign(id) {
      if (!id) return null;
      try {
        const c = await API.get(`/campaigns/getCampaign/${id}`);
        return campaignFromBackend(c);
      } catch (error) {
        console.error("Erro ao buscar campanha:", error);
        throw error;
      }
    },

    async createCampaign(payload) {
      const user = this.currentUser();
      if (!user) throw new Error("Sem usuário logado");

      const body = {
        title: (payload.title || "").trim() || "Sem título",
        description: payload.description || "",
        city: user.city || "Não informada",
        campaign_infos: payload.campaignInfos || [],
        instruction_infos: payload.instructionInfos || [],
        created_at: toDateTime(
          payload.period && payload.period.start,
          /*endOfDay*/ false
        ),
        finish_at: toDateTime(
          payload.period && payload.period.end,
          /*endOfDay*/ true
        ),
      };

      try {
        const res = await API.post("/campaigns/createCampaign", body);
        const saved = res && res.campaign ? res.campaign : res;
        return campaignFromBackend(saved);
      } catch (error) {
        console.error("Erro ao criar campanha:", error);
        throw error;
      }
    },

    async updateCampaign(id, patch) {
      if (!id) throw new Error("ID da campanha é obrigatório");

      const body = {};

      if ("title" in patch) {
        body.title = (patch.title || "").trim();
      }
      if ("description" in patch) {
        body.description = patch.description || "";
      }

      if ("campaignInfos" in patch) {
        body.campaign_infos = patch.campaignInfos || [];
      }
      if ("instructionInfos" in patch) {
        body.instruction_infos = patch.instructionInfos || [];
      }

      if (patch.period) {
        if (patch.period.start) {
          body.created_at = toDateTime(patch.period.start, false);
        }
        if (patch.period.end) {
          body.finish_at = toDateTime(patch.period.end, true);
        }
      }

      try {
        const updated = await API.put(`/campaigns/updateCampaign/${id}`, body);
        return campaignFromBackend(updated);
      } catch (error) {
        console.error("Erro ao atualizar campanha:", error);
        throw error;
      }
    },

    async deleteCampaign(id) {
      if (!id) throw new Error("ID da campanha é obrigatório");
      try {
        await API.delete(`/campaigns/deleteCampaign/${id}`);
        return true;
      } catch (error) {
        console.error("Erro ao excluir campanha:", error);
        throw error;
      }
    },

    // Detecções usadas pelo mapa (com filtro opcional por campaignId)
    listDetections(campaignId) {
      const uid = this._currentUserId();
      if (!uid) return [];
      const s = getStore();
      this._ensureBuckets(uid);
      let arr = s.detectionsByUser[uid] || [];
      if (campaignId) {
        arr = arr.filter((d) => String(d.campaignId) === String(campaignId));
      }
      return arr.slice();
    },
  };

  // Expondo globalmente para o restante do app
  w.Store = Store;
})(window);
