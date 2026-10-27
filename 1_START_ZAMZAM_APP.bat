@echo off
cd /d "%~dp0"

where git >nul 2>&1
if %errorlevel% equ 0 (
    git pull origin main
)

call "%~dp0start_zamzam_all.bat"
