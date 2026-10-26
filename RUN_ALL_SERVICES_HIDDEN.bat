@echo off
cd /d "%~dp0"
echo ==============================================================================
echo   STARTING ZAMZAM FOODS SERVICES SILENTLY IN THE BACKGROUND
echo ==============================================================================
echo.
echo [1/2] Starting Django Backend on port 8000 (0.0.0.0:8000)...
echo [2/2] Starting WhatsApp Automation Bridge on port 3005 (0.0.0.0:3005)...
echo.
wscript.exe "%~dp0run_all_hidden.vbs"
timeout /t 2 /nobreak >nul
echo [SUCCESS] Both services are running invisibly in the background.
echo You can now use Zamzam Foods locally or from Client PCs on your LAN.
echo.
timeout /t 3 /nobreak >nul
exit
