@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Client PC Launcher
color 0B

cd /d "%~dp0"

:: Read saved Server IP/URL if already configured
set "SERVER_URL="
if exist "%LocalAppData%\ZamzamFoods\server_url.txt" (
    set /p SERVER_URL=<"%LocalAppData%\ZamzamFoods\server_url.txt"
)

if "%SERVER_URL%"=="" (
    echo ==============================================================================
    echo             ZAMZAM FOODS — CLIENT PC LAUNCHER (LAN MODE)
    echo ==============================================================================
    echo.
    echo This computer connects to your Main Server PC over your shop WiFi / Network.
    echo.
    echo Please enter the IP Address of your Main Server PC:
    echo (Example: 192.168.1.100  or  192.168.1.50)
    echo.
    set /p "INPUT_IP=Server IP: "
    if "!INPUT_IP!"=="" set "INPUT_IP=127.0.0.1"
    
    :: Format into full URL
    echo !INPUT_IP! | findstr /i "http" >nul
    if !errorlevel! equ 0 (
        set "SERVER_URL=!INPUT_IP!"
    ) else (
        echo !INPUT_IP! | findstr /i ":" >nul
        if !errorlevel! equ 0 (
            set "SERVER_URL=http://!INPUT_IP!"
        ) else (
            set "SERVER_URL=http://!INPUT_IP!:8000"
        )
    )
    
    if not exist "%LocalAppData%\ZamzamFoods" mkdir "%LocalAppData%\ZamzamFoods"
    echo !SERVER_URL! > "%LocalAppData%\ZamzamFoods\server_url.txt"
    echo.
    echo [SAVED] Server URL set to !SERVER_URL!
    timeout /t 1 /nobreak >nul
)

:: Create Desktop Shortcut for easy 1-click launch on Client PC
powershell -NoProfile -Command "
$desktop = [System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Zamzam Foods (Client).lnk');
$ws = New-Object -ComObject WScript.Shell;
$s = $ws.CreateShortcut($desktop);
$s.TargetPath = '%~dp0CONNECT_AS_CLIENT_PC.bat';
$s.WorkingDirectory = '%~dp0';
$icon = '%~dp0icon.ico';
if (-not (Test-Path $icon)) { $icon = '%~dp0frontend\src-tauri\icons\icon.ico'; }
if (Test-Path $icon) { $s.IconLocation = $icon; }
$s.Description = 'Zamzam Foods — Client Terminal';
$s.Save();
" >nul 2>&1

echo Opening Zamzam Foods connected to !SERVER_URL! ...

:: Launch standalone borderless window using Edge or Chrome App Mode
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=!SERVER_URL!
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=!SERVER_URL!
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=!SERVER_URL!
) else (
    start !SERVER_URL!
)

timeout /t 2 /nobreak >nul
exit
