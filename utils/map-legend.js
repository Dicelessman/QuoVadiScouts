/**
 * Utility e configurazione per la legenda dinamica dei layer overlay della mappa.
 * Gli overlay sono DINAMICI (tile server live basati su OpenStreetMap e Waymarked Trails),
 * non file GeoJSON o layer statici memorizzati localmente.
 */

/**
 * Metadati tecnici sui layer overlay per verificare natura dinamica e fonti
 */
export const LAYER_METADATA = {
  railway: {
    id: 'railway',
    name: 'Rete Ferroviaria',
    isDynamic: true,
    provider: 'OpenRailwayMap',
    sourceDatabase: 'OpenStreetMap (OSM)',
    tileUrlPattern: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    updateFrequency: 'Continuo / live tile stream da database OSM',
    description: 'Linee ferroviarie passeggeri, merci, raccordi e stazioni'
  },
  hiking: {
    id: 'hiking',
    name: 'Sentieri Escursionistici',
    isDynamic: true,
    provider: 'Waymarked Trails',
    sourceDatabase: 'OpenStreetMap (OSM) / Reti CAI / Cammini',
    tileUrlPattern: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    updateFrequency: 'Rigenerazione periodica frequente da database OSM',
    description: 'Itinerari escursionistici internazionali, nazionali, regionali e reti CAI'
  },
  cycling: {
    id: 'cycling',
    name: 'Piste Ciclabili',
    isDynamic: true,
    provider: 'Waymarked Trails',
    sourceDatabase: 'OpenStreetMap (OSM) / EuroVelo / Ciclovie Nazionali',
    tileUrlPattern: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    updateFrequency: 'Rigenerazione periodica frequente da database OSM',
    description: 'Ciclovie EuroVelo, percorsi cicloturistici e piste ciclabili locali'
  },
  mtb: {
    id: 'mtb',
    name: 'Percorsi MTB',
    isDynamic: true,
    provider: 'Waymarked Trails',
    sourceDatabase: 'OpenStreetMap (OSM) / Itinerari Mountain Bike',
    tileUrlPattern: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
    updateFrequency: 'Rigenerazione periodica frequente da database OSM',
    description: 'Tracciati ufficiali per mountain bike e singletrack fuoristrada'
  }
};

/**
 * Definizioni per la legenda visiva di ciascun layer
 */
export const MAP_OVERLAY_LEGENDS = {
  railway: {
    id: 'railway',
    title: '🚂 Rete Ferroviaria',
    providerName: 'OpenRailwayMap',
    items: [
      {
        type: 'rail-main',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-main"></span></span>',
        label: 'Linee principali & AV',
        subtext: 'Alta velocità ed assi ferroviari primari'
      },
      {
        type: 'rail-secondary',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-secondary"></span></span>',
        label: 'Linee secondarie & regionali',
        subtext: 'Linee a traffico regionale e locale'
      },
      {
        type: 'rail-service',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-service"></span></span>',
        label: 'Scali merci & raccordi',
        subtext: 'Binari di servizio e industriali'
      },
      {
        type: 'rail-station',
        swatchHtml: '<span class="legend-swatch"><span class="legend-point-rail-station"></span></span>',
        label: 'Stazioni & fermate',
        subtext: 'Punti di fermata passeggeri'
      }
    ]
  },
  hiking: {
    id: 'hiking',
    title: '🥾 Sentieri Escursionistici',
    providerName: 'Waymarked Trails Hiking',
    items: [
      {
        type: 'hike-major',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-hike-major"></span></span>',
        label: 'Itinerari Nazionali & Cammini',
        subtext: 'Sentiero Italia, Francigena, Grandi Randonnée'
      },
      {
        type: 'hike-regional',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-hike-regional"></span></span>',
        label: 'Sentieri regionali & reti CAI',
        subtext: 'Tracciati escursionistici con numero'
      },
      {
        type: 'hike-cai',
        swatchHtml: '<span class="legend-swatch"><span class="legend-badge-cai">CAI</span></span>',
        label: 'Segnavia e codici sentiero',
        subtext: 'Sigle tappe e segnaletica ufficiale'
      }
    ]
  },
  cycling: {
    id: 'cycling',
    title: '🚴 Piste Ciclabili',
    providerName: 'Waymarked Trails Cycling',
    items: [
      {
        type: 'cycle-national',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-cycle-national"></span></span>',
        label: 'Ciclovie Nazionali & EuroVelo',
        subtext: 'Grandi itinerari cicloturistici continui'
      },
      {
        type: 'cycle-local',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-cycle-local"></span></span>',
        label: 'Piste ciclabili regionali & urbane',
        subtext: 'Vie verdi e collegamenti comunali'
      },
      {
        type: 'cycle-badge',
        swatchHtml: '<span class="legend-swatch"><span class="legend-badge-cycle">EV</span></span>',
        label: 'Segnavia cicloturistici',
        subtext: 'Sigle percorso e frecce direzionali'
      }
    ]
  },
  mtb: {
    id: 'mtb',
    title: '🚵 Percorsi MTB',
    providerName: 'Waymarked Trails MTB',
    items: [
      {
        type: 'mtb-main',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-mtb-main"></span></span>',
        label: 'Itinerari Mountain Bike ufficiali',
        subtext: 'Percorsi fuoristrada tabellati'
      },
      {
        type: 'mtb-track',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-mtb-track"></span></span>',
        label: 'Singletrack & varianti tecniche',
        subtext: 'Sentieri tecnici per mountain bike'
      },
      {
        type: 'mtb-badge',
        swatchHtml: '<span class="legend-swatch"><span class="legend-badge-mtb">MTB</span></span>',
        label: 'Segnaletica percorsi e grado',
        subtext: 'Livelli di difficoltà e indicazioni'
      }
    ]
  }
};

/**
 * Verifica se un overlay specifico è dinamico.
 * @param {string} layerId
 * @returns {boolean}
 */
export function isLayerOverlayDynamic(layerId) {
  return LAYER_METADATA[layerId]?.isDynamic === true;
}

/**
 * Restituisce i dati di legenda per i layer attualmente attivi.
 * @param {string[]} activeLayerIds - Array di ID dei layer attivi (es. ['railway', 'hiking'])
 * @returns {Array} Sezioni di legenda attive
 */
export function getActiveLegendData(activeLayerIds) {
  if (!Array.isArray(activeLayerIds) || activeLayerIds.length === 0) {
    return [];
  }
  return activeLayerIds
    .map(id => MAP_OVERLAY_LEGENDS[id])
    .filter(Boolean);
}

/**
 * Genera l'HTML dinamico per la legenda in base ai layer attivi.
 * @param {string[]} activeLayerIds
 * @returns {string} Markup HTML
 */
export function renderLegendHtml(activeLayerIds) {
  const activeSections = getActiveLegendData(activeLayerIds);
  if (activeSections.length === 0) {
    return '';
  }

  return activeSections.map(section => {
    const itemsHtml = section.items.map(item => `
      <div class="legend-item" title="${item.subtext || ''}">
        ${item.swatchHtml}
        <span class="legend-item-text">${item.label}</span>
      </div>
    `).join('');

    return `
      <div class="legend-group" data-layer-id="${section.id}">
        <div class="legend-group-title">
          <span>${section.title}</span>
        </div>
        <div class="legend-group-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');
}
