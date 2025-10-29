# Script PowerShell per deployment automatico su Vercel
# Uso: .\deploy.ps1 [messaggio commit]

param(
    [string]$commitMessage = "🚀 Deploy automatico su Vercel"
)

Write-Host "🚀 Avvio deployment su Vercel..." -ForegroundColor Green

# Aggiungi tutti i file modificati
Write-Host "Aggiunta file modificati..." -ForegroundColor Yellow
git add .

# Commit delle modifiche
Write-Host "Commit delle modifiche..." -ForegroundColor Yellow
git commit -m $commitMessage

# Deploy su Vercel
Write-Host "Deploy su Vercel..." -ForegroundColor Yellow
vercel --prod

Write-Host "Deploy completato!" -ForegroundColor Green
Write-Host "URL: https://quovadiscout.vercel.app/" -ForegroundColor Cyan
