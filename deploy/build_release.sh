#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="${1:-}"
REF="${2:-HEAD}"
SITE_PACKAGES_DIR="${SITE_PACKAGES_DIR:-$ROOT_DIR/.venv/lib/python3.9/site-packages}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: deploy/build_release.sh <version> [git-ref]"
  exit 1
fi

PACKAGE_NAME="netapp_automation-${VERSION}"
PACKAGE_DIR="$DIST_DIR/$PACKAGE_NAME"
ARCHIVE_PATH="$DIST_DIR/${PACKAGE_NAME}.tar.gz"

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

git -C "$ROOT_DIR" archive "$REF" | tar -x -C "$PACKAGE_DIR"

rm -rf \
  "$PACKAGE_DIR/.codex" \
  "$PACKAGE_DIR/.vscode" \
  "$PACKAGE_DIR/dist" \
  "$PACKAGE_DIR/tests" \
  "$PACKAGE_DIR/upload" \
  "$PACKAGE_DIR/uploads"

cp "$ROOT_DIR/requirements.txt" "$PACKAGE_DIR/requirements.txt"
cp "$ROOT_DIR/requirements-dev.txt" "$PACKAGE_DIR/requirements-dev.txt"
mkdir -p "$PACKAGE_DIR/deploy" "$PACKAGE_DIR/uploads" "$PACKAGE_DIR/var/db"
cp "$ROOT_DIR/deploy/.env.example" "$PACKAGE_DIR/deploy/.env.example"
cp "$ROOT_DIR/deploy/run.sh" "$PACKAGE_DIR/deploy/run.sh"

if [[ -d "$SITE_PACKAGES_DIR" ]]; then
  mkdir -p "$PACKAGE_DIR/vendor"
  cp -a "$SITE_PACKAGES_DIR/." "$PACKAGE_DIR/vendor/"
  rm -rf \
    "$PACKAGE_DIR/vendor/pip" \
    "$PACKAGE_DIR/vendor/pip-"*.dist-info \
    "$PACKAGE_DIR/vendor/setuptools" \
    "$PACKAGE_DIR/vendor/setuptools-"*.dist-info \
    "$PACKAGE_DIR/vendor/wheel" \
    "$PACKAGE_DIR/vendor/wheel-"*.dist-info \
    "$PACKAGE_DIR/vendor/__pycache__"
fi

chmod +x "$PACKAGE_DIR/deploy/run.sh"

cat > "$PACKAGE_DIR/VERSION" <<EOF
$VERSION
EOF

python3 --version > "$PACKAGE_DIR/PYTHON_VERSION"

tar -C "$DIST_DIR" -czf "$ARCHIVE_PATH" "$PACKAGE_NAME"
echo "Created release archive: $ARCHIVE_PATH"
