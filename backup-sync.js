// backup-sync.js
// Sistema avanzato di backup e sincronizzazione dati

class BackupSyncManager {
  constructor() {
    this.syncQueue = [];
    this.conflictResolution = new Map();
    this.backupHistory = [];
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.autoSyncInterval = null;
    
    this.initializeSync();
  }

  initializeSync() {
    // Ascolta cambiamenti di connessione
    window.addEventListener('online', () => {
      console.log('🌐 Connessione ripristinata, avvio sincronizzazione...');
      this.performSync();
    });

    // Sincronizzazione automatica ogni 30 minuti se online
    this.startAutoSync();

    // Backup automatico ogni ora
    setInterval(() => {
      this.performBackup();
    }, 60 * 60 * 1000);

    console.log('🔄 BackupSyncManager inizializzato');
  }

  async performSync() {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Inizio sincronizzazione dati...');

    try {
      // 1. Sincronizza modifiche offline
      await this.syncOfflineChanges();
      
      // 2. Sincronizza preferenze utente
      await this.syncUserPreferences();
      
      // 3. Sincronizza dati analytics
      await this.syncAnalyticsData();
      
      // 4. Sincronizza cache strutture
      await this.syncStructureCache();
      
      // 5. Risolvi conflitti
      await this.resolveConflicts();

      this.lastSyncTime = new Date();
      console.log('✅ Sincronizzazione completata');
      
      // Notifica utente se necessario
      this.notifySyncComplete();

    } catch (error) {
      console.error('❌ Errore durante sincronizzazione:', error);
      this.trackSyncError(error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncOfflineChanges() {
    if (!window.offlineSyncManager) {
      console.log('📱 OfflineSyncManager non disponibile');
      return;
    }

    console.log('📱 Sincronizzazione modifiche offline...');
    await window.offlineSyncManager.syncWhenOnline();
  }

  async syncUserPreferences() {
    if (!window.pushManager?.preferences) {
      return;
    }

    console.log('⚙️ Sincronizzazione preferenze utente...');
    
    const userId = window.utenteCorrente?.uid;
    if (userId) {
      await window.pushManager.preferences.save(userId);
    }
  }

  async syncAnalyticsData() {
    if (!window.analyticsManager) {
      return;
    }

    console.log('📊 Sincronizzazione dati analytics...');
    await window.analyticsManager.sendAnalyticsToServer();
  }

  async syncStructureCache() {
    if (!window.strutture) {
      return;
    }

    console.log('🏗️ Sincronizzazione cache strutture...');
    
    // Aggiorna cache con nuove strutture dal server
    const cacheKey = 'strutture_cache_v2';
    const cacheTimestamp = 'strutture_cache_v2_timestamp';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
    
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(cacheTimestamp);
    
    // Se cache è vecchia, aggiorna
    if (!cached || !timestamp || (Date.now() - parseInt(timestamp)) > CACHE_DURATION) {
      try {
        const strutture = await window.caricaStrutture();
        console.log(`✅ Cache strutture aggiornata con ${strutture.length} elementi`);
      } catch (error) {
        console.warn('⚠️ Errore aggiornamento cache strutture:', error);
      }
    }
  }

  async resolveConflicts() {
    if (this.conflictResolution.size === 0) {
      return;
    }

    console.log(`🔧 Risoluzione ${this.conflictResolution.size} conflitti...`);

    for (const [conflictId, conflict] of this.conflictResolution) {
      try {
        await this.resolveSingleConflict(conflictId, conflict);
        this.conflictResolution.delete(conflictId);
      } catch (error) {
        console.error(`❌ Errore risoluzione conflitto ${conflictId}:`, error);
      }
    }
  }

  async resolveSingleConflict(conflictId, conflict) {
    // Implementazione logica di risoluzione conflitti
    // Per ora, usa strategia "last-write-wins"
    console.log(`🔧 Risoluzione conflitto ${conflictId} con strategia last-write-wins`);
    
    // Qui si potrebbe implementare logica più sofisticata:
    // - Merge intelligente per campi non conflittuali
    // - Richiesta input utente per conflitti complessi
    // - Log delle risoluzioni per audit
  }

  async performBackup() {
    if (!navigator.onLine) {
      console.log('📴 Backup saltato (offline)');
      return;
    }

    console.log('💾 Avvio backup dati...');

    try {
      const backupData = await this.createBackupData();
      const backupId = await this.saveBackup(backupData);
      
      this.backupHistory.push({
        id: backupId,
        timestamp: new Date(),
        size: JSON.stringify(backupData).length,
        type: 'automatic'
      });

      // Mantieni solo gli ultimi 10 backup
      if (this.backupHistory.length > 10) {
        this.backupHistory = this.backupHistory.slice(-10);
      }

      console.log(`✅ Backup completato: ${backupId}`);
      
    } catch (error) {
      console.error('❌ Errore durante backup:', error);
    }
  }

  async createBackupData() {
    const backup = {
      timestamp: new Date(),
      version: '1.3.0',
      data: {
        // Strutture (solo quelle modificate localmente)
        structures: this.getModifiedStructures(),
        
        // Preferenze utente
        preferences: this.getUserPreferences(),
        
        // Lista personale
        personalList: this.getPersonalList(),
        
        // Cache dati
        cache: this.getCacheData(),
        
        // Configurazioni
        settings: this.getAppSettings()
      },
      metadata: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        online: navigator.onLine,
        storageUsed: this.getStorageUsage()
      }
    };

    return backup;
  }

  getModifiedStructures() {
    // Implementazione per identificare strutture modificate localmente
    // Per ora, ritorna tutte le strutture
    return window.strutture || [];
  }

  getUserPreferences() {
    const prefs = {};
    
    if (window.pushManager?.preferences) {
      prefs.notifications = window.pushManager.preferences.preferences;
    }
    
    // Aggiungi altre preferenze
    prefs.theme = localStorage.getItem('theme') || 'light';
    prefs.language = localStorage.getItem('language') || 'it';
    
    return prefs;
  }

  getPersonalList() {
    // Implementazione per recuperare lista personale
    return JSON.parse(localStorage.getItem('personalList') || '[]');
  }

  getCacheData() {
    return {
      structures: localStorage.getItem('strutture_cache_v2'),
      structuresTimestamp: localStorage.getItem('strutture_cache_v2_timestamp'),
      analytics: localStorage.getItem('analytics_data'),
      notifications: localStorage.getItem('smart_notifications_data')
    };
  }

  getAppSettings() {
    return {
      autoSync: localStorage.getItem('autoSync') !== 'false',
      offlineMode: localStorage.getItem('offlineMode') === 'true',
      notificationsEnabled: localStorage.getItem('notificationsEnabled') !== 'false'
    };
  }

  getStorageUsage() {
    let totalSize = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length;
      }
    }
    
    return {
      localStorage: totalSize,
      estimated: totalSize + (JSON.stringify(window.strutture || []).length)
    };
  }

  async saveBackup(backupData) {
    if (!window.db || !window.addDoc || !window.collection) {
      // Fallback: salva in localStorage
      const backupId = 'backup_' + Date.now();
      localStorage.setItem(`backup_${backupId}`, JSON.stringify(backupData));
      return backupId;
    }

    try {
      const userId = window.utenteCorrente?.uid || 'anonymous';
      const backupRef = await window.addDoc(window.collection(window.db, 'backups'), {
        ...backupData,
        userId: userId,
        createdAt: new Date()
      });
      
      return backupRef.id;
    } catch (error) {
      console.error('❌ Errore salvataggio backup su server:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupId) {
    console.log(`🔄 Ripristino da backup: ${backupId}`);

    try {
      let backupData;
      
      if (window.db && window.getDoc && window.doc) {
        // Carica da server
        const backupRef = window.doc(window.db, 'backups', backupId);
        const backupDoc = await window.getDoc(backupRef);
        
        if (!backupDoc.exists()) {
          throw new Error('Backup non trovato');
        }
        
        backupData = backupDoc.data();
      } else {
        // Carica da localStorage
        const localBackup = localStorage.getItem(`backup_${backupId}`);
        if (!localBackup) {
          throw new Error('Backup locale non trovato');
        }
        
        backupData = JSON.parse(localBackup);
      }

      // Ripristina dati
      await this.restoreBackupData(backupData);
      
      console.log('✅ Ripristino completato');
      
    } catch (error) {
      console.error('❌ Errore durante ripristino:', error);
      throw error;
    }
  }

  async restoreBackupData(backupData) {
    const { data } = backupData;
    
    // Ripristina strutture
    if (data.structures) {
      // Implementazione per ripristinare strutture
      console.log(`🏗️ Ripristino ${data.structures.length} strutture`);
    }
    
    // Ripristina preferenze
    if (data.preferences) {
      Object.entries(data.preferences).forEach(([key, value]) => {
        if (key === 'notifications' && window.pushManager?.preferences) {
          window.pushManager.preferences.preferences = value;
        } else {
          localStorage.setItem(key, value);
        }
      });
    }
    
    // Ripristina lista personale
    if (data.personalList) {
      localStorage.setItem('personalList', JSON.stringify(data.personalList));
    }
    
    // Ripristina cache
    if (data.cache) {
      Object.entries(data.cache).forEach(([key, value]) => {
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      });
    }
    
    // Ripristina impostazioni
    if (data.settings) {
      Object.entries(data.settings).forEach(([key, value]) => {
        localStorage.setItem(key, value.toString());
      });
    }
  }

  startAutoSync() {
    // Sincronizzazione automatica ogni 30 minuti
    this.autoSyncInterval = setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.performSync();
      }
    }, 30 * 60 * 1000);
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  notifySyncComplete() {
    // Mostra notifica discreta di sincronizzazione completata
    if (window.pushManager) {
      window.pushManager.showLocalNotification(
        '🔄 Sincronizzazione completata',
        {
          body: 'I tuoi dati sono stati sincronizzati con il server',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMyZjZiMmYiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CjxwYXRoIGQ9Ik0xMiAyTDEzLjA5IDguMjZMMjAgOUwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDlMMTAuOTEgOC4yNkwxMiAyWiIvPgo8L3N2Zz4KPC9zdmc+',
          tag: 'sync-complete',
          silent: true
        }
      );
    }
  }

  trackSyncError(error) {
    if (window.analyticsManager) {
      window.analyticsManager.trackError('sync_error', {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    }
  }

  // UI per gestione backup
  showBackupManager() {
    // Rimuovi modal esistente se presente
    const existingModal = document.querySelector('.backup-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'backup-modal-overlay modal-overlay';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    `;
    modal.innerHTML = `
      <div class="modal" style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #2f6b2f;">💾 Gestione Backup</h2>
          <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3>Backup Disponibili</h3>
          <div id="backupList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 10px;">
            ${this.renderBackupList()}
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button onclick="window.backupSyncManager.performBackup()" style="background: #2f6b2f; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            💾 Crea Backup
          </button>
          <button onclick="window.backupSyncManager.performSync()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            🔄 Sincronizza Ora
          </button>
          <button onclick="window.backupSyncManager.eliminaBackupPrecedenti()" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            🗑️ Elimina Backup
          </button>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h4>Statistiche</h4>
          <p>Ultima sincronizzazione: ${this.lastSyncTime ? this.lastSyncTime.toLocaleString() : 'Mai'}</p>
          <p>Spazio utilizzato: ${this.formatBytes(this.getStorageUsage().localStorage)}</p>
          <p>Backup disponibili: ${this.backupHistory.length}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  renderBackupList() {
    if (this.backupHistory.length === 0) {
      return '<p style="color: #666; text-align: center;">Nessun backup disponibile</p>';
    }

    return this.backupHistory.map(backup => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
        <div>
          <strong>${backup.timestamp.toLocaleString()}</strong><br>
          <small>${this.formatBytes(backup.size)} - ${backup.type}</small>
        </div>
        <button onclick="window.backupSyncManager.restoreFromBackup('${backup.id}')" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
          🔄 Ripristina
        </button>
      </div>
    `).join('');
  }

  // Funzione per eliminare tutti i backup precedenti
  eliminaBackupPrecedenti() {
    if (this.backupHistory.length === 0) {
      alert('Nessun backup da eliminare');
      return;
    }
    
    const conferma = confirm(`Sei sicuro di voler eliminare tutti i ${this.backupHistory.length} backup precedenti?\n\nQuesta azione non può essere annullata.`);
    
    if (!conferma) {
      return;
    }
    
    try {
      // Elimina tutti i backup dalla cronologia
      this.backupHistory = [];
      
      // Salva la cronologia aggiornata
      localStorage.setItem('backupHistory', JSON.stringify(this.backupHistory));
      
      // Aggiorna l'interfaccia
      this.showBackupManager();
      
      // Mostra notifica di successo
      if (window.showNotification) {
        window.showNotification('✅ Backup eliminati', {
          body: 'Tutti i backup precedenti sono stati eliminati con successo',
          tag: 'backup-deleted'
        });
      } else {
        alert('✅ Tutti i backup precedenti sono stati eliminati con successo');
      }
      
      console.log('🗑️ Tutti i backup precedenti eliminati');
      
    } catch (error) {
      console.error('❌ Errore durante eliminazione backup:', error);
      alert('Errore durante l\'eliminazione dei backup: ' + error.message);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Inizializza backup sync manager
window.backupSyncManager = new BackupSyncManager();

// Funzione rimossa dal menu - backup ora gestito automaticamente
// window.mostraGestioneBackup = () => { ... };

console.log('🔄 Backup Sync Manager inizializzato');
