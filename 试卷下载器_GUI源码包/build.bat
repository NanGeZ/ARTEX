@echo off
chcp 65001 >nul
echo ========================================
echo   试卷下载器 GUI 版 - 一键打包脚本
echo ========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.12
    echo 下载地址: https://www.python.org/downloads/
    echo 安装时务必勾选 "Add Python to PATH"
    pause
    exit /b 1
)

echo [1/3] 安装依赖...
python -m pip install --upgrade pip -q
python -m pip install requests pillow pyinstaller -q
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络
    pause
    exit /b 1
)

echo [2/3] 打包为 exe...
python -m PyInstaller --onefile --console --noconfirm --name 试卷下载器 paper_batch_gui.py
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo [3/3] 清理临时文件...
rmdir /s /q build 2>nul
del *.spec 2>nul

echo.
echo ✅ 打包完成！
echo    输出文件: dist\试卷下载器.exe
echo    文件大小: 约 20MB
echo    使用方式: 双击运行（已内置 token，无需配置）
echo.
pause
