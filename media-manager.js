// === QuoVadiScout v1.3.0 - Cache Bust: 2024-12-20-15-00 ===
console.log('🔄 MediaManager caricato con versione v1.3.0 - Cloudinary Integration');

// MediaManager per gestione upload immagini con Cloudinary
class MediaManager {
  constructor() {
    this.cloudinary = null;
    this.cloudinaryConfig = null;
    this.compressionQuality = 0.8;
    this.maxWidth = 1920;
    this.maxHeight = 1080;
    this.thumbnailSize = 300;
    
    // Inizializza Cloudinary
    this.initializeStorage();
  }
  
  async initializeStorage() {
    try {
      // Attendi che la configurazione Cloudinary sia disponibile
      const maxRetries = 20;
      let retries = 0;
      
      while (!window.CloudinaryConfig && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (window.CloudinaryConfig) {
        this.cloudinaryConfig = window.CloudinaryConfig;
        
        // Valida configurazione
        if (window.validateCloudinaryConfig && !window.validateCloudinaryConfig(this.cloudinaryConfig)) {
          console.error('❌ MediaManager: Configurazione Cloudinary non valida');
          return;
        }
        
        console.log('✅ MediaManager: Cloudinary inizializzato con cloud:', this.cloudinaryConfig.cloudName);
        this.cloudinary = true; // Flag che indica che Cloudinary è pronto
      } else {
        console.warn('⚠️ MediaManager: Configurazione Cloudinary non trovata dopo', maxRetries, 'tentativi');
        console.warn('📝 Assicurati di aver creato cloudinary-config.js da cloudinary-config.template.js');
      }
    } catch (error) {
      console.error('❌ MediaManager: Errore inizializzazione Cloudinary:', error);
    }
  }
  
  // Upload immagine con compressione e Cloudinary
  async uploadImage(file, structureId, metadata = {}) {
    try {
      console.log('📸 MediaManager: Inizio upload immagine:', file.name);
      
      // Verifica che Cloudinary sia configurato
      if (!this.cloudinary || !this.cloudinaryConfig) {
        console.warn('⚠️ Cloudinary non configurato, uso fallback offline');
        return await this.uploadImageOffline(file, structureId, metadata);
      }
      
      // Comprimi immagine
      const compressed = await this.compressImage(file);
      
      // Estrai dati EXIF per geotag
      const geoData = await this.extractGeoData(file);
      
      // Genera nomi file unici
      const timestamp = Date.now();
      const publicId = `${this.cloudinaryConfig.folder}/${structureId}/${timestamp}`;
      
      // Crea FormData per upload Cloudinary
      const formData = new FormData();
      formData.append('file', compressed.imageBlob);
      formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
      formData.append('public_id', publicId);
      formData.append('folder', this.cloudinaryConfig.folder);
      
      // Aggiungi metadata come context
      const contextData = {
        structureId: structureId,
        originalName: file.name,
        uploadedBy: metadata.uploadedBy || 'unknown',
        uploadedAt: new Date().toISOString(),
        ...geoData
      };
      formData.append('context', Object.entries(contextData).map(([k, v]) => `${k}=${v}`).join('|'));
      
      // Upload a Cloudinary
      const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`;
      
      console.log('📤 Uploading a Cloudinary...');
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`);
      }
      
      const cloudinaryResponse = await response.json();
      
      // Genera URL per thumbnail e trasformazioni
      const baseUrl = cloudinaryResponse.secure_url.split('/upload/')[0];
      const publicIdPath = cloudinaryResponse.public_id;
      
      // URL immagine principale con trasformazioni
      const imageUrl = `${baseUrl}/upload/w_1920,h_1080,c_limit,q_auto:good,f_auto,dpr_auto/${publicIdPath}.${cloudinaryResponse.format}`;
      
      // URL thumbnail
      const thumbnailUrl = `${baseUrl}/upload/w_300,h_300,c_fill,g_auto,q_auto:eco,f_auto,dpr_auto/${publicIdPath}.${cloudinaryResponse.format}`;
      
      const result = {
        id: `img_${timestamp}`,
        cloudinaryId: cloudinaryResponse.public_id,
        url: imageUrl,
        thumbnailUrl: thumbnailUrl,
        originalUrl: cloudinaryResponse.secure_url,
        fileName: cloudinaryResponse.original_filename,
        originalName: file.name,
        size: cloudinaryResponse.bytes,
        format: cloudinaryResponse.format,
        width: cloudinaryResponse.width,
        height: cloudinaryResponse.height,
        geoData: geoData,
        uploadedAt: new Date(),
        structureId: structureId
      };
      
      // Salva riferimento in IndexedDB per la galleria
      try {
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await store.put(result);
      } catch (dbError) {
        console.warn('⚠️ Errore salvataggio riferimento in IndexedDB:', dbError);
      }
      
      console.log('✅ MediaManager: Upload Cloudinary completato:', result.id);
      return result;
      
    } catch (error) {
      console.error('❌ MediaManager: Errore upload Cloudinary:', error);
      console.warn('⚠️ Tentativo fallback offline...');
      // Fallback: salva in IndexedDB
      return await this.uploadImageOffline(file, structureId, metadata);
    }
  }
  
  // Upload offline fallback (IndexedDB)
  async uploadImageOffline(file, structureId, metadata = {}) {
    try {
      const compressed = await this.compressImage(file);
      const geoData = await this.extractGeoData(file);
      return await this.saveImageOffline(file, structureId, compressed, geoData, metadata);
    } catch (error) {
      console.error('❌ Errore upload offline:', error);
      throw error;
    }
  }
  
  // Salva immagine offline in IndexedDB
  async saveImageOffline(file, structureId, compressed, geoData, metadata) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const imageData = {
        id: `img_${timestamp}`,
        fileName: fileName,
        originalName: file.name,
        structureId: structureId,
        imageBlob: compressed.imageBlob,
        thumbnailBlob: compressed.thumbnailBlob,
        geoData: geoData,
        uploadedAt: new Date(),
        offline: true,
        ...metadata
      };
      
      await store.put(imageData);
      
      // Crea URL blob per accesso immediato
      const imageUrl = URL.createObjectURL(compressed.imageBlob);
      const thumbnailUrl = URL.createObjectURL(compressed.thumbnailBlob);
      
      return {
        ...imageData,
        url: imageUrl,
        thumbnailUrl: thumbnailUrl,
        size: compressed.imageBlob.size,
        thumbnailSize: compressed.thumbnailBlob.size
      };
      
    } catch (error) {
      console.error('❌ MediaManager: Errore salvataggio offline:', error);
      throw error;
    }
  }
  
  // Comprimi immagine usando Canvas API
  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        try {
          // Calcola dimensioni mantenendo aspect ratio
          const { width, height } = this.calculateDimensions(
            img.width, 
            img.height, 
            this.maxWidth, 
            this.maxHeight
          );
          
          const { width: thumbWidth, height: thumbHeight } = this.calculateDimensions(
            img.width, 
            img.height, 
            this.thumbnailSize, 
            this.thumbnailSize
          );
          
          // Canvas per immagine principale
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Genera blob immagine principale
          canvas.toBlob((imageBlob) => {
            if (!imageBlob) {
              reject(new Error('Errore compressione immagine principale'));
              return;
            }
            
            // Canvas per thumbnail
            canvas.width = thumbWidth;
            canvas.height = thumbHeight;
            ctx.clearRect(0, 0, thumbWidth, thumbHeight);
            ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
            
            // Genera blob thumbnail
            canvas.toBlob((thumbnailBlob) => {
              if (!thumbnailBlob) {
                reject(new Error('Errore compressione thumbnail'));
                return;
              }
              
              resolve({
                imageBlob: imageBlob,
                thumbnailBlob: thumbnailBlob,
                originalSize: file.size,
                compressedSize: imageBlob.size,
                compressionRatio: (1 - imageBlob.size / file.size) * 100
              });
              
            }, 'image/jpeg', this.compressionQuality);
            
          }, 'image/jpeg', this.compressionQuality);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Errore caricamento immagine'));
      img.src = URL.createObjectURL(file);
    });
  }
  
  // Calcola dimensioni mantenendo aspect ratio
  calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth;
    let height = originalHeight;
    
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }
  
  // Estrae dati GPS da EXIF
  async extractGeoData(file) {
    return new Promise((resolve) => {
      // Implementazione semplificata - in produzione usare EXIF.js
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          // Parsing EXIF semplificato per GPS
          const arrayBuffer = e.target.result;
          const dataView = new DataView(arrayBuffer);
          
          // Cerca marker EXIF (0xFFE1)
          let offset = 0;
          while (offset < arrayBuffer.byteLength - 1) {
            if (dataView.getUint16(offset) === 0xFFE1) {
              // Trovato segmento EXIF, estrai GPS se presente
              const geoData = this.parseGPSData(dataView, offset);
              resolve(geoData);
              return;
            }
            offset += 2;
          }
          
          // Nessun dato GPS trovato
          resolve({ lat: null, lng: null, altitude: null });
          
        } catch (error) {
          console.warn('⚠️ MediaManager: Errore parsing EXIF:', error);
          resolve({ lat: null, lng: null, altitude: null });
        }
      };
      
      reader.onerror = () => resolve({ lat: null, lng: null, altitude: null });
      reader.readAsArrayBuffer(file.slice(0, 65536)); // Leggi solo i primi 64KB
    });
  }
  
  // Parsing GPS semplificato da EXIF
  parseGPSData(dataView, offset) {
    try {
      // Implementazione molto semplificata
      // In produzione, usare una libreria dedicata come EXIF.js
      return {
        lat: null,
        lng: null,
        altitude: null,
        timestamp: null
      };
    } catch (error) {
      return { lat: null, lng: null, altitude: null };
    }
  }
  
  // Elimina immagine da Cloudinary
  async deleteImage(imageId, structureId) {
    try {
      if (this.cloudinary && this.cloudinaryConfig) {
        // Per eliminare da Cloudinary serve l'API Secret
        // Quindi non possiamo farlo direttamente dal client
        // Opzioni:
        // 1. Marcare come eliminata in Firestore
        // 2. Creare una Cloud Function
        // 3. Lasciare le immagini su Cloudinary (non costano molto)
        
        console.warn('⚠️ Eliminazione da Cloudinary non implementata lato client');
        console.log('💡 L\'immagine resterà su Cloudinary ma sarà rimossa dalla galleria locale');
        
        // Elimina riferimento da IndexedDB locale
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await store.delete(imageId);
        
        console.log('✅ MediaManager: Riferimento immagine eliminato localmente');
      } else {
        // Elimina da IndexedDB
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await store.delete(imageId);
        
        console.log('✅ MediaManager: Immagine eliminata da IndexedDB');
      }
    } catch (error) {
      console.error('❌ MediaManager: Errore eliminazione immagine:', error);
      throw error;
    }
  }
  
  // Recupera galleria immagini per una struttura
  async getGallery(structureId) {
    try {
      // Garantisce che lo store esista prima dell'accesso
      await this.ensureImageStore();
      // Cloudinary non ha modo di listare immagini lato client
      // Quindi usiamo IndexedDB locale per salvare i riferimenti
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const index = store.index('structureId');
      
      const images = await new Promise((resolve, reject) => {
        const request = index.getAll(structureId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Se le immagini hanno blob locali, crea URL
      return images.map(img => ({
        ...img,
        url: img.url || (img.imageBlob ? URL.createObjectURL(img.imageBlob) : null),
        thumbnailUrl: img.thumbnailUrl || (img.thumbnailBlob ? URL.createObjectURL(img.thumbnailBlob) : null)
      })).filter(img => img.url); // Filtra immagini senza URL
      
    } catch (error) {
      console.error('❌ MediaManager: Errore recupero galleria:', error);
      
      // Utilizza il gestore errori centralizzato
      if (window.errorHandler) {
        const handled = await window.errorHandler.handleIndexedDBError(error, 'getGallery');
        if (handled) {
          console.log('✅ Errore gestito dal ErrorHandler');
        }
      }
      
      return [];
    }
  }
  
  // Recupera immagine cached per uso offline
  async getCachedImage(imageId) {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const result = await store.get(imageId);
      
      if (result) {
        return {
          ...result,
          url: URL.createObjectURL(result.imageBlob),
          thumbnailUrl: URL.createObjectURL(result.thumbnailBlob)
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ MediaManager: Errore recupero immagine cached:', error);
      return null;
    }
  }
  
  // Calcola spazio utilizzato dalle immagini
  async getStorageUsage() {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const images = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const totalSize = images.reduce((total, img) => {
        return total + (img.imageBlob?.size || 0) + (img.thumbnailBlob?.size || 0);
      }, 0);
      
      return {
        totalImages: images.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
      
    } catch (error) {
      console.error('❌ MediaManager: Errore calcolo spazio:', error);
      return { totalImages: 0, totalSize: 0, totalSizeMB: '0.00' };
    }
  }
  
  // Pulisce immagini vecchie o non utilizzate
  async cleanupOldImages(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 giorni
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const images = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const cutoffDate = Date.now() - maxAge;
      let deletedCount = 0;
      
      for (const img of images) {
        if (img.uploadedAt && new Date(img.uploadedAt).getTime() < cutoffDate) {
          await store.delete(img.id);
          deletedCount++;
        }
      }
      
      console.log(`🧹 MediaManager: Eliminate ${deletedCount} immagini vecchie`);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ MediaManager: Errore pulizia immagini:', error);
      throw error;
    }
  }
  
  // Apre IndexedDB
  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      // Apri sempre la versione corrente senza forzare il numero di versione
      const request = indexedDB.open('QuoVadiScoutDB');
      
      request.onerror = () => {
        if (window && window.handleIndexedDBError) {
          window.handleIndexedDBError(request.error, 'media-manager.openIndexedDB');
        }
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn('⚠️ MediaManager: upgrade IndexedDB bloccato da un\'altra scheda');
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store per immagini
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'id' });
          imageStore.createIndex('structureId', 'structureId', { unique: false });
          imageStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };
    });
  }

  // Verifica/esegue upgrade schema per store immagini
  async ensureImageStore() {
    // Primo open senza versione per leggere la versione corrente
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuoVadiScoutDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    if (db.objectStoreNames && db.objectStoreNames.contains('images')) {
      db.close();
      return;
    }
    const nextVersion = (db.version || 1) + 1;
    db.close();
    // Esegue upgrade creando lo store mancante
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('QuoVadiScoutDB', nextVersion);
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.warn('⚠️ MediaManager: upgrade schema bloccato');
      req.onupgradeneeded = (event) => {
        const upgradedDb = event.target.result;
        if (!upgradedDb.objectStoreNames.contains('images')) {
          const imageStore = upgradedDb.createObjectStore('images', { keyPath: 'id' });
          imageStore.createIndex('structureId', 'structureId', { unique: false });
          imageStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
    });
  }
}

// Crea istanza globale
window.mediaManager = new MediaManager();

// Funzioni di utilità globali
window.uploadImage = (file, structureId, metadata) => {
  return window.mediaManager.uploadImage(file, structureId, metadata);
};

window.deleteImage = (imageId, structureId) => {
  return window.mediaManager.deleteImage(imageId, structureId);
};

window.getImageGallery = (structureId) => {
  return window.mediaManager.getGallery(structureId);
};

window.getCachedImage = (imageId) => {
  return window.mediaManager.getCachedImage(imageId);
};

console.log('🔄 MediaManager inizializzato');
