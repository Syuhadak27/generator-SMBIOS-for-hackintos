# GenSMBIOS Web UI

Tampilan web lokal untuk GenSMBIOS. Semua pembuatan serial, board serial, UUID,
dan ROM tetap dilakukan oleh binary **macserial** yang sudah dipakai versi CLI —
UI web hanya jadi antarmuka yang lebih nyaman.

## Kenapa butuh server kecil?

`macserial` adalah binary native (Mach-O / ELF / PE), bukan JavaScript. HTML
statis murni tidak bisa menjalankannya, jadi `GenSMBIOS_web.py` menyediakan
backend Flask lokal yang memanggil `macserial` lalu mengirim hasilnya sebagai
JSON ke browser.

Artinya:

- Bisa dijalankan lokal di macOS, Linux, Windows, dan Termux/Android.
- Tidak bisa di-upload sebagai situs statis ke GitHub Pages tanpa backend.
- Binary `macserial` yang sudah ada di folder `Scripts/` otomatis dipakai,
  termasuk penanganan folder `noexec` di Android.

## Persiapan

1. Pastikan MacSerial sudah ada. Kalau belum, jalankan versi CLI sekali:

   ```bash
   ./GenSMBIOS.command
   # pilih 1. Install/Update MacSerial
   ```

2. Pasang Flask:

   ```bash
   python3 -m pip install -r requirements-web.txt
   ```

## Menjalankan

macOS / Linux / Termux:

```bash
./GenSMBIOS_web.command
```

Windows:

```bat
GenSMBIOS_web.bat
```

Atau langsung:

```bash
python3 GenSMBIOS_web.py
```

Lalu buka <http://127.0.0.1:8080>.

Opsi lain:

```bash
python3 GenSMBIOS_web.py --port 9000
python3 GenSMBIOS_web.py --host 0.0.0.0   # bisa diakses dari perangkat lain di jaringan
```

> Server ini tidak punya autentikasi. Biarkan `--host 127.0.0.1` (default) kalau
> hanya dipakai di perangkat sendiri. Jangan buka ke internet publik.

## Fitur

- **Generate SMBIOS** — pilih model (ada daftar + pencarian), jumlah 1–20,
  serta additional args `macserial` (mis. `-y 2019`).
- **UUID** dan **ROM** — generate terpisah, ROM bisa memakai prefix Apple dari
  `Scripts/prefix.json`.
- **config.plist** — unggah config.plist OpenCore/Clover, generate SMBIOS, lalu
  tekan **Terapkan ke plist**. Tipe plist dideteksi otomatis, format XML/binary
  dipertahankan, dan hasilnya langsung terunduh. File tidak disimpan di server.
- **Daftar model** — daftar model yang dikenal macserial beserta tahun produksi.

## Struktur

```
GenSMBIOS_web.py       backend Flask + API JSON
GenSMBIOS_web.command  launcher macOS/Linux/Termux
GenSMBIOS_web.bat      launcher Windows
requirements-web.txt   dependensi Python
web/
  index.html           halaman utama
  style.css            tampilan
  app.js               logika frontend
```

## API singkat

| Method | Endpoint            | Fungsi                              |
| ------ | ------------------- | ----------------------------------- |
| GET    | `/api/status`       | status MacSerial + jumlah model     |
| GET    | `/api/models`       | daftar model dan tahun produksi     |
| POST   | `/api/generate`     | generate SMBIOS (`model`, `count`, `args`) |
| POST   | `/api/uuid`         | generate UUID                       |
| POST   | `/api/rom`          | generate ROM (`prefix`)             |
| GET    | `/api/current`      | info SMBIOS sistem (khusus macOS)   |
| POST   | `/api/plist/inspect`| deteksi tipe plist                  |
| POST   | `/api/plist/apply`  | terapkan nilai ke plist, balik file |
