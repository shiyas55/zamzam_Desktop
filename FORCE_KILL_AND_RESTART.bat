@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Force Kill & Restart All Services
color 0C

echo ==============================================================================
echo             ZAMZAM FOODS — FORCE KILL & RESTART (ALL SERVICES)
echo ==============================================================================
echo.
echo [1/4] Force-killing running node.exe, python.exe, and headless browsers...

taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im "Zamzam Foods.exe" >nul 2>&1
taskkill /f /im msedgewebview2.exe >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = @(8000, 3005);
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue;
    if ($conns) {
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) {
                Write-Host ('Killing PID on port ' + $p + ': ' + $c.OwningProcess);
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue;
            }
        }
    }
}
$procs = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe' OR Name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' };
if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; }
" >nul 2>&1

wmic process where "(name='chrome.exe' or name='msedge.exe') and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%')" call terminate >nul 2>&1

timeout /t 2 /nobreak >nul
echo   ^>^> All frozen processes successfully stopped!
echo.

echo [2/4] Pulling latest code fixes from GitHub...
cd /d "%~dp0"
where git >nul 2>&1
if %errorlevel% equ 0 (
    git pull origin main
) else (
    echo   ^>^> Git not in PATH, continuing with local reset.
)
echo.

echo [3/4] Wiping corrupted session locks and cache...
del /f /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Default\lockfile" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*lock*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*DevToolsActivePort*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*Singleton*" >nul 2>&1
if exist "whatsapp-bridge\.wwebjs_auth" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_auth" >nul 2>&1
    echo   ^>^> Cleared .wwebjs_auth folder.
)
if exist "whatsapp-bridge\.wwebjs_cache" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_cache" >nul 2>&1
    echo   ^>^> Cleared .wwebjs_cache folder.
)
echo.

echo [4/4] Starting fresh background services...
wscript.exe "%~dp0run_all_hidden.vbs"

color 0A
echo.
echo ==============================================================================
echo [SUCCESS] Everything has been killed, cleared, and restarted fresh!
echo Opening WhatsApp QR code in your browser in 3 seconds...
echo ==============================================================================
timeout /t 3 /nobreak >nul
start http://localhost:3005/qr
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8000/
