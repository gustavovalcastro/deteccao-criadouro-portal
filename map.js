/* ==========================================================================
   map.js — Google Maps (quadrantes clicáveis + marcadores + painel lateral)
   API: MapView.init(containerId, data?, { gridSize, center, zoom })
   - data: [{id, lat, lng, type:'propriedade'|'terreno', originalImage, resultImage, created_at, campaignId?}]
   - se data vier vazio, gera pontos simulados ao redor do centro
   ========================================================================== */
const MapView = (function () {
  let map;
  let markers = [];
  let overlays = []; // retângulos + badges
  let cfg = null; // config ativa (center, zoom, gridSize, minGridZoom)

  const DEFAULTS = {
    center: { lat: -19.9191, lng: -43.9386 }, // BH (ajuste se quiser)
    zoom: 13,
    gridSize: 0.02, // graus
    minGridZoom: 13, // abaixo disso a malha e os badges somem
  };

  function init(containerId, data = [], opts = {}) {
    if (!(window.google && google.maps)) {
      const el = document.getElementById(containerId);
      el.innerHTML = `<div class="card p24">Google Maps API não carregou. Verifique a chave em <code>index.html</code>.</div>`;
      return;
    }

    cfg = Object.assign({}, DEFAULTS, opts);
    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="gmap-wrap" map-id="DEMO_MAP_ID">
        <div id="${containerId}-canvas" class="gmap-canvas"></div>
        <div id="${containerId}-panel" class="gmap-panel">
          <div class="muted">Clique em um quadrante para ver a lista.</div>
        </div>
      </div>
    `;
    const canvas = document.getElementById(`${containerId}-canvas`);
    const panel  = document.getElementById(`${containerId}-panel`);

    map = new google.maps.Map(canvas, {
      mapId: "DEMO_MAP_ID",
      center: cfg.center,
      zoom: cfg.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Normaliza/gera dados
    const points = ensureData(data, cfg.center);

    // Ajusta viewport aos pontos (se houver)
    if (points.length) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, { top: 16, bottom: 16, left: 16, right: 16 });
    }

    // Cria marcadores (azul: residência; laranja: terreno)
    addMarkers(points);

    // Desenha a grade e atualiza quando o mapa ficar “idle”
    drawGrid(cfg.gridSize, points, panel);
    map.addListener('idle', () => drawGrid(cfg.gridSize, points, panel));
  }

  // ---------------------------- Marcadores ----------------------------
  function addMarkers(points) {
    clearMarkers();
    const info = new google.maps.InfoWindow();

    points.forEach(p => {
      const m = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.type === 'propriedade' ? 'Residência' : 'Terreno',
        icon: pinIcon(p.type === 'propriedade' ? '#2563eb' : '#f97316'), // azul/laranja
        zIndex: p.type === 'propriedade' ? 2 : 1,
      });
      m.addListener('click', () => {
        info.setContent(infoHtml(p));
        info.open(map, m);
      });
      markers.push(m);
    });
  }

  function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
  }

  function infoHtml(p) {
    const imgs = [p.originalImage, p.resultImage]
      .filter(Boolean)
      .map(u => `<img src="${u}" alt="" />`)
      .join('');
    const tipo = p.type === 'propriedade' ? 'Residência' : 'Terreno';
    const data = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';
    return `
      <div style="max-width:220px">
        <div style="font-weight:600;margin-bottom:6px">${tipo}</div>
        <div class="miniimgs">${imgs}</div>
        <div class="muted" style="margin-top:6px">Detectado: ${data}</div>
      </div>`;
  }

  // ------------------------------ Grid -------------------------------
  function drawGrid(stepDeg, points, panel) {
    clearOverlays();
    const b = map.getBounds();
    if (!b) return;

    const zoom = map.getZoom();
    const minZoom = (cfg && cfg.minGridZoom) ? cfg.minGridZoom : 13;

    // Se estiver muito afastado, esconde malha/contadores e mostra aviso
    if (zoom < minZoom) {
      clearOverlays();
      if (panel) {
        panel.innerHTML = `<div class="muted">Aproxime o mapa para ver os quadrantes e os contadores.</div>`;
      }
      return;
    }

    const sw = b.getSouthWest();
    const ne = b.getNorthEast();

    const startLat = Math.floor(sw.lat() / stepDeg) * stepDeg;
    const startLng = Math.floor(sw.lng() / stepDeg) * stepDeg;

    const AM = (google.maps.marker && google.maps.marker.AdvancedMarkerElement) ? google.maps.marker.AdvancedMarkerElement : null;

    for (let lat = startLat; lat < ne.lat(); lat += stepDeg) {
      for (let lng = startLng; lng < ne.lng(); lng += stepDeg) {
        const cellBounds = new google.maps.LatLngBounds(
          { lat: lat,          lng: lng },
          { lat: lat + stepDeg, lng: lng + stepDeg }
        );

        // itens dentro do quadrante
        const inside = points.filter(p =>
          cellBounds.contains(new google.maps.LatLng(p.lat, p.lng))
        );

        // contagens
        const countResid = inside.filter(p => p.type === 'propriedade').length;
        const countTerr  = inside.filter(p => p.type === 'terreno').length;

        // retângulo “clicável”
        const rect = new google.maps.Rectangle({
          bounds: cellBounds,
          map,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.5,
          strokeWeight: 1,
          fillColor: '#3b82f6',
          fillOpacity: 0.06,
          clickable: true,
        });
        overlays.push(rect);

        // 🔒 Não cria badge se o quadrante estiver vazio (0 residências e 0 terrenos)
        if (!(countResid === 0 && countTerr === 0)) {
          const AM = (google.maps.marker && google.maps.marker.AdvancedMarkerElement)
            ? google.maps.marker.AdvancedMarkerElement
            : null;

          const el = document.createElement('div');
          el.className = 'grid-badge';
          el.innerHTML = `<span class="b blue">${countResid}</span><span class="b orange">${countTerr}</span>`;
          const center = { lat: lat + stepDeg / 2, lng: lng + stepDeg / 2 };

          if (AM) {
            try {
              const badge = new AM({ position: center, map, content: el, zIndex: 5 });
              overlays.push(badge);
            } catch (e) {
              overlays.push(createBadgeFallback(center, countResid, countTerr));
            }
          } else {
            overlays.push(createBadgeFallback(center, countResid, countTerr));
          }
        }

        // clique no quadrante
        rect.addListener('click', () => {
          // destaca o selecionado
          overlays.forEach(o => {
            if (o instanceof google.maps.Rectangle) o.setOptions({ fillOpacity: 0.06 });
          });
          rect.setOptions({ fillOpacity: 0.15 });

          renderPanel(panel, inside, cellBounds);
        });
      }
    }
  }

  // marcador simples com "label" — usado quando AdvancedMarker não está disponível
function createBadgeFallback(position, resid, terr){
  const transparent1x1 = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; // ícone transparente
  const marker = new google.maps.Marker({
    position,
    map,
    icon: {
      url: transparent1x1,
      size: new google.maps.Size(1,1),
      anchor: new google.maps.Point(0,0),
    },
    label: { text: `R${resid} | T${terr}`, className: 'grid-badge-fallback' },
    zIndex: 5
  });
  return marker;
}


  function clearOverlays() {
    overlays.forEach(o => o.setMap && o.setMap(null));
    overlays = [];
  }

  // ----------------------------- Painel ------------------------------
  function renderPanel(panel, items, bounds) {
    const title = `Quadrante: ${bounds.getSouthWest().toUrlValue(3)} → ${bounds
      .getNorthEast()
      .toUrlValue(3)} — <strong>${items.length}</strong> item(s)`;

    if (!items.length) {
      panel.innerHTML = `<div class="muted">${title}<br>Nenhum item neste quadrante.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="panel-head">${title}</div>
      <div class="panel-list">
        ${items.map(rowHtml).join('')}
      </div>`;
  }

  function rowHtml(p) {
    const tipo = p.type === 'propriedade' ? 'Residência' : 'Terreno';
    const chipClass = p.type === 'propriedade' ? 'blue' : 'orange';
    const data = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';
    return `
      <div class="panel-item">
        <div class="chip ${chipClass}">${tipo}</div>
        <div class="panel-info">
          <div><strong>ID:</strong> ${p.id}</div>
          <div><strong>Data:</strong> ${data}</div>
        </div>
        <div class="panel-photos">
          ${p.originalImage ? `<img src="${p.originalImage}" alt="">` : ''}
          ${p.resultImage   ? `<img src="${p.resultImage}"   alt="">` : ''}
        </div>
      </div>`;
  }

  // -------------------------- Utilitários ---------------------------
  function ensureData(data, center) {
    if (Array.isArray(data) && data.length) {
      return data.map(normalizePoint);
    }
    // Simulação: 12 pontos ao redor do centro
    const out = [];
    for (let i = 0; i < 12; i++) {
      const isProp = i % 2 === 0;
      const lat = center.lat + (Math.random() - 0.5) * 0.06;
      const lng = center.lng + (Math.random() - 0.5) * 0.06;
      out.push({
        id: i + 1,
        lat, lng,
        type: isProp ? 'propriedade' : 'terreno',
        originalImage: `https://picsum.photos/seed/o${i}/120/80`,
        resultImage:   `https://picsum.photos/seed/r${i}/120/80`,
        created_at: Date.now() - Math.floor(Math.random() * 86400000 * 10),
      });
    }
    return out;
  }

  function normalizePoint(p) {
    return {
      ...p,
      lat: Number(p.lat ?? p.latitude),
      lng: Number(p.lng ?? p.longitude),
    };
  }

  // Ícone SVG do pin (cor personalizada)
  function pinIcon(color) {
    const svg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24">
        <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="3" fill="#fff"/>
      </svg>`);
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      anchor: new google.maps.Point(12, 24),
      scaledSize: new google.maps.Size(24, 24),
    };
  }

  // API pública
  return { init };
})();
