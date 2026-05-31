# Smart Farm Monitor - Windows launch script
#
# Usage:
#   .\start.ps1                          Build frontend, start Flask on :5000
#   .\start.ps1 -Dev                     Start Flask + Vite dev server side by side
#   .\start.ps1 -Demo                    Also run the sensor simulator
#   .\start.ps1 -Demo -Scenario dry      Simulator with a scenario
#   .\start.ps1 -Setup                   Install all dependencies and build, then exit
#   .\start.ps1 -Build                   Rebuild frontend only, then exit
#
# First-time setup:
#   Run this in PowerShell as Administrator once to allow script execution:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

param(
    [switch]$Dev,
    [switch]$Demo,
    [string]$Scenario = "normal",
    [switch]$Setup,
    [switch]$Build,
    [switch]$Help
)

# ── Helpers ───────────────────────────────────────────────────────────────────
function OK($msg)   { Write-Host "  [OK] $msg"   -ForegroundColor Green  }
function INFO($msg) { Write-Host "  --> $msg"    -ForegroundColor Cyan   }
function WARN($msg) { Write-Host "  [!] $msg"    -ForegroundColor Yellow }
function HDR($msg)  { Write-Host "`n$msg"        -ForegroundColor Cyan   }
function DIE($msg)  { Write-Host "  [X] $msg" -ForegroundColor Red; exit 1 }

# ── Paths ─────────────────────────────────────────────────────────────────────
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$ModelDir = Join-Path $Root "model\saved_model"
$Venv     = Join-Path $Backend "venv"
$VenvPy   = Join-Path $Venv "Scripts\python.exe"
$VenvPip  = Join-Path $Venv "Scripts\pip.exe"
$TFLite   = Join-Path $ModelDir "tomato_disease.tflite"
$H5       = Join-Path $ModelDir "best_model.h5"

if ($Help) {
    Write-Host ""
    Write-Host "  Usage: .\start.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "  (no options)            Build frontend, start Flask on :5000"
    Write-Host "  -Dev                    Start Flask (:5000) + Vite dev server (:5173)"
    Write-Host "  -Demo                   Run sensor simulator alongside the server"
    Write-Host "  -Demo -Scenario NAME    Scenario: hot | dry | humid | all | healthy | disease"
    Write-Host "  -Setup                  Install deps + build frontend, then exit"
    Write-Host "  -Build                  Rebuild frontend only, then exit"
    Write-Host ""
    exit 0
}

# ── Header ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Smart Farm Monitor" -ForegroundColor White
Write-Host "  ----------------------------------------------"

# ── 1. Python ─────────────────────────────────────────────────────────────────
HDR "[ 1 / 6 ]  Python"

$PythonCmd = $null
foreach ($cmd in @("python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $PythonCmd = $cmd; break
    }
}
if (-not $PythonCmd) { DIE "Python not found. Install Python 3.9+ from https://www.python.org" }

$PyVer = & $PythonCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
$PyMaj, $PyMin = $PyVer.Split(".")
if ([int]$PyMaj -lt 3 -or ([int]$PyMaj -eq 3 -and [int]$PyMin -lt 9)) {
    DIE "Python 3.9+ required. Found $PyVer."
}
OK "Python $PyVer"

# ── 2. Python venv + packages ─────────────────────────────────────────────────
HDR "[ 2 / 6 ]  Python environment"

if (-not (Test-Path $Venv)) {
    INFO "Creating virtualenv at backend\venv ..."
    & $PythonCmd -m venv $Venv
}

$CheckImports = "import flask, flask_cors, numpy, PIL, werkzeug, tensorflow"
$AlreadyInstalled = & $VenvPy -c $CheckImports 2>$null
if ($LASTEXITCODE -eq 0) {
    OK "Python packages already installed"
} else {
    INFO "Installing backend packages (first run may take a few minutes) ..."
    & $VenvPip install --quiet --upgrade pip
    & $VenvPip install --quiet -r (Join-Path $Backend "requirements.txt")
    OK "Backend packages installed"
}

# ── 3. Node.js ────────────────────────────────────────────────────────────────
HDR "[ 3 / 6 ]  Node.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    DIE "node not found. Install Node.js 18+ from https://nodejs.org"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    DIE "npm not found. Install Node.js 18+ from https://nodejs.org"
}
$NodeVer = node --version
OK "Node $NodeVer"

# ── 4. npm packages ───────────────────────────────────────────────────────────
HDR "[ 4 / 6 ]  Frontend packages"

$NodeModules = Join-Path $Frontend "node_modules"
if (-not (Test-Path $NodeModules)) {
    INFO "Running npm install ..."
    npm --prefix $Frontend install --silent
    OK "npm packages installed"
} else {
    OK "node_modules already present"
}

# ── 5. Frontend build ─────────────────────────────────────────────────────────
HDR "[ 5 / 6 ]  Frontend build"

if ($Dev) {
    OK "Skipped - Vite dev server will be used instead"
} else {
    INFO "Building React app ..."
    npm --prefix $Frontend run build --silent
    OK "Built -> frontend\dist\"
}

# ── 6. AI model ───────────────────────────────────────────────────────────────
HDR "[ 6 / 6 ]  AI model"

if (Test-Path $TFLite) {
    OK "TFLite model found"
} elseif (Test-Path $H5) {
    WARN "tomato_disease.tflite missing - converting from best_model.h5 ..."
    $ConvertScript = @"
import tensorflow as tf
model = tf.keras.models.load_model(r'$H5')
conv  = tf.lite.TFLiteConverter.from_keras_model(model)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
with open(r'$TFLite', 'wb') as f:
    f.write(conv.convert())
"@
    $ConvertScript | & $VenvPy
    OK "Model converted -> model\saved_model\tomato_disease.tflite"
} else {
    WARN "No model found. Leaf disease detection will be disabled."
    WARN "To train: cd model && pip install -r requirements.txt && python train.py"
}

# ── Setup / build-only exit ───────────────────────────────────────────────────
if ($Setup -or $Build) {
    Write-Host ""
    OK "Done. Run  .\start.ps1  to start the app."
    Write-Host ""
    exit 0
}

# ── Launch ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ----------------------------------------------"

if ($Dev) {
    Write-Host "  Mode:          Development (hot reload)"
    Write-Host "  Open browser:  http://localhost:5173"
    Write-Host "  Flask API:     http://localhost:5000"
} else {
    Write-Host "  Mode:          Production"
    Write-Host "  Open browser:  http://localhost:5000"
}

Write-Host ""
Write-Host "  Press Ctrl+C to stop all processes."
Write-Host "  ----------------------------------------------"
Write-Host ""

$Processes = @()

# Demo sensor simulator
if ($Demo) {
    INFO "Starting demo simulator (scenario: $Scenario) ..."
    $DemoProc = Start-Process -FilePath $VenvPy `
        -ArgumentList (Join-Path $Backend "demo_sender.py"), "--scenario", $Scenario `
        -NoNewWindow -PassThru
    $Processes += $DemoProc
    OK "Simulator running (PID $($DemoProc.Id)) - data will appear in a few seconds."
    Write-Host ""
}

# Flask backend
INFO "Starting Flask backend ..."
$FlaskProc = Start-Process -FilePath $VenvPy `
    -ArgumentList (Join-Path $Backend "app.py") `
    -NoNewWindow -PassThru -WorkingDirectory $Backend
$Processes += $FlaskProc

# Vite dev server (dev mode only)
if ($Dev) {
    Start-Sleep -Seconds 1
    INFO "Starting Vite dev server ..."
    $ViteProc = Start-Process -FilePath "npm" `
        -ArgumentList "--prefix", $Frontend, "run", "dev" `
        -NoNewWindow -PassThru
    $Processes += $ViteProc
}

# Wait and clean up on Ctrl+C
try {
    Wait-Process -Id ($Processes | Select-Object -ExpandProperty Id)
} finally {
    Write-Host ""
    foreach ($proc in $Processes) {
        if (-not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
    INFO "All processes stopped."
}
