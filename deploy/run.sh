#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
VENDOR_DIR="$ROOT_DIR/vendor"
RUNTIME_DIR="$ROOT_DIR/runtime"
ENV_FILE="$ROOT_DIR/.env"
ENV_TEMPLATE="$ROOT_DIR/deploy/.env.example"

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  echo "Created default .env from deploy/.env.example"
fi

set -a
source "$ENV_FILE"
set +a

mkdir -p "$ROOT_DIR/${UPLOAD_DIR:-upload}"

if [[ -x "$RUNTIME_DIR/bin/python" ]]; then
  PYTHON_LIB_DIR="$(find "$RUNTIME_DIR/lib" -maxdepth 1 -type d -name 'python*' | head -n 1)"
  SITE_PACKAGES_DIR=""
  if [[ -n "$PYTHON_LIB_DIR" && -d "$PYTHON_LIB_DIR/site-packages" ]]; then
    SITE_PACKAGES_DIR="$PYTHON_LIB_DIR/site-packages"
  fi
  export PYTHONHOME="$RUNTIME_DIR"
  export LD_LIBRARY_PATH="$RUNTIME_DIR/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  if [[ -n "$SITE_PACKAGES_DIR" ]]; then
    export PYTHONPATH="$SITE_PACKAGES_DIR${PYTHONPATH:+:$PYTHONPATH}"
  fi
  PYTHON_BIN="$RUNTIME_DIR/bin/python"
elif [[ -d "$VENDOR_DIR" ]]; then
  export PYTHONPATH="$VENDOR_DIR${PYTHONPATH:+:$PYTHONPATH}"
  PYTHON_BIN="${PYTHON_BIN:-python3}"
else
  if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
  fi

  source "$VENV_DIR/bin/activate"
  python -m pip install --upgrade pip >/dev/null
  python -m pip install -r "$ROOT_DIR/requirements.txt"
  PYTHON_BIN="python"
fi

exec "$PYTHON_BIN" -m uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
