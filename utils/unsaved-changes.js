/**
 * QuoVadiScout - Gestione Modifiche Non Salvate & Popup di Conferma
 * Rileva modifiche in corso e protegge l'utente dall'abbandono accidentale
 * tramite pulsante Indietro nell'app o tasto/gesture Indietro dello smartphone.
 */

/**
 * Campi rilevanti per il confronto delle modifiche di una struttura
 */
export const STRUCTURE_COMPARE_FIELDS = [
  'Struttura', 'Luogo', 'Indirizzo', 'Prov', 'Info', 'Note',
  'Referente', 'Email', 'Sito', 'Contatto', 'IIcontatto',
  'Casa', 'Terreno', 'stato', 'google_maps_link',
  'coordinate_lat', 'coordinate_lng',
  'A persona', 'A giornata', 'A notte', 'Offerta', 'Forfait',
  'Riscaldamento', 'Cucina', 'Altri costi', 'Altre info',
  'Letti', 'Spazi', 'Fuochi', 'Hike', 'Trasporti',
  'Branco', 'Reparto', 'Compagnia', 'Gruppo', 'Sezione'
];

/**
 * Crea una copia snapshot profonda della struttura per il ripristino
 * @param {Object} struttura
 * @returns {Object}
 */
export function cloneStructureSnapshot(struttura) {
  if (!struttura || typeof struttura !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(struttura));
  } catch (e) {
    return { ...struttura };
  }
}

/**
 * Verifica se un valore rappresenta un booleano (anche stringhe come 'true', 'sì')
 * @param {*} val
 * @returns {boolean}
 */
function normalizeBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === 'sì' || s === 'si' || s === '1';
  }
  return Boolean(val);
}

/**
 * Determina se ci sono modifiche non salvate confrontando la struttura corrente
 * con lo snapshot iniziale.
 * 
 * @param {Object} originalSnapshot - Copia iniziale della struttura
 * @param {Object} currentStructure - Struttura attualmente in memoria/form
 * @param {boolean} isNewStructure - True se è una struttura nuova non ancora creata su Firestore
 * @param {boolean} isFormDirty - Flag opzionale impostato dagli eventi di input
 * @returns {boolean} True se ci sono modifiche non salvate
 */
export function hasStructureChanges(originalSnapshot, currentStructure, isNewStructure = false, isFormDirty = false) {
  if (!currentStructure) return false;

  // Se è una nuova struttura, controlla se l'utente ha inserito informazioni
  if (isNewStructure) {
    const textFields = ['Struttura', 'Luogo', 'Indirizzo', 'Prov', 'Info', 'Note', 'Referente', 'Contatto', 'Email'];
    const hasAnyText = textFields.some(field => {
      const val = currentStructure[field];
      return typeof val === 'string' && val.trim().length > 0;
    });

    if (hasAnyText || isFormDirty) {
      return true;
    }
    return false;
  }

  // Se non c'è uno snapshot iniziale valido per una struttura esistente, affidati al dirty flag
  if (!originalSnapshot || typeof originalSnapshot !== 'object') {
    return Boolean(isFormDirty);
  }

  // Confronta tutti i campi rilevanti
  const booleanFields = new Set([
    'Casa', 'Terreno', 'Branco', 'Reparto', 'Compagnia', 'Gruppo', 'Sezione'
  ]);

  for (const field of STRUCTURE_COMPARE_FIELDS) {
    const origVal = originalSnapshot[field];
    const currVal = currentStructure[field];

    if (booleanFields.has(field)) {
      if (normalizeBoolean(origVal) !== normalizeBoolean(currVal)) {
        return true;
      }
      continue;
    }

    if (field === 'coordinate_lat' || field === 'coordinate_lng') {
      const origNum = origVal != null && origVal !== '' ? parseFloat(origVal) : null;
      const currNum = currVal != null && currVal !== '' ? parseFloat(currVal) : null;
      if (origNum === null && currNum === null) continue;
      if (origNum === null || currNum === null) return true;
      if (Math.abs(origNum - currNum) > 0.000001) return true;
      continue;
    }

    // Normalizzazione stringa/valore
    const strOrig = (origVal ?? '').toString().trim();
    const strCurr = (currVal ?? '').toString().trim();

    if (strOrig !== strCurr) {
      return true;
    }
  }

  return Boolean(isFormDirty);
}

/**
 * Ripristina la struttura target allo stato dello snapshot iniziale
 * @param {Object} targetStructure
 * @param {Object} originalSnapshot
 */
export function restoreStructureSnapshot(targetStructure, originalSnapshot) {
  if (!targetStructure || !originalSnapshot) return;

  // Rimuovi eventuali chiavi aggiunte durante la modifica non presenti originariamente
  Object.keys(targetStructure).forEach(key => {
    if (!(key in originalSnapshot)) {
      delete targetStructure[key];
    }
  });

  // Ripristina tutte le proprietà originali
  Object.assign(targetStructure, JSON.parse(JSON.stringify(originalSnapshot)));
}

/**
 * Mostra il popup di conferma per modifiche non salvate in stile QuoVadiScout
 * 
 * @param {Object} options
 * @param {string} options.title - Titolo del popup (default: 'Modifiche non salvate')
 * @param {string} options.message - Testo di spiegazione
 * @param {string} options.saveText - Etichetta pulsante salva (default: '💾 Salva modifiche ed esci')
 * @param {string} options.discardText - Etichetta pulsante abbandona (default: '⚠️ Esci senza salvare')
 * @param {string} options.cancelText - Etichetta pulsante annulla (default: '↩️ Continua a modificare')
 * @param {Function} options.onSave - Callback invocata se l'utente sceglie di salvare
 * @param {Function} options.onDiscard - Callback invocata se l'utente abbandona le modifiche
 * @param {Function} options.onCancel - Callback invocata se l'utente annulla e rimane a modificare
 * @returns {HTMLElement} L'elemento overlay del popup
 */
export function mostraPopupConfermaSalvataggio({
  title = 'Modifiche non salvate',
  message = 'Ci sono modifiche non salvate a questa struttura. Vuoi salvarle prima di abbandonare la pagina?',
  saveText = '💾 Salva ed esci',
  discardText = '⚠️ Esci senza salvare',
  cancelText = '↩️ Continua a modificare',
  onSave,
  onDiscard,
  onCancel
} = {}) {
  // Se un popup è già aperto, rimuovilo prima di aprirne uno nuovo
  const existing = document.querySelector('.unsaved-confirm-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-confirm-overlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'unsavedDialogTitle');
  overlay.setAttribute('aria-describedby', 'unsavedDialogDesc');

  overlay.innerHTML = `
    <div class="unsaved-confirm-card">
      <div class="unsaved-confirm-icon-box" aria-hidden="true">
        <span>⚠️</span>
      </div>
      <h3 id="unsavedDialogTitle" class="unsaved-confirm-title">${title}</h3>
      <p id="unsavedDialogDesc" class="unsaved-confirm-desc">${message}</p>
      <div class="unsaved-confirm-actions">
        <button id="unsavedBtnSave" class="unsaved-confirm-btn unsaved-confirm-btn-save" type="button">
          ${saveText}
        </button>
        <button id="unsavedBtnDiscard" class="unsaved-confirm-btn unsaved-confirm-btn-discard" type="button">
          ${discardText}
        </button>
        <button id="unsavedBtnCancel" class="unsaved-confirm-btn unsaved-confirm-btn-cancel" type="button">
          ${cancelText}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let isHandled = false;

  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
    if (overlay.parentNode) {
      overlay.remove();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!isHandled) {
        isHandled = true;
        cleanup();
        if (typeof onCancel === 'function') onCancel();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  const btnSave = overlay.querySelector('#unsavedBtnSave');
  const btnDiscard = overlay.querySelector('#unsavedBtnDiscard');
  const btnCancel = overlay.querySelector('#unsavedBtnCancel');

  if (btnSave) {
    btnSave.focus();
    btnSave.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isHandled) return;
      isHandled = true;
      btnSave.disabled = true;
      const prevHtml = btnSave.innerHTML;
      btnSave.innerHTML = '🔄 Salvataggio...';
      try {
        if (typeof onSave === 'function') {
          await onSave();
        }
      } catch (err) {
        console.error('Errore durante il salvataggio:', err);
        btnSave.disabled = false;
        btnSave.innerHTML = prevHtml;
        isHandled = false;
        return;
      }
      cleanup();
    });
  }

  if (btnDiscard) {
    btnDiscard.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isHandled) return;
      isHandled = true;
      cleanup();
      if (typeof onDiscard === 'function') {
        onDiscard();
      }
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isHandled) return;
      isHandled = true;
      cleanup();
      if (typeof onCancel === 'function') {
        onCancel();
      }
    });
  }

  // Click sull'overlay (sfondo) per annullare
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (isHandled) return;
      isHandled = true;
      cleanup();
      if (typeof onCancel === 'function') {
        onCancel();
      }
    }
  });

  return overlay;
}
