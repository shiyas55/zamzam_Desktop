@echo off
setlocal EnableDelayedExpansion
title "Zamzam Foods - Service Health & WhatsApp Auto-Test"
color 0B

echo ==============================================================================
echo             ZAMZAM FOODS - SYSTEM ^& WHATSAPP HEALTH CHECK
echo ==============================================================================
echo.

cd /d "%~dp0"

:: 1. Check Python installation
echo [1/5] Checking Python Environment...
set "PY_FOUND=0"
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_FOUND=1"
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   ^>^> [OK] %%v detected.
) else (
    py -3 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set "PY_FOUND=1"
        for /f "tokens=*" %%v in ('py -3 --version 2^>^&1') do echo   ^>^> [OK] %%v detected.
    ) else (
        echo   ^>^> [MISSING] Python is not installed. Please install Python 3.12!
    )
)

echo.
:: 2. Check Node.js installation (Windows 10 / 11)
echo [2/5] Checking Node.js Environment (Required for WhatsApp)...
set "NODE_OK=0"
node --version >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_OK=1"
    for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo   ^>^> [OK] Node.js %%v detected in PATH.
) else if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_OK=1"
    for /f "tokens=*" %%v in ('"%ProgramFiles%\nodejs\node.exe" --version 2^>^&1') do echo   ^>^> [OK] Node.js %%v detected at "%ProgramFiles%\nodejs\node.exe".
) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_OK=1"
    for /f "tokens=*" %%v in ('"%ProgramFiles(x86)%\nodejs\node.exe" --version 2^>^&1') do echo   ^>^> [OK] Node.js %%v detected at "%ProgramFiles(x86)%\nodejs\node.exe".
) else (
    echo   ^>^> [MISSING] Node.js is not installed. Please install Node.js from https://nodejs.org!
)

echo.
:: 3. Check Backend on port 8000
echo [3/5] Checking Backend Server (Port 8000)...
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host '  >> [OK] Backend is ACTIVE on http://127.0.0.1:8000' -ForegroundColor Green; $c.Close() } catch { Write-Host '  >> [OFFLINE] Backend is not running on port 8000' -ForegroundColor Red; Write-Host '     Hint: Run \"start_backend_windows.bat\" or \"1_START_ZAMZAM_APP.bat\"' -ForegroundColor Yellow }"

echo.
:: 4. Check WhatsApp Bridge on port 3005
echo [4/5] Checking WhatsApp Automation Bridge (Port 3005)...
powershell -NoProfile -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:3005/status' -TimeoutSec 3; if ($resp.connected) { Write-Host ('  >> [OK] WhatsApp Bridge is CONNECTED! Linked to: ' + $resp.info.phone + ' (' + $resp.info.name + ')') -ForegroundColor Green } elseif ($resp.hasQr) { Write-Host '  >> [ACTION NEEDED] WhatsApp Bridge is running, but QR Code needs to be scanned!' -ForegroundColor Yellow; Write-Host '     Open your browser at: http://localhost:3005/qr' -ForegroundColor Cyan } else { Write-Host '  >> [CONNECTING] WhatsApp Bridge is initializing browser session...' -ForegroundColor Yellow } } catch { Write-Host '  >> [OFFLINE] WhatsApp Bridge is not running on port 3005' -ForegroundColor Red; Write-Host '     Hint: Run \"start_whatsapp_bridge.bat\" or \"2_ENABLE_AUTOSTART_ON_BOOT.bat\"' -ForegroundColor Yellow }"

echo.
:: 5. Check Windows AutoStart Setup
echo [5/5] Checking Windows Auto-Start on PC Power-On...
powershell -NoProfile -Command "$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'ZamzamFoods_AutoStart.lnk'; $reg = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'ZamzamFoodsServices' -ErrorAction SilentlyContinue; if ((Test-Path $startup) -or ($null -ne $reg)) { Write-Host '  >> [OK - AUTOSTART ACTIVE] Zamzam Foods will start Backend + WhatsApp every time PC boots!' -ForegroundColor Green } else { Write-Host '  >> [NOT CONFIGURED] Auto-start is not enabled yet.' -ForegroundColor Yellow; Write-Host '     Double-click \"2_ENABLE_AUTOSTART_ON_BOOT.bat\" to enable.' -ForegroundColor Cyan }"

echo.
echo ==============================================================================
echo                         LIVE WHATSAPP DISPATCH TEST
echo ==============================================================================
echo.
set /p DO_TEST="Would you like to send a LIVE WhatsApp test message right now? (Y/N, default=N): "
if /i "%DO_TEST%"=="Y" (
    echo.
    set /p TEST_NUM="Enter recipient 10-digit mobile number (e.g., 9876543210): "
    if not "!TEST_NUM!"=="" (
        echo Sending test message to !TEST_NUM!...
        powershell -NoProfile -Command "$body = @{ phone = '!TEST_NUM!'; message = 'Zamzam Foods System Test: WhatsApp Automation is active, verified, and working perfectly!' } | ConvertTo-Json; try { $res = Invoke-RestMethod -Uri 'http://localhost:3005/send-text' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 15; if ($res.success) { Write-Host ('  >> [SUCCESS] WhatsApp test message delivered! Message ID: ' + $res.messageId) -ForegroundColor Green } else { Write-Host ('  >> [FAILED] Server returned: ' + $res.error) -ForegroundColor Red } } catch { Write-Host '  >> [ERROR] Could not send test message. Check if WhatsApp is linked.' -ForegroundColor Red }"
    ) else (
        echo No phone number entered. Skipping live message test.
    )
)

echo.
echo ==============================================================================
echo Diagnostic complete. Press any key to exit.
echo ==============================================================================
pause
