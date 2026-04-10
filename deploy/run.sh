#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
VENDOR_DIR="$ROOT_DIR/vendor"
ENV_FILE="$ROOT_DIR/.env"
ENV_TEMPLATE="$ROOT_DIR/deploy/.env.example"

cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/uploads" "$ROOT_DIR/var/db"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  echo "Created default .env from deploy/.env.example"
fi

if [[ -d "$VENDOR_DIR" ]]; then
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

set -a
source "$ENV_FILE"
set +a

exec "$PYTHON_BIN" -m uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
