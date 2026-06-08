# CredCore — Lanzador completo (setup + dev + browser)
# Ejecutar: clic derecho → "Ejecutar con PowerShell"

$Host.UI.RawUI.WindowTitle = "CredCore Launcher"
$ErrorActionPreference = "Stop"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "  [$n] $msg" -ForegroundColor Cyan
}
function Write-OK($msg)  { Write-Host "      OK: $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "      ERROR: $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "  =====================================" -ForegroundColor Blue
Write-Host "    CredCore — Sistema de Creditos     " -ForegroundColor Blue
Write-Host "  =====================================" -ForegroundColor Blue

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"

# ── 1. Verificar Python ──────────────────────────────────────
Write-Step "1/6" "Verificando Python..."
try {
    $pyver = & python --version 2>&1
    Write-OK $pyver
} catch {
    Write-Err "Python no encontrado. Descargalo de https://python.org"
    Write-Host ""
    Start-Process "https://www.python.org/downloads/"
    Read-Host "  Instala Python y presiona Enter para continuar"
}

# ── 2. Verificar Node ────────────────────────────────────────
Write-Step "2/6" "Verificando Node.js..."
try {
    $nodever = & node --version 2>&1
    Write-OK "Node $nodever"
} catch {
    Write-Err "Node.js no encontrado. Descargalo de https://nodejs.org"
    Start-Process "https://nodejs.org/en/download"
    Read-Host "  Instala Node.js y presiona Enter para continuar"
}

# ── 3. Setup venv Python ─────────────────────────────────────
Write-Step "3/6" "Configurando entorno Python..."
Set-Location $BACKEND

if (-not (Test-Path "venv")) {
    Write-Host "      Creando entorno virtual..." -ForegroundColor Yellow
    & python -m venv venv
}

# Instalar requirements si no hay django instalado
$djangoCheck = & .\venv\Scripts\python -c "import django; print(django.__version__)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Instalando dependencias Python (puede tardar 2-3 min)..." -ForegroundColor Yellow
    & .\venv\Scripts\pip install -r requirements\development.txt --quiet
}
Write-OK "Entorno Python listo"

# ── 4. Migraciones ───────────────────────────────────────────
Write-Step "4/6" "Ejecutando migraciones..."
$env:DJANGO_SETTINGS_MODULE = "config.settings.development"
$env:USE_SQLITE = "True"
$env:USE_REDIS = "False"
& .\venv\Scripts\python manage.py migrate --run-syncdb 2>&1 | Out-Null
& .\venv\Scripts\python manage.py crear_admin 2>&1 | Out-Null
Write-OK "Base de datos lista"

# ── 5. Frontend npm install ──────────────────────────────────
Write-Step "5/6" "Instalando dependencias frontend..."
Set-Location $FRONTEND
if (-not (Test-Path "node_modules")) {
    Write-Host "      npm install (puede tardar 1-2 min)..." -ForegroundColor Yellow
    & npm install --silent
}
Write-OK "Frontend listo"

# ── 6. Arrancar servidores ───────────────────────────────────
Write-Step "6/6" "Iniciando servidores..."

# Backend
$backendJob = Start-Process -FilePath "powershell" `
    -ArgumentList "-NoProfile -Command `"cd '$BACKEND'; `$env:DJANGO_SETTINGS_MODULE='config.settings.development'; `$env:USE_SQLITE='True'; `$env:USE_REDIS='False'; .\venv\Scripts\python manage.py runserver 0.0.0.0:8000`"" `
    -WindowStyle Minimized -PassThru

Start-Sleep -Seconds 3

# Frontend
$frontendJob = Start-Process -FilePath "powershell" `
    -ArgumentList "-NoProfile -Command `"cd '$FRONTEND'; npm run dev`"" `
    -WindowStyle Minimized -PassThru

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "  =====================================" -ForegroundColor Green
Write-Host "    CredCore corriendo exitosamente!   " -ForegroundColor Green
Write-Host "  =====================================" -ForegroundColor Green
Write-Host ""
Write-Host "    Backend API:  http://localhost:8000/api/v1/" -ForegroundColor White
Write-Host "    API Docs:     http://localhost:8000/api/v1/docs/" -ForegroundColor White
Write-Host "    Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Abriendo el navegador..." -ForegroundColor Cyan

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "  Presiona Enter para detener todos los servidores." -ForegroundColor Yellow
Read-Host

$backendJob | Stop-Process -Force -ErrorAction SilentlyContinue
$frontendJob | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Servidores detenidos." -ForegroundColor Gray
