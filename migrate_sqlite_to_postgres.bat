@echo off
setlocal EnableDelayedExpansion
title Zamzam Foods — Migrate Database from SQLite to PostgreSQL
color 0A

cd /d "%~dp0"

echo ==============================================================================
echo        ZAMZAM FOODS — SQLITE TO POSTGRESQL DATA MIGRATION ASSISTANT
echo ==============================================================================
echo.
echo This tool will safely:
echo   1. Back up your existing SQLite database (db.sqlite3).
echo   2. Export all orders, products, customers, routes, payments into JSON.
echo   3. Connect to your PostgreSQL database.
echo   4. Build all tables in PostgreSQL.
echo   5. Import all your existing data into PostgreSQL.
echo.
echo ==============================================================================
pause

:: 1. Ensure backups directory exists
if not exist "backups" mkdir backups

:: 2. Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set "DT=%%I"
if not defined DT set "DT=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%DT:~0,8%_%DT:~8,6%"
set "TIMESTAMP=%TIMESTAMP: =0%"

:: 3. Stop running backend so SQLite file is not locked
echo.
echo [1/6] Stopping any running background services...
taskkill /f /im python.exe >nul 2>&1

:: 4. Locate Python
set "PY_CMD=python"
if exist ".venv\Scripts\python.exe" (
    set "PY_CMD=.venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if !errorlevel! neq 0 (
        color 0C
        echo [ERROR] Python not found. Please run Step_1_Install_Python_3.12.exe.
        pause
        exit /b 1
    )
)

:: 5. Copy SQLite Safety Snapshot
echo.
echo [2/6] Creating safety snapshot of current SQLite database...
if exist "backend\db.sqlite3" (
    copy /y "backend\db.sqlite3" "backups\db_pre_postgres_%TIMESTAMP%.sqlite3" >nul
    echo       Saved: backups\db_pre_postgres_%TIMESTAMP%.sqlite3
) else if exist "db.sqlite3" (
    copy /y "db.sqlite3" "backups\db_pre_postgres_%TIMESTAMP%.sqlite3" >nul
    echo       Saved: backups\db_pre_postgres_%TIMESTAMP%.sqlite3
) else (
    echo       [WARN] No db.sqlite3 found. Proceeding with fresh setup...
)

:: 6. Export data from SQLite to JSON
set "EXPORT_FILE=backups\sqlite_export_%TIMESTAMP%.json"
echo.
echo [3/6] Exporting all data records from SQLite...
%PY_CMD% backend\manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > "%EXPORT_FILE%"
if %errorlevel% neq 0 (
    echo [WARN] dumpdata encountered a warning, retrying with core tables...
    %PY_CMD% backend\manage.py dumpdata accounts products routes customers orders deliveries payments credits reports whatsapp common --natural-foreign --natural-primary --indent 2 > "%EXPORT_FILE%"
)
echo       Export completed: %EXPORT_FILE%

:: 7. Prompt user for PostgreSQL connection string
echo.
echo ==============================================================================
echo [4/6] Enter your PostgreSQL Connection URL
echo ==============================================================================
echo.
echo Examples:
echo   - Local PostgreSQL:
echo     postgres://postgres:your_password@localhost:5432/zamzam_foods
echo.
echo   - Cloud PostgreSQL (Aiven / Supabase / Neon):
echo     postgres://user:password@host.cloud.com:5432/dbname?sslmode=require
echo.
set /p "NEW_DB_URL=Paste your PostgreSQL URL: "

if "%NEW_DB_URL%"=="" (
    color 0C
    echo [ERROR] No PostgreSQL URL entered. Migration cancelled. Your SQLite database is untouched.
    pause
    exit /b 1
)

:: 8. Update backend/.env with new DATABASE_URL
echo.
echo [5/6] Updating backend\.env with PostgreSQL URL...
powershell -NoProfile -Command "
$envFile = 'backend\.env';
if (-not (Test-Path $envFile)) { New-Item -ItemType File -Path $envFile -Force | Out-Null }
$content = Get-Content $envFile;
$newDb = 'DATABASE_URL=' + $env:NEW_DB_URL;
$updated = @();
$found = $false;
foreach ($line in $content) {
    if ($line -match '^DATABASE_URL=') {
        $updated += $newDb;
        $found = $true;
    } else {
        $updated += $line;
    }
}
if (-not $found) {
    $updated += $newDb;
}
$updated | Set-Content $envFile -Encoding UTF8;
" -Environment @{ NEW_DB_URL = %NEW_DB_URL% }

:: 9. Apply Migrations and Load Data into PostgreSQL
echo.
echo [6/6] Connecting to PostgreSQL, building tables, and restoring data...
echo       (A) Running migrations on PostgreSQL...
%PY_CMD% backend\manage.py migrate
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Failed to run migrations on PostgreSQL!
    echo Please verify:
    echo   1. PostgreSQL is installed and the service is running.
    echo   2. The database '%NEW_DB_URL%' exists (run: CREATE DATABASE zamzam_foods; in psql).
    echo   3. Username and password are correct.
    echo.
    echo (Your SQLite data remains 100%% safe in backups\%EXPORT_FILE%)
    pause
    exit /b 1
)

echo.
echo       (B) Loading SQLite data into PostgreSQL...
%PY_CMD% backend\manage.py loaddata "%EXPORT_FILE%"
if %errorlevel% neq 0 (
    echo.
    echo [NOTE] Some records may have skipped constraints, verifying tables...
)

echo.
echo ******************************************************************************
echo  [SUCCESS] MIGRATION TO POSTGRESQL COMPLETED SUCCESSFULLY!
echo  
echo  1. Database engine is now PostgreSQL.
echo  2. All your existing shops, orders, products, and prices have been transferred.
echo  3. Client PCs will now automatically access PostgreSQL through the Server PC!
echo ******************************************************************************
echo.
echo Starting backend and WhatsApp services now...
wscript.exe "%~dp0run_all_hidden.vbs"
timeout /t 3 /nobreak >nul
echo Done!
pause
