@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Complete Quick Fix & Reset
color 0E

echo ==============================================================================
echo             ZAMZAM FOODS — QUICK FIX & AUTO-RELOAD (WINDOWS)
echo ==============================================================================
echo.
echo [1/4] Stopping frozen Backend (8000), WhatsApp (3005) & headless browsers...

powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = @(8000, 3005);
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue;
    if ($conns) {
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) {
                Write-Host ('Stopping process on port ' + $p + ' (PID ' + $c.OwningProcess + ')');
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue;
            }
        }
    }
}
$procs = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe' OR Name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' };
if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; }
" >nul 2>&1

taskkill /f /im "Zamzam Foods.exe" >nul 2>&1
taskkill /f /im "msedgewebview2.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1
wmic process where "(name='chrome.exe' or name='msedge.exe') and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%' or commandline like '%%whatsapp-bridge%%')" call terminate >nul 2>&1

timeout /t 2 /nobreak >nul

echo [2/4] Pulling latest updates from GitHub...
cd /d "%~dp0"
where git >nul 2>&1
if %errorlevel% equ 0 (
    git pull origin main
    echo   ^>^> Code is up to date with origin/main.
) else (
    echo   ^>^> Git not in PATH, continuing with local reset.
)

echo [3/4] Wiping stale lockfiles and session locks...
del /f /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Programs\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*lock*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*DevToolsActivePort*" >nul 2>&1
del /f /q /s "whatsapp-bridge\.wwebjs_auth\*Singleton*" >nul 2>&1
if exist "whatsapp-bridge\.wwebjs_auth" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_auth" >nul 2>&1
)
if exist "whatsapp-bridge\.wwebjs_cache" (
    rmdir /s /q "whatsapp-bridge\.wwebjs_cache" >nul 2>&1
)

echo [4/4] Launching clean services in the background...
wscript.exe "%~dp0run_all_hidden.vbs"

echo.
echo ==============================================================================
echo [SUCCESS] Everything is fixed and running cleanly!
echo Opening WhatsApp QR page in your browser...
echo ==============================================================================
timeout /t 3 /nobreak >nul
start http://localhost:3005/qr
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8000/
