@echo off
cd /d %~dp0
title Paper Downloader Builder
echo ========================================
echo   Paper Downloader GUI - Build Script
echo ========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [X] Python not found.
    echo     Please install Python first:
    echo     https://www.python.org/downloads/
    echo     IMPORTANT: check "Add python.exe to PATH" on the installer!
    pause
    exit /b 1
)

echo [1/3] Installing dependencies (first run downloads about 40MB)...
python -m pip install --upgrade pip -q
python -m pip install requests pillow pyinstaller -q
if errorlevel 1 (
    echo [X] Dependency install failed. Please check your network.
    pause
    exit /b 1
)

echo [2/3] Building exe... (takes about 3-5 minutes, please wait)
python -m PyInstaller --onefile --console --noconfirm --name PaperDownloader paper_batch_gui.py
if errorlevel 1 (
    echo [X] Build failed. Please screenshot the error and send it to the assistant.
    pause
    exit /b 1
)

echo [3/3] Cleaning up...
rmdir /s /q build 2>nul
del *.spec 2>nul

python -c "import os; s=r'dist\PaperDownloader.exe'; d='dist/\u8bd5\u5377\u4e0b\u8f7d\u5668.exe'; os.path.exists(d) and os.remove(d); os.rename(s, d); print('renamed to Chinese name OK')"

echo.
echo [OK] Build finished!
echo      Output folder: dist
echo      Double-click the exe inside to run. Token is built in.
echo.
pause
