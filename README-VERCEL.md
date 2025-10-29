# 🚀 QuoVadiScout - Deployment Vercel

## 📋 Workflow di Deployment

Questo progetto è ora completamente gestito tramite Vercel, senza dipendenze da GitHub.

### 🔧 Setup Iniziale Completato

- ✅ Repository locale Git configurato
- ✅ Remote GitHub rimosso
- ✅ Vercel CLI configurato e autenticato
- ✅ Variabili d'ambiente configurate
- ✅ Dominio personalizzato: https://quovadiscout.vercel.app/

### 🚀 Deployment

#### Metodo 1: Script Automatico (Raccomandato)
```powershell
# Windows PowerShell
.\deploy.ps1 "Messaggio del commit"

# Esempio
.\deploy.ps1 "Aggiunta nuova funzionalità"
```

```bash
# Linux/macOS
./deploy.sh "Messaggio del commit"

# Esempio
./deploy.sh "Aggiunta nuova funzionalità"
```

#### Metodo 2: Comandi Manuali
```bash
# 1. Aggiungi file modificati
git add .

# 2. Commit delle modifiche
git commit -m "Messaggio del commit"

# 3. Deploy su Vercel
vercel --prod
```

### 📊 Gestione Progetto

#### Comandi Vercel Utili
```bash
# Visualizza progetti
vercel project ls

# Visualizza variabili d'ambiente
vercel env ls

# Visualizza logs
vercel logs [deployment-url]

# Redeploy
vercel redeploy [deployment-url]

# Apri dashboard Vercel
vercel dashboard
```

#### Informazioni Progetto
- **Nome**: quovadiscout
- **URL Produzione**: https://quovadiscout.vercel.app/
- **Team**: dicelessmans-projects
- **Node Version**: 22.x

### 🔐 Variabili d'Ambiente Configurate

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_UPLOAD_PRESET`
- `CLOUDINARY_FOLDER`

### 📁 Struttura File

```
QuoVadiScout/
├── deploy.ps1          # Script PowerShell per deployment
├── deploy.sh           # Script Bash per deployment
├── vercel.json         # Configurazione Vercel
├── README-VERCEL.md    # Questa documentazione
└── [altri file progetto]
```

### 🎯 Vantaggi della Migrazione

1. **Gestione Unificata**: Tutto in un'unica piattaforma
2. **Deployment Rapido**: Deploy diretto senza passaggi intermedi
3. **Controllo Completo**: Accesso diretto a logs, analytics, e configurazioni
4. **Sicurezza**: Variabili d'ambiente gestite centralmente
5. **Performance**: CDN globale di Vercel

### 🔄 Workflow Tipico

1. Modifica il codice
2. Testa localmente
3. Esegui `.\deploy.ps1 "Descrizione modifiche"`
4. Verifica su https://quovadiscout.vercel.app/

### 🆘 Supporto

Per problemi o domande:
- Dashboard Vercel: https://vercel.com/dashboard
- Documentazione Vercel: https://vercel.com/docs
- Logs deployment: `vercel logs [deployment-url]`
