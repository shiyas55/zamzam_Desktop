@echo off
setlocal EnableDelayedExpansion
title Disable Zamzam Foods Auto-Start
color 0E

echo ==============================================================================
echo              DISABLE ZAMZAM FOODS AUTO-START ON WINDOWS BOOT
echo ==============================================================================
echo.

:: 1. Remove from Startup Folder
powershell -NoProfile -Command "
$startup = [System.IO.Path]::Combine([Environment]::GetFolderPath('Startup'), 'ZamzamFoods_AutoStart.lnk');
if (Test-Path $startup) { Remove-Item $startup -Force; Write-Host '[OK] Removed ZamzamFoods_AutoStart from Startup folder.' -ForegroundColor Green; }
$old = [System.IO.Path]::Combine([Environment]::GetFolderPath('Startup'), 'ZamzamFoods_Backend_AutoStart.lnk');
if (Test-Path $old) { Remove-Item $old -Force; Write-Host '[OK] Removed legacy autostart shortcut.' -ForegroundColor Green; }
$oldApp = [System.IO.Path]::Combine([Environment]::GetFolderPath('Startup'), 'Zamzam Foods.lnk');
if (Test-Path $oldApp) { Remove-Item $oldApp -Force; }
"

:: 2. Remove Registry Run Key
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ZamzamFoodsServices" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ZamzamFoodsBackend" /f >nul 2>&1
echo [OK] Removed from Windows Registry.

:: 3. Remove Scheduled Task
schtasks /delete /tn "ZamzamFoodsServices" /f >nul 2>&1
schtasks /delete /tn "ZamzamFoodsBackend" /f >nul 2>&1
echo [OK] Removed from Windows Scheduled Tasks.

echo.
echo ==============================================================================
echo [SUCCESS] Auto-start disabled. Backend and WhatsApp will not start on boot.
echo ==============================================================================
echo.
if not "%~1"=="/silent" pause
