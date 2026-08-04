@echo off
chcp 65001 >nul
title ZapBot v2.0 – Gerando instalador
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   ZapBot v2.0 – Gerador de .exe         ║
echo  ╚══════════════════════════════════════════╝
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [ERRO] Node.js nao encontrado! Baixe em https://nodejs.org
  pause & exit /b 1
)
cd /d "%~dp0"
echo  Executando gerar-exe.js...
node gerar-exe.js
if %errorlevel% neq 0 (
  echo  [ERRO] Build falhou.
  pause & exit /b 1
)
echo.
echo  Instalador gerado em: dist\
pause
