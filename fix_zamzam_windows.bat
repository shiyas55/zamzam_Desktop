@echo off
title Zamzam Foods — Quick Fix & Reset
color 0E

echo ==============================================================================
echo             ZAMZAM FOODS — WINDOWS PROCESS & CACHE CLEANUP
echo ==============================================================================
echo.
echo Stopping any frozen processes...
taskkill /f /im "Zamzam Foods.exe" >nul 2>&1
taskkill /f /im "msedgewebview2.exe" >nul 2>&1

echo Clearing stale cache, old Railway settings, and lockfiles...
del /f /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Programs\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1
del /f /q "%LocalAppData%\Zamzam Foods\EBWebView\Default\lockfile" >nul 2>&1
rmdir /s /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Default\Cache" >nul 2>&1
rmdir /s /q "%LocalAppData%\com.zamzamfoods.desktop\EBWebView\Crashpad" >nul 2>&1

echo.
echo [OK] Cleaned up all stale locks!
echo.
echo Launching Zamzam Foods Desktop now...
cd /d "%~dp0"
call "%~dp0start_zamzam_all.bat"
