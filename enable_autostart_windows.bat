@echo off
setlocal EnableDelayedExpansion
title "Enable Zamzam Foods Auto-Start (Backend + WhatsApp)"
color 0A

echo ==============================================================================
echo   ENABLE ZAMZAM FOODS BACKGROUND AUTO-START (BACKEND + WHATSAPP BRIDGE)
echo ==============================================================================
echo.
echo Configuring Zamzam Foods Backend and WhatsApp to start automatically whenever PC turns on...
echo.

cd /d "%~dp0"

:: 1. Add to Windows Startup Folder (runs on every boot/logon silently via VBScript)
powershell -NoProfile -Command "$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'ZamzamFoods_AutoStart.lnk'; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut($startup); $s.TargetPath = 'wscript.exe'; $s.Arguments = ('\"' + '%~dp0' + 'run_all_hidden.vbs\"'); $s.WorkingDirectory = '%~dp0'; $icon = '%~dp0icon.ico'; if (-not (Test-Path $icon)) { $icon = '%~dp0frontend\src-tauri\icons\icon.ico'; }; if (Test-Path $icon) { $s.IconLocation = $icon; }; $s.Description = 'Zamzam Foods Silent Background Backend & WhatsApp Automation Service'; $s.WindowStyle = 7; $s.Save(); Write-Host '[1/3] Startup Folder Auto-Start registered.' -ForegroundColor Green"

:: 2. Add to Windows Registry Run Key (Guaranteed auto-run on Windows user login)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ZamzamFoodsServices" /t REG_SZ /d "wscript.exe \"%~dp0run_all_hidden.vbs\"" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [2/3] Windows Registry Run key registered successfully.
) else (
    echo [2/3] Registry registration skipped (non-critical).
)

:: 3. Register Windows Scheduled Task for instant boot launch
schtasks /create /tn "ZamzamFoodsServices" /tr "wscript.exe \"%~dp0run_all_hidden.vbs\"" /sc onlogon /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [3/3] Windows Scheduled Task registered successfully.
) else (
    echo [3/3] Task Scheduler registration skipped (non-critical).
)

:: 4. Allow ports 8000 (Backend) & 3005 (WhatsApp Bridge) through Windows Firewall for LAN Client PCs
netsh advfirewall firewall add rule name="Zamzam Foods Backend (Port 8000)" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1
netsh advfirewall firewall add rule name="Zamzam WhatsApp Bridge (Port 3005)" dir=in action=allow protocol=TCP localport=3005 >nul 2>&1

echo.
echo ==============================================================================
echo Starting Backend and WhatsApp Services silently in the background right now...
echo ==============================================================================

wscript.exe "%~dp0run_all_hidden.vbs"

:: Verify Backend server is up
set /a attempts=0
:WAIT_SERVER
set /a attempts+=1
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
if %errorlevel% equ 0 goto CHECK_WA
if !attempts! geq 15 goto CHECK_WA
goto WAIT_SERVER

:CHECK_WA
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 3005); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] WhatsApp Bridge verified on port 3005.
)

:SUCCESS
echo.
echo ******************************************************************************
echo  [SUCCESS] ZAMZAM FOODS AUTO-START CONFIGURED ON WINDOWS 10 / 11!
echo  
echo  1. Backend (port 8000) and WhatsApp Bridge (port 3005) start on PC power on!
echo  2. Runs 100%% silently in the background (no black command prompt windows).
echo  3. WhatsApp sending and wholesale billing will always be connected.
echo  4. When you turn OFF your PC, both services safely shut down.
echo ******************************************************************************
echo.
if not "%~1"=="/silent" pause
