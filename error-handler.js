/**
 * Gestore errori centralizzato per QuoVadiScout
 * Gestisce errori comuni e fornisce soluzioni automatiche
 */

class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.maxRetries = 3;
    // Inizializza Sentry se configurato
    try {
      if (window.SENTRY_CONFIG && window.SENTRY_CONFIG.dsn && window.Sentry && window.Sentry.init) {
        window.Sentry.init({
          dsn: window.SENTRY_CONFIG.dsn,
          tracesSampleRate: window.SENTRY_CONFIG.tracesSampleRate || 0,
          environment: window.SENTRY_CONFIG.environment || 'development'
        });
        console.log('🛰️ Sentry inizializzato');
      }
    } catch (e) {
      console.warn('⚠️ Sentry non inizializzato:', e?.message);
    }
  }

  /**
   * Gestisce errori di IndexedDB
   */
  async handleIndexedDBError(error, context = '') {
    console.error(`❌ IndexedDB Error in ${context}:`, error);
    
    if (error.name === 'VersionError') {
      console.log('🔄 Tentativo di risolvere VersionError...');
      try {
        // Prova a eliminare e ricreare il database
        await this.recreateDatabase();
        return true;
      } catch (recreateError) {
        console.error('❌ Errore ricreazione database:', recreateError);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Gestisce errori di mappa
   */
  handleMapError(error, context = '') {
    console.error(`❌ Map Error in ${context}:`, error);
    
    if (error.message.includes('clearLayers')) {
      console.log('🔄 Tentativo di reinizializzare mappa...');
      // La mappa verrà reinizializzata automaticamente al prossimo utilizzo
      return true;
    }
    
    return false;
  }

  /**
   * Gestisce errori di rete
   */
  handleNetworkError(error, context = '') {
    console.error(`❌ Network Error in ${context}:`, error);
    
    // Implementa retry logic se necessario
    const retryCount = this.errorCounts.get(context) || 0;
    if (retryCount < this.maxRetries) {
      this.errorCounts.set(context, retryCount + 1);
      console.log(`🔄 Retry ${retryCount + 1}/${this.maxRetries} per ${context}`);
      return true;
    }
    
    return false;
  }

  /**
   * Ricrea il database IndexedDB
   */
  async recreateDatabase() {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('QuoVadiScoutDB');
      deleteRequest.onsuccess = () => {
        console.log('✅ Database eliminato, verrà ricreato al prossimo accesso');
        resolve();
      };
      deleteRequest.onerror = () => {
        console.error('❌ Errore eliminazione database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }

  /**
   * Gestisce errori generici
   */
  handleGenericError(error, context = '') {
    console.error(`❌ Generic Error in ${context}:`, error);
    
    // Log per analytics se disponibile
    if (window.analyticsManager) {
      window.analyticsManager.trackError('generic_error', {
        message: error.message,
        context: context,
        stack: error.stack
      });
    }
    // Forward a Sentry se disponibile
    if (window.Sentry && window.Sentry.captureException) {
      try {
        window.Sentry.captureException(error, { tags: { context } });
      } catch (_) {}
    }
    
    return false;
  }

  /**
   * Gestisce errori di promise rejection
   */
  handlePromiseRejection(event) {
    console.error('❌ Unhandled Promise Rejection:', event.reason);
    
    // Prevenire il crash dell'app
    event.preventDefault();
    
    // Log per analytics
    if (window.analyticsManager) {
      window.analyticsManager.trackError('promise_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    }
    // Forward a Sentry
    if (window.Sentry && window.Sentry.captureException) {
      try {
        window.Sentry.captureException(event.reason);
      } catch (_) {}
    }
    
    return true;
  }

  /**
   * Reset contatori errori
   */
  resetErrorCounts() {
    this.errorCounts.clear();
    console.log('🔄 Contatori errori resettati');
  }
}

// Crea istanza globale
window.errorHandler = new ErrorHandler();

// Gestione errori globali
window.addEventListener('error', (event) => {
  window.errorHandler.handleGenericError(event.error, 'global');
});

window.addEventListener('unhandledrejection', (event) => {
  window.errorHandler.handlePromiseRejection(event);
});

// Funzioni di utilità globali
window.handleIndexedDBError = (error, context) => {
  return window.errorHandler.handleIndexedDBError(error, context);
};

window.handleMapError = (error, context) => {
  return window.errorHandler.handleMapError(error, context);
};

window.handleNetworkError = (error, context) => {
  return window.errorHandler.handleNetworkError(error, context);
};

console.log('🛡️ ErrorHandler inizializzato');
