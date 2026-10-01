@echo off
chcp 65001 >nul
title ICE CRM - iniciar
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^) e rode este arquivo de novo.
  pause & exit /b 1
)
if not exist ".env.local" (
  echo Falta o arquivo .env.local. Copie .env.example para .env.local e preencha as chaves do Supabase.
  pause & exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias ^(so na primeira vez^)...
  call npm install
)
echo Abrindo em http://localhost:3000
start "" http://localhost:3000
call npm run dev
pause
