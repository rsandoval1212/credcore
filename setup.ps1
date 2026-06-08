# CredCore - Setup Script para PowerShell
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  CredCore - Configuracion Inicial" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Verificar Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python no encontrado. Instala Python 3.10+ desde python.org" -ForegroundColor Red
    exit 1
}

# Verificar Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js no encontrado. Instala Node 18+ desde nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Copiando .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "      .env creado correctamente." -ForegroundColor Green
}

Write-Host "[2/5] Creando entorno virtual Python..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Path "venv")) {
    python -m venv venv
}

Write-Host "[3/5] Instalando dependencias Python..." -ForegroundColor Yellow
& .\venv\Scripts\pip install -r requirements\development.txt --quiet

Write-Host "[4/5] Ejecutando migraciones Django..." -ForegroundColor Yellow
$env:DJANGO_SETTINGS_MODULE = "config.settings.development"
$env:USE_SQLITE = "True"
$env:USE_REDIS = "False"
& .\venv\Scripts\python manage.py makemigrations
& .\venv\Scripts\python manage.py migrate

Write-Host "[5/5] Instalando dependencias frontend..." -ForegroundColor Yellow
Set-Location ..\frontend
npm install

Set-Location ..

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Configuracion completada!" -ForegroundColor Green
Write-Host "  Ejecuta: .\dev.ps1  para iniciar" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
