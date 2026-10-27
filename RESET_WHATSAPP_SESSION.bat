@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods - Reset WhatsApp Session
color 0E

echo ==============================================================================
echo             ZAMZAM FOODS - RESET WHATSAPP SESSION & RE-LINK
echo ==============================================================================
echo.
echo This script will:
echo  1. Stop any running WhatsApp Bridge background processes.
echo  2. Wipe corrupted/stale WhatsApp session cache (.wwebjs_auth).
echo  3. Generate a fresh QR code with the latest WhatsApp Web version.
echo.
echo Press any key to proceed with reset...
pause >nul

cd /d "%~dp0"

echo [1/3] Stopping WhatsApp Bridge processes & zombie browser locks...
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$connections = Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue;
if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess;
        if ($procId -gt 0) {
            Write-Host ('Stopping process ID: ' + $procId);
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue;
        }
    }
}
$procs = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe' OR Name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' };
if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; }
" >nul 2>&1

wmic process where "(name='chrome.exe' or name='msedge.exe') and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%' or commandline like '%%whatsapp-bridge%%')" call terminate >nul 2>&1

timeout /t 2 /nobreak >nul

echo [2/3] Cleaning stale session data & lockfiles...
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*lock*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*DevToolsActivePort*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*Singleton*" >nul 2>&1

if exist "whatsapp-bridge\.wwebjs_auth" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_auth" >nul 2>&1
    echo   ^>^> Removed .wwebjs_auth folder.
)
if exist "whatsapp-bridge\.wwebjs_cache" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_cache" >nul 2>&1
    echo   ^>^> Removed .wwebjs_cache folder.
)

echo.
echo [3/3] Starting fresh WhatsApp Bridge...
echo A new QR code page will open in your browser in a few seconds.
echo.

call "%~dp0start_whatsapp_bridge.bat"
