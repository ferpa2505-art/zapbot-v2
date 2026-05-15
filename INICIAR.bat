@echo off
chcp 65001 >nul
title ZapBot v2.0
color 0A
echo.
echo  ╔══════════════════════════════════╗
echo  ║   ZapBot v2.0 – Iniciando...    ║
echo  ╚══════════════════════════════════╝
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [ERRO] Node.js nao encontrado!
  echo  Baixe em: https://nodejs.org
  pause & exit /b 1
)
cd /d "%~dp0"
if not exist "node_modules" (
  echo  Instalando dependencias pela primeira vez...
  npm install --legacy-peer-deps
  npm install --save-dev electron@28 --legacy-peer-deps
)
if not exist "node_modules\electron" (
  npm install --save-dev electron@28 --legacy-peer-deps
)
echo  Abrindo ZapBot v2.0...
npm start
