#!/bin/bash
# Script Bash per deployment automatico su Vercel
# Uso: ./deploy.sh [messaggio commit]

COMMIT_MESSAGE=${1:-"🚀 Deploy automatico su Vercel"}

echo "🚀 Avvio deployment su Vercel..."

# Aggiungi tutti i file modificati
echo "📁 Aggiunta file modificati..."
git add .

# Commit delle modifiche
echo "💾 Commit delle modifiche..."
git commit -m "$COMMIT_MESSAGE"

# Deploy su Vercel
echo "🌐 Deploy su Vercel..."
vercel --prod

echo "✅ Deploy completato!"
echo "🔗 URL: https://quovadiscout.vercel.app/"
