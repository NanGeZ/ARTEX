@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   打包试卷下载器为 exe
echo ============================================
where python >nul 2>nul
if errorlevel 1 (
    echo [x] 没有检测到 Python, 请先安装:
    echo     https://www.python.org/downloads/
    echo     安装时务必勾选 "Add Python to PATH"
    pause
    exit /b 1
)
echo [1/3] 安装依赖 (requests / pillow / pyinstaller)...
python -m pip install --upgrade pip -q
python -m pip install -q requests pillow pyinstaller
if errorlevel 1 (
    echo [x] 依赖安装失败, 检查网络后重试
    pause
    exit /b 1
)
echo [2/3] 开始打包 (约 1-2 分钟)...
python -m PyInstaller --onefile --console --noconfirm --name paper_batch paper_batch_pc.py
if errorlevel 1 (
    echo [x] 打包失败, 把上面的报错截图发给助手
    pause
    exit /b 1
)
echo [3/3] 完成!
echo    exe 位置: dist\paper_batch.exe
echo    可以把它复制到任意文件夹双击使用
echo    (首次运行会提示粘贴 token, 保存在同目录 token.txt)
pause
