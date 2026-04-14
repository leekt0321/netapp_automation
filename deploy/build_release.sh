#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="${1:-}"
REF="${2:-HEAD}"
PORTABLE_PYTHON_BIN="${PORTABLE_PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"

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
  "$PACKAGE_DIR/uploads" \
  "$PACKAGE_DIR/var/db"

cp "$ROOT_DIR/requirements.txt" "$PACKAGE_DIR/requirements.txt"
cp "$ROOT_DIR/requirements-dev.txt" "$PACKAGE_DIR/requirements-dev.txt"
mkdir -p "$PACKAGE_DIR/deploy" "$PACKAGE_DIR/upload"
cp "$ROOT_DIR/deploy/.env.example" "$PACKAGE_DIR/deploy/.env.example"
cp "$ROOT_DIR/deploy/run.sh" "$PACKAGE_DIR/deploy/run.sh"

if [[ ! -x "$PORTABLE_PYTHON_BIN" ]]; then
  PORTABLE_PYTHON_BIN="$(command -v python3)"
fi

PYTHON_REALBIN="$("$PORTABLE_PYTHON_BIN" -c 'import os, sys; print(os.path.realpath(sys.executable))')"
PYTHON_VERSION="$("$PORTABLE_PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_python_version())')"
PYTHON_STDLIB="$("$PORTABLE_PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("stdlib"))')"
PYTHON_PURELIB="$("$PORTABLE_PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("purelib"))')"
PYTHON_PLATLIB="$("$PORTABLE_PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("platlib"))')"
PYTHON_LIBDIR="$("$PORTABLE_PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_config_var("LIBDIR") or "")')"

RUNTIME_DIR="$PACKAGE_DIR/runtime"
RUNTIME_LIB_DIR="$RUNTIME_DIR/lib"
RUNTIME_SITE_PACKAGES_DIR="$RUNTIME_LIB_DIR/python${PYTHON_VERSION}/site-packages"

mkdir -p "$RUNTIME_DIR/bin" "$RUNTIME_LIB_DIR"
cp -a "$PYTHON_STDLIB" "$RUNTIME_LIB_DIR/python${PYTHON_VERSION}"
ln -sfn lib "$RUNTIME_DIR/lib64"
mkdir -p "$RUNTIME_SITE_PACKAGES_DIR"
cp -a "$PYTHON_PURELIB/." "$RUNTIME_SITE_PACKAGES_DIR/"
if [[ "$PYTHON_PLATLIB" != "$PYTHON_PURELIB" ]]; then
  cp -a "$PYTHON_PLATLIB/." "$RUNTIME_SITE_PACKAGES_DIR/"
fi
cp -L "$PYTHON_REALBIN" "$RUNTIME_DIR/bin/python${PYTHON_VERSION}"
ln -sf "python${PYTHON_VERSION}" "$RUNTIME_DIR/bin/python3"
ln -sf "python${PYTHON_VERSION}" "$RUNTIME_DIR/bin/python"
if [[ -n "$PYTHON_LIBDIR" ]]; then
  cp -a "$PYTHON_LIBDIR"/libpython"${PYTHON_VERSION}"*.so* "$RUNTIME_LIB_DIR/" 2>/dev/null || true
fi

rm -rf \
  "$RUNTIME_SITE_PACKAGES_DIR/pip" \
  "$RUNTIME_SITE_PACKAGES_DIR/pip-"*.dist-info \
  "$RUNTIME_SITE_PACKAGES_DIR/setuptools" \
  "$RUNTIME_SITE_PACKAGES_DIR/setuptools-"*.dist-info \
  "$RUNTIME_SITE_PACKAGES_DIR/wheel" \
  "$RUNTIME_SITE_PACKAGES_DIR/wheel-"*.dist-info \
  "$RUNTIME_SITE_PACKAGES_DIR/__pycache__"

chmod +x "$PACKAGE_DIR/deploy/run.sh"

cat > "$PACKAGE_DIR/VERSION" <<EOF
$VERSION
EOF

cat > "$PACKAGE_DIR/PORTABLE_RUNTIME" <<EOF
portable_python=$PYTHON_REALBIN
python_version=$PYTHON_VERSION
stdlib_path=$PYTHON_STDLIB
purelib_path=$PYTHON_PURELIB
platlib_path=$PYTHON_PLATLIB
EOF

"$PORTABLE_PYTHON_BIN" --version > "$PACKAGE_DIR/PYTHON_VERSION"

tar -C "$DIST_DIR" -czf "$ARCHIVE_PATH" "$PACKAGE_NAME"
echo "Created release archive: $ARCHIVE_PATH"
