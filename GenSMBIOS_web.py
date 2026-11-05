#!/usr/bin/env python3
"""GenSMBIOS Web UI.

A small local web frontend for GenSMBIOS.  It reuses the macserial binary
handling from GenSMBIOS.py (including the Android noexec staging) and exposes
the generator over a JSON API.

Usage:
    python3 GenSMBIOS_web.py
    python3 GenSMBIOS_web.py --host 0.0.0.0 --port 8080
"""

import argparse
import base64
import binascii
import io
import os
import re
import subprocess
import sys
import threading
import uuid
from collections import OrderedDict

try:
    from flask import Flask, jsonify, request, send_file, send_from_directory
except ImportError:  # pragma: no cover - handled at startup
    sys.exit("Flask belum terpasang. Jalankan: pip install flask")

_HERE = os.path.dirname(os.path.realpath(__file__))
os.chdir(_HERE)

import GenSMBIOS  # noqa: E402  (needs cwd set first)
from Scripts import plist  # noqa: E402

WEB_DIR = os.path.join(_HERE, "web")
MAX_GENERATE = 20
MODEL_RE = re.compile(r"^[A-Za-z0-9,._+\-]{1,40}$")
ARGS_RE = re.compile(r"^[^\r\n]{0,200}$")


class WebSmbios(GenSMBIOS.Smbios):
    """GenSMBIOS without the startup network call or console prompts."""

    def _get_remote_version(self):
        return None


macserial = WebSmbios()
_binary_lock = threading.Lock()
_binary_cache = None
_models_cache = None


def _run(args, timeout=20):
    try:
        p = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except FileNotFoundError:
        return None, "MacSerial binary not found", 127
    except subprocess.TimeoutExpired:
        return None, "MacSerial timed out", 124
    out = p.stdout.decode("utf-8", "replace")
    err = p.stderr.decode("utf-8", "replace")
    return out, err, p.returncode


def get_binary(refresh=False):
    global _binary_cache
    with _binary_lock:
        if refresh or not _binary_cache or not os.path.exists(_binary_cache):
            _binary_cache = macserial._get_binary()
        return _binary_cache


def get_version():
    binary = get_binary()
    if not binary:
        return None
    out, _, _ = _run([binary], timeout=10)
    if not out:
        return None
    for line in out.splitlines():
        if not line.lower().startswith("version"):
            continue
        for token in line.lower().strip().split():
            if token and token[0] in "0123456789":
                return token[:-1] if token.endswith(".") else token
    return None


def get_models(refresh=False):
    global _models_cache
    if _models_cache is not None and not refresh:
        return _models_cache
    binary = get_binary()
    if not binary:
        return []
    out, _, code = _run([binary, "-l"], timeout=30)
    if code != 0 or not out:
        return []
    models = []
    current = None
    for line in out.splitlines():
        m = re.match(r"^\s*Model:\s*(\S+)\s*$", line)
        if m:
            current = {"model": m.group(1), "years": ""}
            models.append(current)
            continue
        m = re.match(r"^\s*Prod years:\s*(.*?)\s*$", line)
        if m and current is not None:
            current["years"] = m.group(1)
    _models_cache = models
    return _models_cache


def get_rom(use_prefix=True):
    value = "{:x}".format(GenSMBIOS.randbits(8 * 6)).upper().rjust(12, "0")
    if use_prefix and macserial.rom_prefixes:
        prefix = GenSMBIOS.choice(macserial.rom_prefixes)
        if isinstance(prefix, str):
            value = prefix + value[len(prefix):]
    return value


def parse_entries(model, out, count):
    entries = []
    for line in (out or "").splitlines():
        line = line.strip()
        if "|" not in line:
            continue
        parts = [part.strip() for part in line.split("|")]
        # -a prefixes each line with the model, -m/-n only returns serial|board.
        if len(parts) >= 3 and parts[0].lower() == model.lower():
            entry_model, serial, board_serial = parts[0], parts[1], parts[2]
        elif len(parts) == 2:
            entry_model, serial, board_serial = model, parts[0], parts[1]
        else:
            continue
        entries.append(
            {
                "model": entry_model,
                "serial": serial,
                "board_serial": board_serial,
                "uuid": str(uuid.uuid4()).upper(),
                "rom": get_rom(macserial.gen_rom),
            }
        )
        if len(entries) >= count:
            break
    return entries


app = Flask(__name__, static_folder=WEB_DIR, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


@app.get("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@app.get("/api/status")
def api_status():
    binary = get_binary()
    version = get_version()
    models = get_models() if binary else []
    return jsonify(
        {
            "ok": bool(binary),
            "platform": sys.platform,
            "macserial": os.path.basename(binary) if binary else None,
            "version": version,
            "models": len(models),
        }
    )


@app.get("/api/models")
def api_models():
    return jsonify({"ok": True, "models": get_models(refresh=request.args.get("refresh") == "1")})


@app.post("/api/generate")
def api_generate():
    data = request.get_json(silent=True) or {}
    model = str(data.get("model", "")).strip()
    args = str(data.get("args", "")).strip()
    try:
        count = int(data.get("count", 1))
    except (TypeError, ValueError):
        count = 1
    count = max(1, min(MAX_GENERATE, count))

    if not MODEL_RE.match(model):
        return jsonify({"ok": False, "error": "Nama model tidak valid."}), 400
    if not ARGS_RE.match(args):
        return jsonify({"ok": False, "error": "Additional args tidak valid."}), 400

    binary = get_binary()
    if not binary:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "MacSerial tidak ditemukan. Jalankan GenSMBIOS.py lalu pilih menu 1 "
                    "(Install/Update MacSerial) terlebih dahulu.",
                }
            ),
            503,
        )

    cmd = [binary, "-m", model, "-n", str(count)]
    if args:
        import shlex

        cmd.extend(shlex.split(args))

    out, err, code = _run(cmd)
    if code != 0:
        message = (err or out or "").strip() or "MacSerial mengembalikan error."
        return jsonify({"ok": False, "error": message}), 400

    entries = parse_entries(model, out, count)
    if not entries:
        return jsonify({"ok": False, "error": "{} tidak dihasilkan oleh macserial.".format(model)}), 400

    return jsonify({"ok": True, "version": get_version(), "entries": entries})


@app.post("/api/uuid")
def api_uuid():
    return jsonify({"ok": True, "uuid": str(uuid.uuid4()).upper()})


@app.post("/api/rom")
def api_rom():
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "rom": get_rom(bool(data.get("prefix", True)))})


@app.get("/api/current")
def api_current():
    binary = get_binary()
    if not binary:
        return jsonify({"ok": False, "error": "MacSerial tidak ditemukan."}), 503
    out, err, code = _run([binary], timeout=10)
    lines = [
        line
        for line in (out or "").splitlines()
        if line and not line.lower().startswith("version")
    ]
    return jsonify(
        {
            "ok": True,
            "output": "\n".join(lines),
            "note": ""
            if lines
            else "Tidak ada data. macserial membaca IODeviceTree, jadi ini hanya bisa "
            "dilakukan di macOS.",
        }
    )


def _apply_values(data, values, plist_type):
    product = values["model"]
    serial = values["serial"]
    board_serial = values["board_serial"]
    system_uuid = values["uuid"]
    rom = values.get("rom")
    rom_bytes = binascii.unhexlify(rom.encode("utf-8")) if rom else None

    if plist_type == "opencore":
        platform = data.setdefault("PlatformInfo", {})
        generic = platform.setdefault("Generic", {})
        generic["SystemProductName"] = product
        generic["SystemSerialNumber"] = serial
        generic["MLB"] = board_serial
        generic["SystemUUID"] = system_uuid
        if rom_bytes is not None:
            generic["ROM"] = rom_bytes
    else:
        smbios = data.setdefault("SMBIOS", {})
        rt = data.setdefault("RtVariables", {})
        sp = data.setdefault("SystemParameters", {})
        smbios["ProductName"] = product
        smbios["SerialNumber"] = serial
        smbios["BoardSerialNumber"] = board_serial
        smbios["SmUUID"] = system_uuid
        rt["MLB"] = board_serial
        if rom_bytes is not None:
            rt["ROM"] = rom_bytes
        sp["InjectSystemID"] = True

    return data


@app.post("/api/plist/apply")
def api_plist_apply():
    data = request.get_json(silent=True) or {}
    filename = os.path.basename(str(data.get("filename", "")) or "config.plist")
    content = str(data.get("content", ""))
    values = data.get("values") or {}
    requested_type = str(data.get("type", "auto")).lower()

    required = ("model", "serial", "board_serial", "uuid")
    if any(not values.get(key) or not isinstance(values.get(key), str) for key in required):
        return jsonify({"ok": False, "error": "Data SMBIOS tidak lengkap."}), 400

    rom = values.get("rom") or ""
    if rom and (not isinstance(rom, str) or not re.fullmatch(r"[0-9A-Fa-f]{12}", rom)):
        return jsonify({"ok": False, "error": "Nilai ROM tidak valid."}), 400

    try:
        raw = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError):
        return jsonify({"ok": False, "error": "File plist tidak valid."}), 400

    try:
        parsed = plist.load(io.BytesIO(raw), dict_type=OrderedDict)
    except Exception as exc:  # noqa: BLE001 - surfaced to the user
        return jsonify({"ok": False, "error": "Plist tidak bisa dibaca: {}".format(exc)}), 400
    if not isinstance(parsed, dict):
        return jsonify({"ok": False, "error": "Struktur plist tidak dikenali."}), 400

    if requested_type in ("clover", "opencore"):
        plist_type = requested_type
    else:
        plist_type = (
            "opencore"
            if isinstance(parsed, dict) and "PlatformInfo" in parsed
            else "clover"
            if isinstance(parsed, dict) and "SMBIOS" in parsed
            else ""
        )
    if not plist_type:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "Tipe plist tidak terdeteksi. Pilih OpenCore atau Clover secara manual.",
                }
            ),
            400,
        )

    _apply_values(parsed, values, plist_type)

    fmt = plist.FMT_BINARY if raw[:8] == b"bplist00" else plist.FMT_XML
    output = io.BytesIO()
    try:
        plist.dump(parsed, output, fmt=fmt, sort_keys=False)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": "Gagal menulis plist: {}".format(exc)}), 500

    output.seek(0)
    download_name = filename if filename.lower().endswith(".plist") else filename + ".plist"
    return send_file(
        output,
        mimetype="application/xml" if fmt == plist.FMT_XML else "application/octet-stream",
        as_attachment=True,
        download_name=download_name,
    )


@app.post("/api/plist/inspect")
def api_plist_inspect():
    # Convenience endpoint: the frontend can send the file as raw body to have
    # the type detected without uploading anything to disk.
    raw = request.get_data(cache=False)
    if not raw:
        return jsonify({"ok": False, "error": "File kosong."}), 400
    try:
        parsed = plist.load(io.BytesIO(raw), dict_type=OrderedDict)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": "Plist tidak bisa dibaca: {}".format(exc)}), 400
    plist_type = (
        "opencore"
        if isinstance(parsed, dict) and "PlatformInfo" in parsed
        else "clover"
        if isinstance(parsed, dict) and "SMBIOS" in parsed
        else ""
    )
    return jsonify({"ok": True, "type": plist_type, "binary": raw[:8] == b"bplist00"})


def main():
    parser = argparse.ArgumentParser(description="GenSMBIOS Web UI")
    parser.add_argument("--host", default="127.0.0.1", help="bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="port (default: 8080)")
    parser.add_argument("--debug", action="store_true", help="enable Flask debug mode")
    options = parser.parse_args()

    print("GenSMBIOS Web UI")
    print("  MacSerial: {}".format(get_binary() or "tidak ditemukan"))
    print("  Buka:      http://{}:{}".format(options.host, options.port))
    print("  Hentikan:  Ctrl+C")
    print("")
    app.run(host=options.host, port=options.port, debug=options.debug, threaded=True)


if __name__ == "__main__":
    main()
