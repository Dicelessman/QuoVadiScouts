// === QuoVadiScout v1.3.0 - Virtual Scrolling Optimized ===

// Sistema di logging (usa il sistema globale se disponibile)
const vScrollLog = typeof window !== 'undefined' && window.log ? window.log : {
  info: () => {},
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: () => {}
};

// VirtualScroller per ottimizzare il rendering di liste lunghe
class VirtualScroller {
  constructor(container, items, renderItem, options = {}) {
    this.container = container;
    this.items = items;
    this.renderItem = renderItem;
    this.visibleItems = new Set();
    this.placeholderHeight = options.placeholderHeight || 200;
    this.rootMargin = options.rootMargin || '200px';
    this.minItemsToVirtualize = options.minItemsToVirtualize || 20;
    
    // Intersection Observer per rilevare elementi visibili
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { 
        rootMargin: this.rootMargin,
        threshold: 0
      }
    );
    
    // Container per placeholder
    this.placeholderContainer = null;
    
    vScrollLog.debug('VirtualScroller inizializzato per', items.length, 'elementi');
  }
  
  // Inizializza la virtualizzazione
  init() {
    // Se ci sono pochi elementi, renderizza normalmente
    if (this.items.length < this.minItemsToVirtualize) {
      vScrollLog.debug('VirtualScroller: Lista piccola, rendering completo per', this.items.length, 'elementi');
      this.renderAll();
      return;
    }
    
    vScrollLog.debug('VirtualScroller: Attivando virtualizzazione per', this.items.length, 'elementi');
    
    // Pulisci container
    this.container.innerHTML = '';
    
    // IMPORTANTE: Non creare un container interno per il virtual scroll
    // Inserisci direttamente gli elementi nel container grid per mantenere il layout
    // Assicurati che il container padre mantenga la classe results-container
    if (this.container && !this.container.classList.contains('results-container')) {
      this.container.classList.add('results-container');
    }
    
    // Crea placeholder per tutti gli elementi
    this.createPlaceholders();
    
    // Usa doppio requestAnimationFrame per assicurarsi che i placeholder siano nel DOM e renderizzati
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Renderizza elementi iniziali visibili
        this.renderInitialItems();
      });
    });
  }
  
  // Crea placeholder per tutti gli elementi
  createPlaceholders() {
    // Usa il container principale invece di un container interno
    this.items.forEach((item, index) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'virtual-scroll-placeholder';
      placeholder.dataset.index = index;
      placeholder.style.cssText = `
        height: ${this.placeholderHeight}px;
        background: transparent;
        min-height: ${this.placeholderHeight}px;
      `;
      
      // Inserisci direttamente nel container grid
      this.container.appendChild(placeholder);
      this.observer.observe(placeholder);
    });
  }
  
  // Renderizza elementi inizialmente visibili
  renderInitialItems() {
    // Per il grid layout, renderizza sempre almeno i primi elementi
    // Calcola quanti elementi servono per riempire la viewport
    const itemsPerRow = this.getEstimatedItemsPerRow();
    // Renderizza almeno 3-4 righe di elementi per assicurarsi che siano visibili
    const rowsToRender = 4;
    const visibleEnd = Math.min(this.items.length - 1, itemsPerRow * rowsToRender - 1);
    
    // Renderizza sempre almeno i primi elementi, anche se il calcolo fallisce
    const minItemsToRender = Math.min(16, this.items.length); // Almeno 16 elementi o tutti se ci sono meno
    const maxItemsToRender = Math.max(visibleEnd + 1, minItemsToRender);
    const finalEnd = Math.min(this.items.length - 1, maxItemsToRender);
    
    let renderedCount = 0;
    // Renderizza immediatamente i primi elementi senza delay
    for (let i = 0; i <= finalEnd; i++) {
      const success = this.renderItemAtIndex(i);
      if (success !== false) {
        renderedCount++;
      }
    }
    
    // Se non sono stati renderizzati elementi, prova un approccio alternativo
    if (renderedCount === 0) {
      vScrollLog.warn('VirtualScroller: Nessun elemento renderizzato, tentativo alternativo...');
      // Renderizza direttamente i primi elementi senza placeholder
      for (let i = 0; i < Math.min(12, this.items.length); i++) {
        const item = this.items[i];
        if (item) {
          const renderedElement = this.renderItem(item, i);
          if (renderedElement) {
            this.container.appendChild(renderedElement);
            this.visibleItems.add(i);
            renderedElement.dataset.virtualIndex = i;
            renderedElement.style.minHeight = `${this.placeholderHeight}px`;
          }
        }
      }
    }
  }
  
  // Stima quanti elementi per riga in base alla larghezza dello schermo
  getEstimatedItemsPerRow() {
    const width = window.innerWidth;
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 640) return 2;
    return 1;
  }
  
  // Gestisce intersezioni con viewport
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.dataset.index);
        this.renderItemAtIndex(index, entry.target);
      }
    });
  }
  
  // Renderizza elemento specifico
  renderItemAtIndex(index, placeholder) {
    // Se l'elemento è già stato renderizzato, salta
    if (this.visibleItems.has(index)) {
      return true;
    }
    
    // Se non è stato passato un placeholder, cercalo
    if (!placeholder) {
      placeholder = this.container.querySelector(`.virtual-scroll-placeholder[data-index="${index}"]`);
    }
    
    // Se non trova il placeholder, potrebbe essere già stato sostituito o non ancora creato
    if (!placeholder) {
      // Verifica se esiste già un elemento renderizzato per questo indice
      const existingElement = this.container.querySelector(`[data-virtual-index="${index}"]`);
      if (existingElement) {
        this.visibleItems.add(index);
        return true; // Già renderizzato
      }
      // Se non esiste neanche un elemento renderizzato, potrebbe essere un problema di timing
      // Prova a cercare di nuovo dopo un breve delay
      setTimeout(() => {
        const retryPlaceholder = this.container.querySelector(`.virtual-scroll-placeholder[data-index="${index}"]`);
        if (retryPlaceholder && !this.visibleItems.has(index)) {
          this.renderItemAtIndex(index, retryPlaceholder);
        }
      }, 50);
      return false;
    }
    
    try {
      const item = this.items[index];
      if (!item) {
        vScrollLog.warn('VirtualScroller: Item non trovato all\'indice', index);
        return false;
      }
      
      const renderedElement = this.renderItem(item, index);
      
      if (renderedElement) {
        // Sostituisci placeholder con elemento renderizzato
        placeholder.replaceWith(renderedElement);
        this.visibleItems.add(index);
        
        // Aggiungi attributi per tracking
        renderedElement.dataset.virtualIndex = index;
        // Il grid CSS gestirà automaticamente il posizionamento
        renderedElement.style.minHeight = `${this.placeholderHeight}px`;
        
        return true;
      } else {
        vScrollLog.warn('VirtualScroller: renderItem non ha restituito un elemento per indice', index);
        return false;
      }
    } catch (error) {
      vScrollLog.error('VirtualScroller: Errore rendering elemento', index, error);
      return false;
    }
  }
  
  // Renderizza tutti gli elementi (per liste piccole)
  renderAll() {
    this.container.innerHTML = '';
    
    // Assicurati che il container mantenga la classe results-container
    if (this.container && !this.container.classList.contains('results-container')) {
      this.container.classList.add('results-container');
    }
    
    this.items.forEach((item, index) => {
      const renderedElement = this.renderItem(item, index);
      if (renderedElement) {
        this.container.appendChild(renderedElement);
        this.visibleItems.add(index);
      }
    });
    
    vScrollLog.debug('VirtualScroller: Renderizzati tutti gli elementi');
  }
  
  // Aggiorna la lista di elementi
  updateItems(newItems) {
    this.items = newItems;
    this.visibleItems.clear();
    
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.init();
  }
  
  // Pulisce un elemento specifico
  clearItem(index) {
    const element = this.container.querySelector(`[data-virtual-index="${index}"]`);
    if (element) {
      const placeholder = document.createElement('div');
      placeholder.className = 'virtual-scroll-placeholder';
      placeholder.dataset.index = index;
      placeholder.style.cssText = `
        height: ${this.placeholderHeight}px;
        background: transparent;
        min-height: ${this.placeholderHeight}px;
      `;
      
      element.replaceWith(placeholder);
      this.observer.observe(placeholder);
      this.visibleItems.delete(index);
    }
  }
  
  // Ottiene statistiche di rendering
  getStats() {
    return {
      totalItems: this.items.length,
      visibleItems: this.visibleItems.size,
      renderRatio: this.visibleItems.size / this.items.length,
      isVirtualized: this.items.length >= this.minItemsToVirtualize
    };
  }
  
  // Distrugge il virtual scroller
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.visibleItems.clear();
    this.container.innerHTML = '';
    
    vScrollLog.debug('VirtualScroller: Distrutto');
  }
  
  // Scrolla a un elemento specifico
  scrollToItem(index) {
    if (index < 0 || index >= this.items.length) {
      console.warn('⚠️ VirtualScroller: Indice non valido per scroll:', index);
      return;
    }
    
    const scrollTop = index * this.placeholderHeight;
    this.container.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });
    
    // Assicurati che l'elemento sia renderizzato
    setTimeout(() => {
      this.renderItemAtIndex(index);
    }, 100);
  }
  
  // Ottiene elementi attualmente visibili
  getVisibleItems() {
    return Array.from(this.visibleItems).map(index => ({
      index,
      item: this.items[index]
    }));
  }
}

// Funzione di utilità per creare un virtual scroller
window.createVirtualScroller = (container, items, renderItem, options = {}) => {
  return new VirtualScroller(container, items, renderItem, options);
};

// Auto-scroll intelligente per mantenere posizione
class SmartScrollManager {
  constructor(virtualScroller) {
    this.virtualScroller = virtualScroller;
    this.lastScrollTop = 0;
    this.scrollDirection = 'down';
    this.scrollVelocity = 0;
    this.lastScrollTime = Date.now();
    
    this.setupScrollTracking();
  }
  
  setupScrollTracking() {
    this.virtualScroller.container.addEventListener('scroll', (e) => {
      const currentScrollTop = e.target.scrollTop;
      const currentTime = Date.now();
      
      // Calcola direzione e velocità
      this.scrollDirection = currentScrollTop > this.lastScrollTop ? 'down' : 'up';
      this.scrollVelocity = Math.abs(currentScrollTop - this.lastScrollTop) / (currentTime - this.lastScrollTime);
      
      this.lastScrollTop = currentScrollTop;
      this.lastScrollTime = currentTime;
      
      // Pre-renderizza elementi nella direzione di scroll
      this.preRenderInScrollDirection();
    });
  }
  
  preRenderInScrollDirection() {
    const visibleItems = this.virtualScroller.getVisibleItems();
    if (visibleItems.length === 0) return;
    
    const minIndex = Math.min(...visibleItems.map(v => v.index));
    const maxIndex = Math.max(...visibleItems.map(v => v.index));
    
    if (this.scrollDirection === 'down') {
      // Pre-renderizza elementi in basso
      for (let i = maxIndex + 1; i <= Math.min(maxIndex + 3, this.virtualScroller.items.length - 1); i++) {
        this.virtualScroller.renderItemAtIndex(i);
      }
    } else {
      // Pre-renderizza elementi in alto
      for (let i = Math.max(0, minIndex - 3); i < minIndex; i++) {
        this.virtualScroller.renderItemAtIndex(i);
      }
    }
  }
}

// Esponi globalmente
window.VirtualScroller = VirtualScroller;
// window.VirtualScrollManager = VirtualScrollManager; // Classe non definita

vScrollLog.debug('VirtualScroll inizializzato');
