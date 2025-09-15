/* ==========================================================================
   map.js
   - Encapsula a visualização do mapa (Leaflet) em "window.MapView"
   - Renderiza marcadores / popups
   - Desenha quadrantes (grid) e contadores por célula
   ========================================================================== */
(function (w) {
  const MapView = {
    map: null,        // instância do Leaflet
    markers: [],      // marcadores atuais
    gridLayer: null,  // camada com linhas do grid
    countLayer: null, // camada com os contadores por quadrante

    /**
     * Inicializa o mapa
     * @param {string} el - id do elemento (ex.: 'map')
     * @param {Array} data - lista de detecções [{lat,lng,type,...}]
     * @param {Object} options - { center, zoom, gridSize }
     */
    init(el, data, options = {}) {
      const center = options.center || [-19.92, -43.95]; // BH
      const zoom = options.zoom || 13;
      const gridSize = options.gridSize || 0.02; // graus (~2km)

      // Cria o mapa e adiciona tiles do OpenStreetMap
      this.map = L.map(el, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);

      // Limpa marcadores anteriores e adiciona novos
      this.markers.forEach(m => m.remove());
      this.markers = data.map(d => {
        const color = d.type === 'terreno' ? 'orange' : 'blue';
        const iconUrl = color === 'orange'
          ? 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
          : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        const icon = L.icon({ iconUrl, iconSize: [32,32], iconAnchor: [16,32] });
        const m = L.marker([d.lat, d.lng], { icon }).addTo(this.map);

        // Popup com mini-informações
        m.bindPopup(`
          <div style="max-width:260px">
            <div style="font-weight:600;margin-bottom:6px">Imagens</div>
            <div style="display:flex;gap:6px;margin-bottom:8px">
              <img src="${d.originalImage}" style="width:72px;height:72px;object-fit:cover;border-radius:8px">
              <img src="${d.resultImage}" style="width:72px;height:72px;object-fit:cover;border-radius:8px">
            </div>
            <div style="font-weight:600;margin:4px 0 2px">Informações</div>
            <div style="font-size:13px;color:#111">
              <div>Tipo: ${d.type}</div>
              <div>Status: ${d.status}</div>
              <div>Like: ${d.feedback?.like ? '👍' : '—'}</div>
              <div>Comentário: ${d.feedback?.comment || '—'}</div>
            </div>
          </div>
        `);
        return m;
      });

      // Desenha grid + contagens conforme a área visível
      const bounds = this.map.getBounds();
      this._drawGrid(bounds, gridSize);
      this._drawCounts(data, gridSize);

      // Redesenha quando o usuário move/da zoom
      this.map.on('moveend', () => {
        const b = this.map.getBounds();
        this._drawGrid(b, gridSize);
        this._drawCounts(data, gridSize);
      });
    },

    // Linhas do grid (latitude/longitude)
    _drawGrid(bounds, size) {
      if (this.gridLayer) this.gridLayer.remove();
      const latMin = Math.floor(bounds.getSouth() / size) * size;
      const latMax = Math.ceil(bounds.getNorth() / size) * size;
      const lngMin = Math.floor(bounds.getWest() / size) * size;
      const lngMax = Math.ceil(bounds.getEast() / size) * size;

      this.gridLayer = L.layerGroup().addTo(this.map);

      for (let lat = latMin; lat <= latMax; lat += size) {
        L.polyline([[lat, lngMin], [lat, lngMax]], { color: '#3b82f6', weight: 1, opacity: 0.4 })
          .addTo(this.gridLayer);
      }
      for (let lng = lngMin; lng <= lngMax; lng += size) {
        L.polyline([[latMin, lng], [latMax, lng]], { color: '#3b82f6', weight: 1, opacity: 0.4 })
          .addTo(this.gridLayer);
      }
    },

    // Contadores por célula (badge com azul=residência/propriedade, laranja=terreno)
    _drawCounts(data, size) {
      if (this.countLayer) this.countLayer.remove();
      this.countLayer = L.layerGroup().addTo(this.map);

      const m = new Map();
      for (const d of data) {
        const ky = `${Math.floor(d.lat/size)}:${Math.floor(d.lng/size)}`;
        if (!m.has(ky)) m.set(ky,{t:0,r:0,p:0,lat:Math.floor(d.lat/size)*size+size/2,lng:Math.floor(d.lng/size)*size+size/2});
        const o = m.get(ky);
        if (d.type==='terreno') o.t++; else if (d.type==='residencia') o.r++; else o.p++;
      }

      m.forEach((o) => {
        const html = `
          <div class="badge">
            <span class="chip"><i style="background:${'#3b82f6'}"></i> ${o.r+o.p}</span>
            <span class="chip"><i style="background:${'#f97316'}"></i> ${o.t}</span>
          </div>`;
        L.marker([o.lat, o.lng], { icon: L.divIcon({className:'', html, iconSize:[70,26], iconAnchor:[35,13]}) })
          .addTo(this.countLayer);
      });
    }
  };

  // Expondo no escopo global
  w.MapView = MapView;
})(window);