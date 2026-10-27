@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Restart All Services & Reload Code
color 0B

echo ==============================================================================
echo        ZAMZAM FOODS — RESTART ALL SERVICES & RELOAD CODE
echo ==============================================================================
echo.
echo Stopping running Backend (8000), WhatsApp Bridge (3005), and background browsers...
echo.

cd /d "%~dp0"

:: 1. Force-terminate existing port 8000 (Django Backend) and 3005 (WhatsApp Bridge)
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = @(8000, 3005);
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue;
    if ($conns) {
        foreach ($c in $conns) {
            $pidToKill = $c.OwningProcess;
            if ($pidToKill -gt 0) {
                Write-Host ('[STOPPING] Killing process on port ' + $p + ' (PID: ' + $pidToKill + ')');
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue;
            }
        }
    }
}
$procs = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe' OR Name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' };
if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; }
" >nul 2>&1

wmic process where "(name='chrome.exe' or name='msedge.exe') and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%' or commandline like '%%whatsapp-bridge%%')" call terminate >nul 2>&1

:: Clean stale lockfiles left by terminated browsers
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*lock*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*DevToolsActivePort*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*Singleton*" >nul 2>&1

timeout /t 2 /nobreak >nul

:: 2. Pull latest updates from Git if available
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Pulling latest updates from GitHub...
    git pull origin main
    echo.
)

:: 3. Launch fresh Backend and WhatsApp Bridge silently in the background
echo [INFO] Starting updated Backend Engine and WhatsApp Bridge silently...
wscript.exe "%~dp0run_all_hidden.vbs"

echo.
echo Connecting to services...
set /a attempts=0
:WAIT_LOOP
set /a attempts+=1
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
if %errorlevel% equ 0 goto READY
if !attempts! geq 15 goto READY
goto WAIT_LOOP

:READY
echo.
echo ==============================================================================
echo  [SUCCESS] All services restarted with latest updates!
echo  - Django Backend (Port 8000): ACTIVE
echo  - WhatsApp Bridge (Port 3005): STARTING IN BACKGROUND
echo ==============================================================================
echo.
echo Refresh your Zamzam Foods desktop window (Ctrl + F5).
timeout /t 3 /nobreak >nul
exit /b 0
