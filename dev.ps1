# CredCore - Dev Server Script para PowerShell
Write-Host "Iniciando CredCore..." -ForegroundColor Cyan

$env:DJANGO_SETTINGS_MODULE = "config.settings.development"
$env:USE_SQLITE = "True"
$env:USE_REDIS = "False"

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; `$env:DJANGO_SETTINGS_MODULE='config.settings.development'; `$env:USE_SQLITE='True'; `$env:USE_REDIS='False'; .\venv\Scripts\python manage.py runserver 0.0.0.0:8000" -WindowStyle Normal

Start-Sleep -Seconds 2

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Servidores corriendo:" -ForegroundColor Green
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/api/v1/docs/" -ForegroundColor White
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
