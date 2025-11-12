# QA Checklist (Staging)

## Funzionalità
- [x] Login / Logout
- [x] Lista + filtri + ordinamento (con grid responsive)
- [ ] Visualizzazione mappa OSM
- [ ] Geolocalizzazione solo dopo gesto utente
- [ ] CRUD struttura (create, update, delete) su collezione staging
- [ ] Galleria immagini: upload, thumbnail visibile, delete riferimento

## Performance
- [x] Virtual scrolling su liste >100 (compatibile con grid layout)
- [ ] Lazy-load immagini (Network conferma)
- [x] JS secondari da dist/ (Network)
- [ ] Lighthouse mobile: Perf ≥90, A11y/Best/SEO ≥90

## PWA / Caching
- [ ] Service worker registrato senza errori
- [ ] Cache version corretta (Application → Cache Storage)
- [ ] Manifest e icone risolvono (nessun 404)

## Sicurezza
- [ ] Firestore: lettura pubblica strutture; scrittura autenticati
- [ ] Domini autorizzati su Firebase includono staging

## Telemetria (opz.)
- [ ] Sentry DSN attivo con sampling ≤0.1
- [ ] Nessuna PII nei payload

## Rollback
- [ ] Procedura documentata e testata (ripristino JS non minificati / SW precedente)
