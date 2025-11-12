/**
 * Configurazione icone personalizzate per QuoVadiScout
 * Utilizza Font Awesome per un set coerente e professionale
 */

// Configurazione icone personalizzate
const CUSTOM_ICONS = {
  // Menu principale - Ricerca & Filtri
  search: 'fas fa-search',
  map: 'fas fa-map-marked-alt',
  sort: 'fas fa-sort-amount-down',
  saved: 'fas fa-bookmark',
  
  // Menu principale - Le Mie Liste
  list: 'fas fa-list',
  
  // Menu principale - Azioni Rapide
  add: 'fas fa-plus',
  reset: 'fas fa-undo',
  view: 'fas fa-eye',
  
  // Menu principale - Gestione Dati
  sync: 'fas fa-sync-alt',
  export: 'fas fa-download',
  activity: 'fas fa-history',
  dashboard: 'fas fa-chart-line',
  backup: 'fas fa-database',
  
  // Menu principale - Impostazioni
  theme: 'fas fa-moon',
  user: 'fas fa-user',
  notifications: 'fas fa-bell',
  stats: 'fas fa-chart-bar',
  test: 'fas fa-flask',
  
  // Stati strutture
  active: 'fas fa-check-circle',
  inactive: 'fas fa-pause-circle',
  closed: 'fas fa-times-circle',
  
  // Tipi strutture
  house: 'fas fa-home',
  land: 'fas fa-seedling',
  both: 'fas fa-building',
  default_structure: 'fas fa-campground',
  
  // Azioni
  edit: 'fas fa-edit',
  delete: 'fas fa-trash',
  save: 'fas fa-save',
  cancel: 'fas fa-times',
  close: 'fas fa-times',
  
  // Attività
  structure_created: 'fas fa-plus-circle',
  structure_updated: 'fas fa-edit',
  structure_deleted: 'fas fa-trash',
  note_created: 'fas fa-sticky-note',
  note_deleted: 'fas fa-trash',
  filter_saved: 'fas fa-bookmark',
  
  // Navigazione
  menu: 'fas fa-bars',
  hamburger: 'fas fa-bars',
  
  // Altri
  empty: 'fas fa-search',
  loading: 'fas fa-spinner fa-spin',
  error: 'fas fa-exclamation-triangle',
  success: 'fas fa-check',
  info: 'fas fa-info-circle'
};

/**
 * Ottiene l'icona personalizzata per una chiave specifica
 * @param {string} key - Chiave dell'icona
 * @param {string} fallback - Icona di fallback se non trovata
 * @returns {string} Classe CSS dell'icona
 */
function getIcon(key, fallback = 'fas fa-question') {
  return CUSTOM_ICONS[key] || fallback;
}

/**
 * Crea un elemento HTML per l'icona
 * @param {string} key - Chiave dell'icona
 * @param {string} className - Classi CSS aggiuntive
 * @param {string} fallback - Icona di fallback
 * @returns {string} HTML dell'icona
 */
function createIconHTML(key, className = '', fallback = 'fas fa-question') {
  const iconClass = getIcon(key, fallback);
  return `<i class="${iconClass} ${className}"></i>`;
}

/**
 * Aggiorna un elemento esistente con una nuova icona
 * @param {string} selector - Selettore CSS dell'elemento
 * @param {string} iconKey - Chiave dell'icona
 * @param {string} className - Classi CSS aggiuntive
 */
function updateElementIcon(selector, iconKey, className = '') {
  const element = document.querySelector(selector);
  if (element) {
    const iconHTML = createIconHTML(iconKey, className);
    element.innerHTML = iconHTML;
  }
}

/**
 * Aggiorna tutte le icone del menu principale
 */
function updateMenuIcons() {
  // Ricerca & Filtri
  updateElementIcon('[onclick="mostraRicercaAvanzata()"] .menu-icon', 'search');
  updateElementIcon('#sortMenuBtn .menu-icon', 'sort');
  updateElementIcon('#savedFiltersBtn .menu-icon', 'saved');
  
  // Le Mie Liste
  updateElementIcon('#exportBtn .menu-icon', 'list');
  
  // Azioni Rapide
  updateElementIcon('#add-btn .menu-icon', 'add');
  updateElementIcon('#resetBtn .menu-icon', 'reset');
  updateElementIcon('.view-toggle .menu-icon', 'view');
  
  // Gestione Dati
  updateElementIcon('[onclick="mostraModaleSincronizzazione()"] .menu-icon', 'sync');
  updateElementIcon('[onclick="mostraFeedAttivita()"] .menu-icon', 'activity');
  updateElementIcon('[onclick="location.href=\'dashboard.html\'"] .menu-icon', 'dashboard');
  updateElementIcon('[onclick="mostraGestioneBackup()"] .menu-icon', 'backup');
  
  // Impostazioni
  updateElementIcon('#themeToggle .menu-icon', 'theme');
  updateElementIcon('#userBtn .menu-icon', 'user');
  updateElementIcon('[onclick="mostraPreferenzeNotifiche()"] .menu-icon', 'notifications');
  updateElementIcon('[onclick="mostraStatisticheApp()"] .menu-icon', 'stats');
  updateElementIcon('[onclick="runSystemTests()"] .menu-icon', 'test');
  
  // Menu hamburger
  updateElementIcon('#menuToggle .hamburger', 'menu', 'hamburger-icon');
}

/**
 * Ottiene l'icona per lo stato di una struttura
 * @param {string} stato - Stato della struttura
 * @returns {string} Classe CSS dell'icona
 */
function getStructureStateIcon(stato) {
  const stateIcons = {
    'attiva': 'active',
    'temporaneamente_non_attiva': 'inactive',
    'non_piu_attiva': 'closed'
  };
  return getIcon(stateIcons[stato] || 'active');
}

/**
 * Ottiene l'icona per il tipo di struttura
 * @param {Object} struttura - Oggetto struttura
 * @returns {string} Classe CSS dell'icona
 */
function getStructureTypeIcon(struttura) {
  if (struttura.Casa && struttura.Terreno) {
    return getIcon('both');
  } else if (struttura.Casa) {
    return getIcon('house');
  } else if (struttura.Terreno) {
    return getIcon('land');
  }
  return getIcon('default_structure');
}

/**
 * Aggiorna le icone degli stati nelle opzioni di filtro
 */
function updateFilterStateIcons() {
  const stateOptions = document.querySelectorAll('#stato option');
  stateOptions.forEach(option => {
    const value = option.value;
    if (value === 'attiva') {
      option.innerHTML = '<i class="fas fa-check-circle"></i> Attiva';
    } else if (value === 'temporaneamente_non_attiva') {
      option.innerHTML = '<i class="fas fa-pause-circle"></i> Temporaneamente non attiva';
    } else if (value === 'non_piu_attiva') {
      option.innerHTML = '<i class="fas fa-times-circle"></i> Non più attiva';
    }
  });
}

/**
 * Aggiorna le icone dei pulsanti di azione
 */
function updateActionButtonIcons() {
  // Pulsanti di azione nelle card
  const actionButtons = document.querySelectorAll('.card-actions button');
  actionButtons.forEach(button => {
    const text = button.textContent.trim();
    if (text.includes('Modifica')) {
      button.innerHTML = '<i class="fas fa-edit"></i> Modifica';
    } else if (text.includes('Elimina')) {
      button.innerHTML = '<i class="fas fa-trash"></i> Elimina';
    } else if (text.includes('Aggiungi')) {
      button.innerHTML = '<i class="fas fa-plus"></i> Aggiungi';
    }
  });
}

/**
 * Aggiorna le icone di caricamento
 */
function updateLoadingIcons() {
  const loadingElements = document.querySelectorAll('.loading-spinner');
  loadingElements.forEach(element => {
    element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  });
}

/**
 * Inizializza tutte le icone dell'app
 */
function initializeAllIcons() {
  updateMenuIcons();
  updateFilterStateIcons();
  updateActionButtonIcons();
  updateLoadingIcons();
  
  console.log('✅ Icone personalizzate inizializzate');
}

// Esporta le funzioni per uso globale
window.CUSTOM_ICONS = CUSTOM_ICONS;
window.getIcon = getIcon;
window.createIconHTML = createIconHTML;
window.updateElementIcon = updateElementIcon;
window.updateMenuIcons = updateMenuIcons;
window.getStructureStateIcon = getStructureStateIcon;
window.getStructureTypeIcon = getStructureTypeIcon;
window.updateFilterStateIcons = updateFilterStateIcons;
window.updateActionButtonIcons = updateActionButtonIcons;
window.updateLoadingIcons = updateLoadingIcons;
window.initializeAllIcons = initializeAllIcons;
