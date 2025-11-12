// === QuoVadiScout v1.2.1 - Cache Bust: 2024-12-19-11-25 ===
console.log('🔄 OfflineSync.js caricato con versione v1.2.1 - Cache bust applicato');

// OfflineSyncManager per gestione sincronizzazione offline
class OfflineSyncManager {
  constructor() {
    this.pendingChanges = [];
    this.conflictLog = [];
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Event listeners per stato connessione
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncWhenOnline();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📱 OfflineSync: Disconnesso - modalità offline attivata');
    });
  }
  
  // Aggiunge una modifica alla coda offline
  async queueChange(type, data) {
    try {
      const change = {
        id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type, // 'create', 'update', 'delete'
        data: data,
        timestamp: Date.now(),
        synced: false
      };
      
      // Salva in IndexedDB
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineChanges'], 'readwrite');
      const store = transaction.objectStore('offlineChanges');
      await store.add(change);
      
      this.pendingChanges.push(change);
      console.log('📝 OfflineSync: Modifica aggiunta alla coda:', change.type, change.id);
      
      // Se siamo online, prova a sincronizzare immediatamente
      if (this.isOnline && !this.syncInProgress) {
        setTimeout(() => this.syncWhenOnline(), 1000);
      }
      
      return change.id;
    } catch (error) {
      console.error('❌ OfflineSync: Errore aggiunta modifica:', error);
      throw error;
    }
  }
  
  // Sincronizza quando torna online
  async syncWhenOnline() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }
    
    this.syncInProgress = true;
    console.log('🔄 OfflineSync: Inizio sincronizzazione...');
    
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineChanges'], 'readonly');
      const store = transaction.objectStore('offlineChanges');
      const changes = await store.getAll();
      
      const unsyncedChanges = changes.filter(change => !change.synced);
      console.log(`📊 OfflineSync: ${unsyncedChanges.length} modifiche da sincronizzare`);
      
      if (unsyncedChanges.length === 0) {
        this.syncInProgress = false;
        return;
      }
      
      // Processa le modifiche in batch
      await this.processChanges(unsyncedChanges);
      
      this.syncInProgress = false;
      console.log('✅ OfflineSync: Sincronizzazione completata');
      
    } catch (error) {
      console.error('❌ OfflineSync: Errore sincronizzazione:', error);
      this.syncInProgress = false;
    }
  }
  
  // Processa le modifiche e gestisce i conflitti
  async processChanges(changes) {
    for (const change of changes) {
      try {
        await this.syncChange(change);
        await this.markAsSynced(change.id);
      } catch (error) {
        if (error.name === 'ConflictError') {
          console.log('⚠️ OfflineSync: Conflitto rilevato per:', change.id);
          await this.handleConflict(change, error);
        } else {
          console.error('❌ OfflineSync: Errore sincronizzazione singola modifica:', error);
          // Mantieni la modifica in coda per retry
        }
      }
    }
  }
  
  // Sincronizza una singola modifica
  async syncChange(change) {
    if (!window.db) {
      throw new Error('Database non disponibile');
    }
    
    const { type, data } = change;
    
    switch (type) {
      case 'create':
        return await this.syncCreate(data);
      case 'update':
        return await this.syncUpdate(data);
      case 'delete':
        return await this.syncDelete(data);
      default:
        throw new Error(`Tipo modifica non supportato: ${type}`);
    }
  }
  
  // Sincronizza creazione
  async syncCreate(data) {
    const docRef = await window.addDoc(window.collection(window.db, "strutture"), data);
    console.log('✅ OfflineSync: Struttura creata online:', docRef.id);
    return docRef.id;
  }
  
  // Sincronizza aggiornamento con controllo conflitti
  async syncUpdate(data) {
    const { id, ...updateData } = data;
    
    // Verifica se la struttura è stata modificata online
    const onlineDoc = await window.getDoc(window.doc(window.db, "strutture", id));
    
    if (!onlineDoc.exists()) {
      throw new Error('Struttura non trovata online');
    }
    
    const onlineData = onlineDoc.data();
    const onlineTimestamp = onlineData.lastModified || 0;
    const offlineTimestamp = data.lastModified || 0;
    
    // Se la versione online è più recente, c'è un conflitto
    if (onlineTimestamp > offlineTimestamp) {
      const conflict = {
        type: 'update_conflict',
        structureId: id,
        onlineData: onlineData,
        offlineData: data,
        timestamp: Date.now()
      };
      throw { name: 'ConflictError', conflict };
    }
    
    // Aggiorna online
    await window.updateDoc(window.doc(window.db, "strutture", id), {
      ...updateData,
      lastModified: Date.now(),
      syncedFromOffline: true
    });
    
    console.log('✅ OfflineSync: Struttura aggiornata online:', id);
  }
  
  // Sincronizza eliminazione
  async syncDelete(data) {
    const { id } = data;
    await window.deleteDoc(window.doc(window.db, "strutture", id));
    console.log('✅ OfflineSync: Struttura eliminata online:', id);
  }
  
  // Gestisce i conflitti
  async handleConflict(change, error) {
    const conflict = error.conflict;
    this.conflictLog.push(conflict);
    
    // Notifica l'utente del conflitto
    if (window.showConflictDialog) {
      window.showConflictDialog(conflict);
    } else {
      console.log('⚠️ OfflineSync: Conflitto da risolvere manualmente:', conflict);
    }
  }
  
  // Risolve un conflitto manualmente
  async resolveConflict(conflictId, resolution) {
    try {
      const conflict = this.conflictLog.find(c => c.timestamp === conflictId);
      if (!conflict) {
        throw new Error('Conflitto non trovato');
      }
      
      const { structureId, onlineData, offlineData } = conflict;
      
      switch (resolution) {
        case 'keep_online':
          // Mantieni la versione online, scarta offline
          console.log('✅ OfflineSync: Mantenuta versione online');
          break;
          
        case 'keep_offline':
          // Forza la versione offline online
          await window.updateDoc(window.doc(window.db, "strutture", structureId), {
            ...offlineData,
            lastModified: Date.now(),
            conflictResolved: true
          });
          console.log('✅ OfflineSync: Mantenuta versione offline');
          break;
          
        case 'merge':
          // Merge intelligente (implementazione semplificata)
          const mergedData = this.mergeData(onlineData, offlineData);
          await window.updateDoc(window.doc(window.db, "strutture", structureId), {
            ...mergedData,
            lastModified: Date.now(),
            conflictResolved: true
          });
          console.log('✅ OfflineSync: Dati merge completato');
          break;
      }
      
      // Rimuovi conflitto dalla lista
      this.conflictLog = this.conflictLog.filter(c => c.timestamp !== conflictId);
      
    } catch (error) {
      console.error('❌ OfflineSync: Errore risoluzione conflitto:', error);
      throw error;
    }
  }
  
  // Merge intelligente dei dati (implementazione base)
  mergeData(onlineData, offlineData) {
    const merged = { ...onlineData };
    
    // Merge campi non conflittuali
    Object.keys(offlineData).forEach(key => {
      if (key === 'lastModified' || key === 'id') return;
      
      // Se il campo online è vuoto e offline ha valore, usa offline
      if (!onlineData[key] && offlineData[key]) {
        merged[key] = offlineData[key];
      }
      // Se entrambi hanno valori diversi, mantieni online (utente può decidere)
      else if (onlineData[key] && offlineData[key] && onlineData[key] !== offlineData[key]) {
        console.log(`⚠️ OfflineSync: Campo conflittuale ${key}: online="${onlineData[key]}" vs offline="${offlineData[key]}"`);
      }
    });
    
    return merged;
  }
  
  // Marca una modifica come sincronizzata
  async markAsSynced(changeId) {
    const db = await this.openIndexedDB();
    const transaction = db.transaction(['offlineChanges'], 'readwrite');
    const store = transaction.objectStore('offlineChanges');
    
    const change = await store.get(changeId);
    if (change) {
      change.synced = true;
      await store.put(change);
    }
  }
  
  // Recupera lo stato della sincronizzazione
  async getSyncStatus() {
    const db = await this.openIndexedDB();
    const transaction = db.transaction(['offlineChanges'], 'readonly');
    const store = transaction.objectStore('offlineChanges');
    const changes = await store.getAll();
    
    return {
      pendingChanges: changes.filter(c => !c.synced).length,
      totalChanges: changes.length,
      conflicts: this.conflictLog.length,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }
  
  // Pulisce le modifiche sincronizzate
  async clearSyncedChanges() {
    const db = await this.openIndexedDB();
    const transaction = db.transaction(['offlineChanges'], 'readwrite');
    const store = transaction.objectStore('offlineChanges');
    
    const changes = await store.getAll();
    const syncedChanges = changes.filter(c => c.synced);
    
    for (const change of syncedChanges) {
      await store.delete(change.id);
    }
    
    console.log(`🧹 OfflineSync: Rimosse ${syncedChanges.length} modifiche sincronizzate`);
  }
  
  // Apre IndexedDB
  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      // Apri sempre la versione corrente senza forzare il numero di versione
      const request = indexedDB.open('QuoVadiScoutDB');
      
      request.onerror = () => {
        if (window && window.handleIndexedDBError) {
          window.handleIndexedDBError(request.error, 'offline-sync.openIndexedDB');
        }
        reject(request.error);
      };
      request.onsuccess = () => {
        const db = request.result;
        
        // Verifica se le tabelle esistono, altrimenti le crea
        if (!db.objectStoreNames.contains('offlineChanges')) {
          console.log('🔧 OfflineSync: Creazione tabella offlineChanges...');
          const transaction = db.transaction([], 'versionchange');
          transaction.objectStore('offlineChanges', { keyPath: 'id', autoIncrement: true });
        }
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store per modifiche offline (se non esiste)
        if (!db.objectStoreNames.contains('offlineChanges')) {
          console.log('🔧 OfflineSync: Creazione tabella offlineChanges durante upgrade...');
          db.createObjectStore('offlineChanges', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }
}

// Crea istanza globale
window.offlineSyncManager = new OfflineSyncManager();

// Funzioni di utilità globali
window.queueOfflineChange = (type, data) => {
  return window.offlineSyncManager.queueChange(type, data);
};

window.getSyncStatus = () => {
  return window.offlineSyncManager.getSyncStatus();
};

window.resolveConflict = (conflictId, resolution) => {
  return window.offlineSyncManager.resolveConflict(conflictId, resolution);
};

// Alias per compatibilità test
window.resolveConflicts = window.resolveConflict;

console.log('🔄 OfflineSyncManager inizializzato');
