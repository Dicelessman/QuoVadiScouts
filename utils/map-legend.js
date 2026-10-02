/**
 * Utility e configurazione per la legenda dinamica dei layer overlay della mappa.
 *
 * Gli overlay sono DINAMICI (tile server live basati su OpenStreetMap e Waymarked Trails).
 *
 * Colori OpenRailwayMap (standard.mss — CartoCSS ufficiale):
 *   Alta velocità:   #ff0c00 (rosso vivo)
 *   Linea principale:#ff8100 (arancione)
 *   Linea secondaria:#c4b600 (giallo)
 *   Tram:            #d877b8 (rosa/magenta)
 *   Metro:           #0300c3 (blu scuro)
 *   Light rail:      #00bd14 (verde)
 *   Industriale/Spur:#87491d (marrone)
 *   Dismessa:        #70584d (marrone grigio)
 *
 * Colori Waymarked Trails: variano dinamicamente per ogni percorso in base all'osmc:symbol
 * del database OSM — la legenda descrive il sistema di shield, non colori fissi per categoria.
 */

/**
 * Metadati tecnici sui layer overlay.
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
 * Definizioni per la legenda visiva di ciascun layer.
 * Colori ferroviari da standard.mss (CartoCSS ufficiale OpenRailwayMap):
 *   https://github.com/OpenRailwayMap/OpenRailwayMap-CartoCSS/blob/master/standard.mss
 */
export const MAP_OVERLAY_LEGENDS = {

  railway: {
    id: 'railway',
    title: '🚂 Rete Ferroviaria',
    providerName: 'OpenRailwayMap',
    items: [
      {
        type: 'rail-highspeed',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-highspeed"></span></span>',
        label: 'Alta velocità',
        subtext: 'Linee AV e TAV — usage=highspeed (#ff0c00)'
      },
      {
        type: 'rail-main',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-main"></span></span>',
        label: 'Linea principale',
        subtext: 'Linee a lungo percorso — usage=main (#ff8100)'
      },
      {
        type: 'rail-branch',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-branch"></span></span>',
        label: 'Linea secondaria / regionale',
        subtext: 'Linee locali e a binario singolo — usage=branch (#c4b600)'
      },
      {
        type: 'rail-tram',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-tram"></span></span>',
        label: 'Tram',
        subtext: 'Tramvie urbane — railway=tram (#d877b8)'
      },
      {
        type: 'rail-metro',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-metro"></span></span>',
        label: 'Metro / Subway',
        subtext: 'Metropolitane — railway=subway (#0300c3)'
      },
      {
        type: 'rail-lightrail',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-lightrail"></span></span>',
        label: 'Light Rail',
        subtext: 'Ferrovie urbane leggere — railway=light_rail (#00bd14)'
      },
      {
        type: 'rail-industrial',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-industrial"></span></span>',
        label: 'Raccordi industriali / Spur',
        subtext: 'Binari di servizio e raccordi merci (#87491d)'
      },
      {
        type: 'rail-disused',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-rail-disused"></span></span>',
        label: 'Dismessa / Abbandonata',
        subtext: 'Linee fuori servizio o abbandonate (#70584d)'
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
        type: 'hike-shield-info',
        swatchHtml: '<span class="legend-swatch-wide"><span class="legend-shield-strip" style="background:linear-gradient(90deg,#e63946 33%,#fff 33%,#fff 67%,#e63946 67%)"></span></span>',
        label: 'Shield segnavia (colori variabili)',
        subtext: 'Ogni percorso mostra lo shield dell\'osmc:symbol OSM — il colore rispecchia la segnaletica reale sul terreno'
      },
      {
        type: 'hike-major',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-hike-major"></span></span>',
        label: 'Itinerari lunghi & cammini',
        subtext: 'Sentiero Italia, Via Francigena, GR — percorsi con shield rosso/bianco'
      },
      {
        type: 'hike-regional',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-hike-regional"></span></span>',
        label: 'Percorsi regionali & CAI',
        subtext: 'Reti escursionistiche con numero CAI — shield con banda colorata'
      },
      {
        type: 'hike-local',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-hike-local"></span></span>',
        label: 'Sentieri locali & anelli',
        subtext: 'Percorsi di zona senza numerazione fissa'
      }
    ]
  },

  cycling: {
    id: 'cycling',
    title: '🚴 Piste Ciclabili',
    providerName: 'Waymarked Trails Cycling',
    items: [
      {
        type: 'cycle-shield-info',
        swatchHtml: '<span class="legend-swatch-wide"><span class="legend-shield-strip" style="background:linear-gradient(90deg,#1d4ed8 0%,#1d4ed8 40%,#60a5fa 40%,#60a5fa 60%,#1d4ed8 60%)"></span></span>',
        label: 'Shield itinerario (colori variabili)',
        subtext: 'Ogni percorso mostra il numero/sigla ufficiale — EuroVelo, ciclovie nazionali e locali'
      },
      {
        type: 'cycle-national',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-cycle-national"></span></span>',
        label: 'Ciclovie nazionali & EuroVelo',
        subtext: 'Grandi assi cicloturistici continui'
      },
      {
        type: 'cycle-regional',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-cycle-regional"></span></span>',
        label: 'Itinerari regionali',
        subtext: 'Percorsi ciclabili di media distanza'
      },
      {
        type: 'cycle-local',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-cycle-local"></span></span>',
        label: 'Piste locali & urbane',
        subtext: 'Greenway, vie verdi e piste comunali'
      }
    ]
  },

  mtb: {
    id: 'mtb',
    title: '🚵 Percorsi MTB',
    providerName: 'Waymarked Trails MTB',
    items: [
      {
        type: 'mtb-shield-info',
        swatchHtml: '<span class="legend-swatch-wide"><span class="legend-shield-strip" style="background:linear-gradient(90deg,#92400e 0%,#d97706 50%,#92400e 100%)"></span></span>',
        label: 'Shield MTB (colori variabili)',
        subtext: 'Percorsi con shield che rispecchia la classificazione locale del tracciato'
      },
      {
        type: 'mtb-major',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-mtb-major"></span></span>',
        label: 'Itinerari MTB ufficiali',
        subtext: 'Percorsi tabellati e numerati'
      },
      {
        type: 'mtb-track',
        swatchHtml: '<span class="legend-swatch"><span class="legend-line-mtb-track"></span></span>',
        label: 'Singletrack & varianti',
        subtext: 'Sterrati tecnici e fuoristrada'
      },
      {
        type: 'mtb-difficulty',
        swatchHtml: '<span class="legend-swatch"><span class="legend-badge-mtb-diff"></span></span>',
        label: 'Grado di difficoltà',
        subtext: 'Livello 0–6 secondo scala IMBA/MTB project'
      }
    ]
  }
};

/**
 * Verifica se un overlay specifico è dinamico.
 */
export function isLayerOverlayDynamic(layerId) {
  return LAYER_METADATA[layerId]?.isDynamic === true;
}

/**
 * Restituisce i dati di legenda per i layer attualmente attivi.
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
