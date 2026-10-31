@echo off
chcp 65001 >nul
title 宠物实验室 · 本地服务器
cd /d "%~dp0"

set PORT=8080

rem 找一个可用的 Python
set "PYEXE="
where py >nul 2>nul && set "PYEXE=py -3"
if not defined PYEXE (
    where python >nul 2>nul && set "PYEXE=python"
)

if not defined PYEXE (
    echo.
    echo   没有找到 Python。
    echo   请安装 Python 3 后重试，或手动运行：
    echo       python -m http.server 8080
    echo.
    pause
    exit /b 1
)

echo.
echo   宠物实验室本地服务器
echo   ------------------------------------------
echo   地址：http://127.0.0.1:%PORT%/index.html
echo   支持在页面里「保存并编译」配置
echo   关闭这个窗口即停止服务
echo.
echo   正在打开浏览器...
start "" "http://127.0.0.1:%PORT%/index.html"

%PYEXE% "%~dp0tools\serve.py" %PORT%
if errorlevel 1 (
    echo.
    echo   启动失败。端口 %PORT% 可能被占用，可以改本文件里的 PORT 值。
    pause
)
