@echo off
setlocal EnableDelayedExpansion
title Launch Zamzam Foods
color 0B

cd /d "%~dp0"

:: Auto-pull latest updates from GitHub if git is installed
where git >nul 2>&1
if %errorlevel% equ 0 (
    git pull origin main >nul 2>&1
)

:: Auto-Create or Update Desktop Shortcut to current folder location
powershell -NoProfile -Command "
$desktop = [System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Zamzam Foods.lnk');
$ws = New-Object -ComObject WScript.Shell;
$s = $ws.CreateShortcut($desktop);
$s.TargetPath = '%~dp0start_zamzam_all.bat';
$s.WorkingDirectory = '%~dp0';
$icon = '%~dp0icon.ico';
if (-not (Test-Path $icon)) { $icon = '%~dp0frontend\src-tauri\icons\icon.ico'; }
if (Test-Path $icon) { $s.IconLocation = $icon; }
$s.Description = 'Zamzam Foods Wholesale & Distribution Management';
$s.Save();
" >nul 2>&1

echo ==============================================================================
echo             ZAMZAM FOODS — DESKTOP APPLICATION LAUNCHER
echo ==============================================================================
echo.

:: Clear any stale WebView2 locks and stuck processes
taskkill /f /im "Zamzam Foods.exe" >nul 2>&1
del /f /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Programs\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1

:: Start backend and WhatsApp bridge if not already listening
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Starting Backend & WhatsApp services silently in the background...
    wscript.exe "%~dp0run_all_hidden.vbs"
    
    echo Connecting to database and local engine...
    set /a attempts=0
    :WAIT_LOOP
    set /a attempts+=1
    timeout /t 1 /nobreak >nul
    powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
    if %errorlevel% equ 0 goto BACKEND_UP
    if !attempts! geq 25 goto BACKEND_UP
    goto WAIT_LOOP
) else (
    echo [1/2] Backend engine is already running on port 8000.
)
:BACKEND_UP

:: Ensure WhatsApp Bridge is also running and healthy
powershell -NoProfile -Command "
try {
    $res = Invoke-RestMethod -Uri 'http://localhost:3005/status' -TimeoutSec 2 -ErrorAction Stop;
    if ($res.lastError) {
        Write-Host 'UNHEALTHY';
    } else {
        Write-Host 'HEALTHY';
    }
} catch {
    Write-Host 'DOWN';
}
" 2>nul | findstr "UNHEALTHY" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Detected frozen WhatsApp Bridge. Auto-restarting fresh...
    powershell -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
    timeout /t 1 /nobreak >nul
    wscript.exe "%~dp0run_all_hidden.vbs"
) else (
    echo [INFO] WhatsApp Bridge is active on port 3005.
)

echo.
echo [2/2] Opening Zamzam Foods Desktop Window...

set "APP_OPENED=0"

:: 1. Launch borderless Desktop Window (Edge / Chrome App Mode - standalone desktop window, 0ms local engine connection, no browser URL bar)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    echo Launching Desktop Window: Microsoft Edge Standalone App...
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000/
    set "APP_OPENED=1"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    echo Launching Desktop Window: Microsoft Edge Standalone App...
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000/
    set "APP_OPENED=1"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    echo Launching Desktop Window: Google Chrome Standalone App...
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8000/
    set "APP_OPENED=1"
) else if exist "%LocalAppData%\Programs\Zamzam Foods\Zamzam Foods.exe" (
    echo Launching Native Desktop App...
    start "" "%LocalAppData%\Programs\Zamzam Foods\Zamzam Foods.exe"
    set "APP_OPENED=1"
) else if exist "%ProgramFiles%\Zamzam Foods\Zamzam Foods.exe" (
    echo Launching Native Desktop App...
    start "" "%ProgramFiles%\Zamzam Foods\Zamzam Foods.exe"
    set "APP_OPENED=1"
) else if exist "%~dp0Zamzam Foods.exe" (
    echo Launching Native Desktop App...
    start "" "%~dp0Zamzam Foods.exe"
    set "APP_OPENED=1"
) else (
    echo Opening Zamzam Foods in Default Browser...
    start http://127.0.0.1:8000/
)

timeout /t 2 /nobreak >nul
exit
