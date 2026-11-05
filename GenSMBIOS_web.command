#!/usr/bin/env bash

# Launcher untuk GenSMBIOS Web UI.
# Jalankan dengan: ./GenSMBIOS_web.command
# Argumen tambahan diteruskan, mis.: --port 9000 --host 0.0.0.0

dir="$(cd -- "$(dirname "$0")" >/dev/null 2>&1; pwd -P)"
cd "$dir" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 tidak ditemukan. Pasang Python 3 terlebih dahulu."
    exit 1
fi

if ! python3 -c "import flask" >/dev/null 2>&1; then
    echo "Flask belum terpasang. Jalankan: python3 -m pip install -r requirements-web.txt"
    exit 1
fi

exec python3 "$dir/GenSMBIOS_web.py" "$@"
