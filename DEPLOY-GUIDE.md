# 🚀 Guida Deploy - QuoVadiScout

## 📋 Checklist Pre-Deploy

### ✅ Verifiche Preliminari
- [x] DEBUG = false in script.js
- [x] API routes configurate per Vercel
- [ ] File dist/ aggiornati (se necessario)
- [ ] Variabili ambiente configurate su Vercel
- [ ] Firestore rules deployate

---

## 🔧 Procedura Deploy

### Step 1: Verifica File Modificati
```powershell
git status
git diff --stat
```

### Step 2: Aggiungi File Modificati e Nuovi
```powershell
git add .
```

### Step 3: Commit delle Modifiche
```powershell
git commit -m "🚀 Deploy migliorie testate offline - v1.3.1"
```

**Oppure usa lo script automatico:**
```powershell
.\deploy.ps1 "🚀 Deploy migliorie testate offline - v1.3.1"
```

### Step 4: Verifica Variabili Ambiente Vercel

Assicurati che su Vercel (Project → Settings → Environment Variables) siano configurate:

**Firebase:**
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` (opzionale)
- `FIREBASE_VAPID_KEY` (opzionale)

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_UPLOAD_PRESET`
- `CLOUDINARY_FOLDER`

**Sentry (opzionale):**
- `SENTRY_DSN`

### Step 5: Deploy diretto su Vercel (SENZA GitHub)

**Deploy manuale diretto:**
```powershell
vercel --prod
```

Questo comando:
- Deploya direttamente su Vercel senza passare da GitHub
- Usa le variabili ambiente configurate su Vercel
- Aggiorna la produzione immediatamente

### Step 6: Verifica Post-Deploy

1. **Verifica API Routes:**
   - `https://quovadiscout.vercel.app/api/firebase-config.js` → 200 OK
   - `https://quovadiscout.vercel.app/api/cloudinary-config.js` → 200 OK

2. **Smoke Test:**
   - [ ] Login / Logout funziona
   - [ ] Lista strutture carica correttamente
   - [ ] Filtri e ordinamento funzionano
   - [ ] Mappa OSM visualizza correttamente
   - [ ] CRUD struttura funziona
   - [ ] Upload immagini funziona

3. **Performance:**
   - [ ] Lighthouse mobile: Performance ≥90
   - [ ] Lighthouse mobile: A11y ≥90
   - [ ] Service Worker registrato correttamente

4. **Console:**
   - [ ] Nessun errore rosso in Console
   - [ ] Nessun errore in Network tab

---

## 🔄 Rollback (se necessario)

Se qualcosa va storto:

1. **Ripristina versione precedente:**
```powershell
git revert HEAD
git push origin main
```

2. **O forza deploy di un commit specifico:**
```powershell
git checkout <commit-hash>
vercel --prod
```

---

## 📝 Note Importanti

- **Deploy diretto**: Usa `vercel --prod` per deploy diretto senza passare da GitHub
- Le variabili ambiente devono essere configurate prima del deploy su Vercel Dashboard
- Il Service Worker potrebbe richiedere un refresh forzato (Ctrl+Shift+R)
- I file in `dist/` sono già presenti e verranno serviti correttamente
- Il commit locale è opzionale ma consigliato per tracciare le modifiche

---

## 🎯 Prossimi Passi Dopo Deploy

1. Monitorare errori in console per 24-48h
2. Verificare metriche performance su Vercel Analytics
3. Aggiornare QA-CHECKLIST.md con i test completati
4. Documentare eventuali problemi riscontrati

