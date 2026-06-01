#!/usr/bin/env bash
# Smart Farm Monitor — setup and launch script
#
# Usage:
#   ./start.sh              Build frontend, then start Flask (production)
#   ./start.sh --dev        Start Flask + Vite dev server side-by-side
#   ./start.sh --demo       Also run the sensor simulator
#   ./start.sh --demo=dry   Run simulator with a scenario (hot|dry|humid|all|healthy|disease)
#   ./start.sh --setup      Install all dependencies and build, then exit
#   ./start.sh --build      Rebuild the frontend only, then exit

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'
CYN='\033[0;36m'; BLD='\033[1m';    NC='\033[0m'

ok()   { echo -e "${GRN}  ✓${NC}  $*"; }
info() { echo -e "${CYN}  →${NC}  $*"; }
warn() { echo -e "${YLW}  ⚠${NC}  $*"; }
die()  { echo -e "${RED}  ✗${NC}  $*" >&2; exit 1; }
hdr()  { echo -e "\n${BLD}${CYN}$*${NC}"; }

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
MODEL_DIR="$ROOT/model/saved_model"
VENV="$BACKEND/venv"
TFLITE="$MODEL_DIR/tomato_disease.tflite"
H5="$MODEL_DIR/best_model.h5"

# ── Flags ─────────────────────────────────────────────────────────────────────
DEV=false
DEMO=false
DEMO_SCENARIO="normal"
SETUP_ONLY=false
BUILD_ONLY=false

for arg in "$@"; do
  case $arg in
    --dev)         DEV=true ;;
    --demo)        DEMO=true ;;
    --demo=*)      DEMO=true; DEMO_SCENARIO="${arg#--demo=}" ;;
    --setup)       SETUP_ONLY=true ;;
    --build)       BUILD_ONLY=true ;;
    --help|-h)
      echo ""
      echo -e "  ${BLD}Usage:${NC} $0 [options]"
      echo ""
      echo "  (no options)     Build frontend, start Flask on :5000"
      echo "  --dev            Start Flask (:5000) + Vite dev server (:5173)"
      echo "  --demo           Run sensor simulator alongside the server"
      echo "  --demo=SCENARIO  Simulator scenario: hot | dry | humid | all | healthy | disease"
      echo "  --setup          Install deps + build frontend, then exit"
      echo "  --build          Rebuild frontend only, then exit"
      echo ""
      exit 0 ;;
    *) warn "Unknown argument: $arg (ignored)" ;;
  esac
done

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}  Smart Farm Monitor${NC}"
echo -e "  ──────────────────────────────────────────────"

# ── 1. Python ─────────────────────────────────────────────────────────────────
hdr "[ 1 / 6 ]  Python"

if command -v python3 &>/dev/null; then
  PYTHON=python3
elif command -v python &>/dev/null; then
  PYTHON=python
else
  die "Python not found. Install Python 3.9+ and add it to PATH."
fi

PY_VER=$($PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJ=$(echo "$PY_VER" | cut -d. -f1)
PY_MIN=$(echo "$PY_VER" | cut -d. -f2)
[[ "$PY_MAJ" -ge 3 && "$PY_MIN" -ge 9 ]] || die "Python 3.9+ required. Found $PY_VER."
ok "Python $PY_VER"

# ── 2. Python venv + packages ─────────────────────────────────────────────────
hdr "[ 2 / 6 ]  Python environment"

if [[ ! -d "$VENV" ]]; then
  info "Creating virtualenv at backend/venv …"
  $PYTHON -m venv "$VENV" || { echo "ERROR: Failed to create virtualenv. Install python3-venv and retry."; exit 1; }
fi
# shellcheck disable=SC1091
if [[ -f "$VENV/bin/activate" ]]; then
  source "$VENV/bin/activate"
else
  source "$VENV/Scripts/activate"
fi

if $PYTHON -c "import flask, flask_cors, numpy, PIL, werkzeug, tensorflow" &>/dev/null 2>&1; then
  ok "Python packages already installed"
else
  info "Installing backend packages (first run may take a few minutes) …"
  pip install --quiet --upgrade pip
  pip install --quiet -r "$BACKEND/requirements.txt"
  ok "Backend packages installed"
fi

# ── 3. Node.js ────────────────────────────────────────────────────────────────
hdr "[ 3 / 6 ]  Node.js"

command -v node &>/dev/null || die "node not found. Install Node.js 18+ from https://nodejs.org"
command -v npm  &>/dev/null || die "npm not found. Install Node.js 18+ from https://nodejs.org"

NODE_VER=$(node --version)
ok "Node $NODE_VER"

# ── 4. npm packages ───────────────────────────────────────────────────────────
hdr "[ 4 / 6 ]  Frontend packages"

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  info "Running npm install …"
  npm --prefix "$FRONTEND" install --silent
  ok "npm packages installed"
else
  ok "node_modules already present"
fi

# ── 5. Frontend build ─────────────────────────────────────────────────────────
hdr "[ 5 / 6 ]  Frontend build"

if $DEV; then
  ok "Skipped — Vite dev server will be used instead"
else
  info "Building React app …"
  npm --prefix "$FRONTEND" run build --silent
  ok "Built → frontend/dist/"
fi

# ── 6. AI model ───────────────────────────────────────────────────────────────
hdr "[ 6 / 6 ]  AI model"

if [[ -f "$TFLITE" ]]; then
  ok "TFLite model found"
elif [[ -f "$H5" ]]; then
  warn "tomato_disease.tflite missing — converting from best_model.h5 …"
  $PYTHON - <<PYEOF
import tensorflow as tf
model = tf.keras.models.load_model("$H5")
conv  = tf.lite.TFLiteConverter.from_keras_model(model)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
with open("$TFLITE", "wb") as f:
    f.write(conv.convert())
PYEOF
  ok "Model converted → model/saved_model/tomato_disease.tflite"
else
  warn "No model found. Leaf disease detection will be disabled."
  warn "To train: cd model && pip install -r requirements.txt && python train.py"
fi

# ── Setup / build-only exit ───────────────────────────────────────────────────
if $SETUP_ONLY || $BUILD_ONLY; then
  echo ""
  ok "Done. Run  ./start.sh  to start the app."
  echo ""
  exit 0
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ──────────────────────────────────────────────"
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

if $DEV; then
  echo -e "  ${BLD}Mode:${NC}         Development (hot reload)"
  echo -e "  ${BLD}Open browser:${NC} http://localhost:5173"
  echo -e "  ${BLD}Flask API:${NC}    http://localhost:5000"
else
  echo -e "  ${BLD}Mode:${NC}         Production"
  echo -e "  ${BLD}Open browser:${NC} http://localhost:5000"
  echo -e "  ${BLD}On network:${NC}   http://$LOCAL_IP:5000"
fi
echo ""
echo -e "  Press ${BLD}Ctrl+C${NC} to stop all processes."
echo -e "  ──────────────────────────────────────────────"
echo ""

PIDS=()

cleanup() {
  echo ""
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && true
  done
  info "All processes stopped."
}
trap cleanup EXIT INT TERM

# Demo sensor simulator
if $DEMO; then
  info "Starting demo simulator (scenario: $DEMO_SCENARIO) …"
  $PYTHON "$BACKEND/demo_sender.py" --scenario "$DEMO_SCENARIO" &
  PIDS+=($!)
  ok "Simulator running — sensor data will appear in a few seconds."
  echo ""
fi

# Flask backend
info "Starting Flask backend …"
cd "$BACKEND"
$PYTHON app.py &
PIDS+=($!)

# Vite dev server (dev mode only)
if $DEV; then
  sleep 1   # give Flask a moment to bind its port first
  info "Starting Vite dev server …"
  npm --prefix "$ROOT/frontend" run dev &
  PIDS+=($!)
fi

# Wait for all background processes
wait
