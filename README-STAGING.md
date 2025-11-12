# Staging Guide

## Obiettivo
Eseguire uno staging sicuro (dominio separato), con variabili runtime dedicate e controlli finali prima del go-live.

## Configurazioni
- Firebase (in Vercel Env Vars)
  - FIREBASE_API_KEY
  - FIREBASE_AUTH_DOMAIN
  - FIREBASE_PROJECT_ID
  - FIREBASE_STORAGE_BUCKET
  - FIREBASE_MESSAGING_SENDER_ID
  - FIREBASE_APP_ID
  - FIREBASE_MEASUREMENT_ID (opz.)
  - FIREBASE_VAPID_KEY (opz.)
- Cloudinary (in Vercel Env Vars)
  - CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_UPLOAD_PRESET
  - CLOUDINARY_FOLDER
- Sentry (opzionale)
  - SENTRY_DSN (vuoto in locale; sampling basso in staging)

## Passi Staging
1. Imposta le Env Vars su Vercel (Project → Settings → Environment Variables).
2. Deploy su un dominio staging (es. staging.example.com) senza promuovere a prod.
3. Verifica che /api/firebase-config.js e /api/cloudinary-config.js servano i valori corretti (Network → 200 OK).
4. Esegui smoke test:
   - Login / Logout
   - Lista, filtri, ordinamenti
   - CRUD struttura su collezione staging
   - Galleria: upload, thumbnail, delete riferimento
   - Mappa OSM e geolocalizzazione solo su gesto utente
5. Lighthouse (mobile): Performance ≥90, A11y/Best/SEO ≥90.
6. Sentry (se attivo): errori catturati, sampling basso (0–0.1), no PII.

## Header caching consigliati (prod/staging)
- dist/*.js, *.css: Cache-Control: public, max-age=31536000, immutable
- HTML: Cache-Control: no-cache

## Rollback
- Puntare index.html a file non minificati in emergenza.
- Ripristinare service-worker.js precedente e forzare cache-bust.

## Criteri di accettazione
- Zero errori rossi in Console/Network su flussi principali.
- Performance (LH mobile) ≥90.
- CRUD e galleria ok su collezione staging.
- SW attivo, nessuna cache zombie.
