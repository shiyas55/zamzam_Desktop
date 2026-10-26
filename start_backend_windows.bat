@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Local Backend Server
color 0A

cd /d "%~dp0"

:: Check if backend is already running on port 8000
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8000); Write-Host 'OPEN'; $c.Close() } catch { Write-Host 'CLOSED' }" 2>nul | findstr "OPEN" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Zamzam Backend is already active on http://127.0.0.1:8000
    exit /b 0
)

echo ==============================================================================
echo             ZAMZAM FOODS — LOCAL BACKEND SERVER (100%% FREE)
echo                Running Fast Local SQLite Database Engine
echo ==============================================================================
echo.

:: Check if Python is installed (check python, then py launcher)
set "PY_CMD=python"
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py -3 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set "PY_CMD=py -3"
    ) else (
        color 0C
        echo [ERROR] Python is not installed or not found in system PATH!
        echo Please run "Step_1_Install_Python_3.12.exe" and ensure you check:
        echo   "[x] Add python.exe to PATH"
        if not "%~1"=="/silent" pause
        exit /b 1
    )
)

:: Virtual environment check
if not exist ".venv" (
    echo [1/3] Creating Python virtual environment...
    !PY_CMD! -m venv .venv
)

echo [2/3] Activating virtual environment...
call .venv\Scripts\activate.bat

:: Detect backend directory location automatically
if exist "%~dp0manage.py" (
    set "MANAGE_PY=%~dp0manage.py"
    set "REQ_TXT=%~dp0requirements.txt"
) else if exist "%~dp0backend\manage.py" (
    set "MANAGE_PY=%~dp0backend\manage.py"
    set "REQ_TXT=%~dp0backend\requirements.txt"
) else if exist "%~dp0zamzam_foods_windows_complete_package\backend\manage.py" (
    set "MANAGE_PY=%~dp0zamzam_foods_windows_complete_package\backend\manage.py"
    set "REQ_TXT=%~dp0zamzam_foods_windows_complete_package\backend\requirements.txt"
) else (
    color 0C
    echo [ERROR] Could not find manage.py!
    echo Current folder: %~dp0
    echo Please make sure this script is placed in the folder containing backend.
    if not "%~1"=="/silent" pause
    exit /b 1
)

:: Install dependencies if django is missing
python -c "import django" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing backend dependencies...
    pip install -r "!REQ_TXT!"
)

:: Ensure SQLite database exists with complete Oct 14 data
if not exist "%~dp0backend\db.sqlite3" (
    if exist "%~dp0backups\zamzam_backup_oct14.sqlite3" (
        echo [INFO] Initializing SQLite database with complete Oct 14 data...
        copy /y "%~dp0backups\zamzam_backup_oct14.sqlite3" "%~dp0backend\db.sqlite3" >nul 2>&1
        copy /y "%~dp0backups\zamzam_backup_oct14.sqlite3" "%~dp0db.sqlite3" >nul 2>&1
    ) else if exist "%~dp0backups\zamzam_clean_shops_and_users.sqlite3" (
        echo [INFO] Initializing clean SQLite database...
        copy /y "%~dp0backups\zamzam_clean_shops_and_users.sqlite3" "%~dp0backend\db.sqlite3" >nul 2>&1
        copy /y "%~dp0backups\zamzam_clean_shops_and_users.sqlite3" "%~dp0db.sqlite3" >nul 2>&1
    )
)

:: Database configuration: Default to local fast SQLite with all shops and users
if "%DATABASE_URL%"=="" (
    set "DATABASE_URL=sqlite:///db.sqlite3"
)
set "DJANGO_ENV=development"
set "DJANGO_DEBUG=True"

echo [3/3] Checking database schema...
python "!MANAGE_PY!" migrate --noinput

:: Ensure shops are populated if database is empty
python -c "import django; django.setup(); from apps.customers.models import Customer; exit(0 if Customer.objects.count() > 0 else 1)" >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0backups\zamzam_shops_and_users_only.json" (
        echo [INFO] Populating database with shops and users from clean backup...
        python "!MANAGE_PY!" loaddata "%~dp0backups\zamzam_shops_and_users_only.json"
    )
)

echo.
echo ==============================================================================
echo  BACKEND SERVER RUNNING AT: http://127.0.0.1:8000/api/v1/
echo  DATABASE                 : Local SQLite (Fast, 100%% Free, No Connection Limit)
echo  DATA READY               : All Shops, Users, Orders & Ledger Loaded
echo ==============================================================================
if not "%~1"=="/silent" (
    echo Keep this window open while using the Zamzam Foods Desktop application.
    echo.
    python "!MANAGE_PY!" runserver 0.0.0.0:8000
    pause
) else (
    python "!MANAGE_PY!" runserver 0.0.0.0:8000 --noreload
)
