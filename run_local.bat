@echo off
set "PROJECT_DIR=%~dp0"

start "PDF Editor API" /D "%PROJECT_DIR%backend" cmd /k py -m uvicorn app:app --host 127.0.0.1 --port 8083 --reload
start "PDF Editor Frontend" /D "%PROJECT_DIR%frontend" cmd /k py -m http.server 5500

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5500"
