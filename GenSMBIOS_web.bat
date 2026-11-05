@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python 3 tidak ditemukan. Pasang Python 3 terlebih dahulu.
    pause
    exit /b 1
)

python -c "import flask" >nul 2>nul
if errorlevel 1 (
    echo Flask belum terpasang. Jalankan: python -m pip install -r requirements-web.txt
    pause
    exit /b 1
)

python GenSMBIOS_web.py %*
pause
