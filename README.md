# GenSMBIOS — Generator SMBIOS untuk Hackintosh

Generator SMBIOS berbasis Python yang memakai [macserial](https://github.com/acidanthera/macserial)
dari acidanthera untuk membuat **Serial**, **Board Serial (MLB)**, **SmUUID**, dan
**ROM** yang dibutuhkan OpenCore/Clover. Tersedia dalam dua antarmuka:

- **CLI** — menu interaktif di terminal, bisa langsung menerapkan hasil ke `config.plist`.
- **Web UI** — antarmuka browser lokal dengan pencarian model, generate batch, dan
  upload `config.plist`.

Versi ini dikembangkan dari [GenSMBIOS oleh corpnewt](https://github.com/corpnewt/GenSMBIOS)
dengan tambahan Web UI serta penyesuaian agar bisa berjalan di macOS, Linux,
Windows, dan Termux/Android.

Repo: <https://github.com/Syuhadak27/generator-SMBIOS-for-hackintos>

---

## Fitur

- Generate SMBIOS (Serial, Board Serial, SmUUID) untuk model Mac yang didukung macserial.
- Generate UUID dan ROM terpisah, termasuk opsi prefix Apple dari `Scripts/prefix.json`.
- Generate hingga 20 SMBIOS sekaligus.
- Mendukung additional args macserial, misalnya `-y 2019`.
- Deteksi otomatis tipe `config.plist` (OpenCore/Clover) dan penerapan hasil langsung ke plist.
- Web UI lokal: daftar model + pencarian, generate batch, upload/apply `config.plist`,
  dan unduh hasilnya. File plist tidak disimpan di server.
- Launcher siap pakai untuk macOS/Linux/Termux (`.command`) dan Windows (`.bat`).

---

## Kebutuhan

- Python 3.7 atau lebih baru
- Koneksi internet (hanya saat pertama kali mengunduh macserial)
- Untuk Web UI: Flask (`requirements-web.txt`)

---

## Instalasi

```bash
git clone git@github.com:Syuhadak27/generator-SMBIOS-for-hackintos.git
cd generator-SMBIOS-for-hackintos
chmod +x GenSMBIOS.command GenSMBIOS_web.command
```

Jika belum memakai SSH, gunakan URL HTTPS:

```bash
git clone https://github.com/Syuhadak27/generator-SMBIOS-for-hackintos.git
```

---

## Penggunaan CLI

macOS / Linux / Termux:

```bash
./GenSMBIOS.command
```

Windows:

```bat
GenSMBIOS.bat
```

Atau langsung dengan Python:

```bash
python3 GenSMBIOS.py
```

Menu utama:

```
1. Install/Update MacSerial
2. Select config.plist
3. Generate SMBIOS
4. Generate UUID
5. Generate ROM
6. List Current SMBIOS
7. Generate ROM With SMBIOS
8. Additional Args
Q. Quit
```

Langkah umum:

1. Pilih **1** untuk mengunduh/memperbarui macserial.
2. Pilih **3**, lalu masukkan model dan jumlah, misalnya `iMac18,3 5`.
3. Salin Serial, Board Serial, SmUUID, dan ROM ke `config.plist`,
   atau pilih **2** terlebih dahulu agar hasil bisa diterapkan langsung ke plist.

> Jika folder `Scripts/` tidak bisa mengeksekusi binary (misalnya di Android),
> macserial otomatis disalin ke direktori sementara yang bisa dieksekusi.

---

## Penggunaan Web UI

Pasang Flask:

```bash
python3 -m pip install -r requirements-web.txt
```

Jalankan:

```bash
./GenSMBIOS_web.command          # macOS / Linux / Termux
GenSMBIOS_web.bat                # Windows
```

Lalu buka <http://127.0.0.1:8080>.

Opsi tambahan:

```bash
python3 GenSMBIOS_web.py --port 9000
python3 GenSMBIOS_web.py --host 0.0.0.0   # akses dari perangkat lain di jaringan lokal
```

Penjelasan lengkap ada di [WEBUI.md](WEBUI.md).

> Web UI tidak memiliki autentikasi. Biarkan host default `127.0.0.1` dan jangan
> membukanya ke internet publik.

---

## Struktur Proyek

```
GenSMBIOS.py            CLI utama
GenSMBIOS.command       launcher macOS/Linux/Termux
GenSMBIOS.bat           launcher Windows
GenSMBIOS_web.py        backend Flask + API JSON untuk Web UI
GenSMBIOS_web.command   launcher Web UI (macOS/Linux/Termux)
GenSMBIOS_web.bat       launcher Web UI (Windows)
requirements-web.txt    dependensi Web UI (Flask)
web/                    HTML, CSS, dan JavaScript Web UI
Scripts/                modul Python, prefix ROM, dan binary macserial
WEBUI.md                dokumentasi Web UI
```

---

## Catatan Keamanan

- Serial, MLB, SmUUID, dan ROM adalah identitas perangkat. Jangan membagikan
  `config.plist` hasil generate secara publik.
- `config.plist` dan file backup `config.plist.bak*` sudah dikecualikan lewat
  `.gitignore`.
- Web UI hanya berjalan lokal secara default dan tidak mengunggah plist ke mana pun.

---

## Lisensi dan Kredit

Proyek ini menggunakan lisensi yang sama dengan proyek asalnya — lihat [LICENSE](LICENSE).

- [corpnewt/GenSMBIOS](https://github.com/corpnewt/GenSMBIOS) — proyek asal dan logika CLI.
- [acidanthera/macserial](https://github.com/acidanthera/macserial) — pembuat serial SMBIOS.
- [acidanthera/OpenCorePkg](https://github.com/acidanthera/OpenCorePkg) — sumber update macserial.

Dipakai dengan risiko sendiri. Selalu simpan backup `config.plist` sebelum menerapkan perubahan.
