@echo off
chcp 65001 >nul
title Eventia - Instalacion
cd /d "%~dp0"

echo === 1/4 Creando la base de datos EventiaDB (si no existe) ===
sqlcmd -S ".\SQLEXPRESS01" -E -C -Q "SET NOCOUNT ON; IF DB_ID('EventiaDB') IS NULL PRINT 'CREAR'" -h -1 | findstr CREAR >nul
if %errorlevel%==0 (
  sqlcmd -S ".\SQLEXPRESS01" -E -C -f 65001 -b -i "database\01_schema.sql" >nul || goto :error
  echo Base de datos creada.
) else (
  echo La base EventiaDB ya existe; se conserva.
)

echo === 2/4 Instalando dependencias del servidor ===
cd server
call npm install || goto :error
if not exist .env copy .env.example .env >nul

echo === 3/4 Cargando administrador y datos de demostracion ===
call npm run seed || goto :error
cd ..

echo === 4/4 Instalando y compilando la interfaz ===
cd client
call npm install || goto :error
call npx vite build || goto :error
cd ..

echo.
echo Instalacion completa. Ejecuta iniciar.bat para abrir Eventia.
pause
exit /b 0

:error
echo.
echo Ocurrio un error durante la instalacion. Revisa los mensajes anteriores.
pause
exit /b 1
