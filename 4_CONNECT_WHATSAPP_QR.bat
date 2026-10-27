@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Connect WhatsApp QR
color 0A

cd /d "%~dp0"

echo ==============================================================================
echo             ZAMZAM FOODS — CONNECT WHATSAPP WEB QR
echo ==============================================================================
echo.
echo Checking WhatsApp Bridge status on port 3005...

set "BRIDGE_HEALTHY=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "
try {
    $res = Invoke-RestMethod -Uri 'http://localhost:3005/status' -TimeoutSec 3 -ErrorAction Stop;
    if ($res -and (-not $res.lastError)) {
        Write-Host 'HEALTHY';
    } else {
        Write-Host 'UNHEALTHY';
    }
} catch {
    Write-Host 'DOWN';
}
" 2>nul | findstr "HEALTHY" >nul 2>&1
if %errorlevel% equ 0 (
    set "BRIDGE_HEALTHY=1"
)

if "!BRIDGE_HEALTHY!"=="1" (
    echo [OK] WhatsApp Bridge is running and healthy!
    echo Opening WhatsApp QR in your browser...
    start http://localhost:3005/qr
    timeout /t 2 /nobreak >nul
    exit /b 0
)

echo [INFO] WhatsApp Bridge needs a fresh start or lock cleanup.
echo Launching auto-reset now...
call "%~dp0RESET_WHATSAPP_SESSION.bat"
