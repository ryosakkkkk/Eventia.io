@echo off
chcp 65001 >nul
title Eventia - Servidor
cd /d "%~dp0"
if not exist client\dist\index.html (
  echo Compilando la interfaz por primera vez...
  cd client && call npx vite build && cd ..
)
echo Iniciando Eventia en http://localhost:4000  (cierra esta ventana para detenerlo)
start "" /b cmd /c "timeout /t 4 >nul & start http://localhost:4000"
cd server
node src/index.js
