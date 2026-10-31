@echo off
chcp 65001 >nul
title 桌宠工具集 · 本地服务
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   没有找到 Node.js。
    echo   本工具需要 Node.js 18 或更新版本：https://nodejs.org/
    echo   装好后重新双击本文件即可。
    echo.
    echo   只想看看界面？直接双击 index.html（只能看，改完要手动下载 YAML）。
    echo.
    pause
    exit /b 1
)

node "%~dp0server.js" %1
if errorlevel 1 (
    echo.
    echo   启动失败。看看上面那行的错误信息。
    pause
)
