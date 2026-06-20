@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
title 仓库运营管理系统 - 一键启动

echo.
echo ================================
echo   仓库运营管理系统
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 后再运行。
  echo 下载地址：https://nodejs.org/
  pause
  exit /b 1
)

if not exist package.json (
  echo 当前文件夹没有 package.json。
  echo 请把这个启动文件放在“仓库运营管理系统”项目文件夹里面。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 正在安装依赖，第一次运行需要等待几分钟...
  npm install --cache ".npm-cache"
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查网络或 npm 环境。
    pause
    exit /b 1
  )
)

echo.
echo 正在启动系统...
echo 浏览器稍后会自动打开：http://127.0.0.1:3000
echo 请不要关闭即将打开的服务窗口。
echo.

start "仓库运营管理系统服务" cmd /k "cd /d ""%~dp0"" && npm run dev -- --hostname 127.0.0.1 --port 3000"

timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:3000"

exit /b 0
