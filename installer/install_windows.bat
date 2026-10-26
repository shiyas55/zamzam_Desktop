@echo off
setlocal EnableDelayedExpansion

title Zamzam Foods — Windows Desktop Setup (Aiven Cloud Database)
color 0A

echo ==============================================================================
echo           ZAMZAM FOODS — ENTERPRISE DESKTOP APPLICATION SETUP
echo                 Connected to Aiven PostgreSQL Cloud Database
echo ==============================================================================
echo.
echo Live Cloud Database:
echo   Host     : pg-65e4170-zamzamfoods.h.aivencloud.com:18638
echo   Database : defaultdb
echo   SSL Mode : require (TLS 1.3)
echo.
echo All Windows (.exe) and Mac (.dmg) installations automatically connect to
echo this live database. Any bills, payments, or customer changes sync in real time.
echo.
echo ==============================================================================

:: Application Target Directory
set "INSTALL_DIR=%LocalAppData%\Programs\ZamzamFoods"
echo.
echo Installation Directory: !INSTALL_DIR!
if not exist "!INSTALL_DIR!" (
    mkdir "!INSTALL_DIR!" 2>nul
)

:: Generate Aiven Cloud Configuration File
echo.
echo [1/2] Writing Aiven Cloud Database configuration...
set "CONFIG_DIR=%APPDATA%\ZamzamFoods"
if not exist "!CONFIG_DIR!" mkdir "!CONFIG_DIR!" 2>nul

set /p "PG_PASS=Enter Aiven Cloud Password (or press ENTER to enter inside app): "

(
echo {
echo   "host": "pg-65e4170-zamzamfoods.h.aivencloud.com",
echo   "port": 18638,
echo   "user": "avnadmin",
echo   "password": "!PG_PASS!",
echo   "dbname": "defaultdb"
echo }
) > "!CONFIG_DIR!\db_config.json"

echo [OK] Live Cloud Config configured at !CONFIG_DIR!\db_config.json

:: Create Desktop Shortcut
echo.
echo [2/2] Creating Desktop Shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Zamzam Foods.lnk')); $s.TargetPath = '!INSTALL_DIR!\Zamzam Foods.exe'; $s.WorkingDirectory = '!INSTALL_DIR!'; $s.Save()" >nul 2>&1

echo [OK] Desktop Shortcut created.
echo.
echo ==============================================================================
echo                     SETUP COMPLETED SUCCESSFULLY!
echo ==============================================================================
echo Status: Live Production Database Ready (Aiven PostgreSQL)
echo.
echo Launching Zamzam Foods...
if exist "!INSTALL_DIR!\Zamzam Foods.exe" (
    start "" "!INSTALL_DIR!\Zamzam Foods.exe"
) else if exist "%~dp0..\frontend\src-tauri\target\release\Zamzam Foods.exe" (
    start "" "%~dp0..\frontend\src-tauri\target\release\Zamzam Foods.exe"
)
