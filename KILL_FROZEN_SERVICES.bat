@echo off
title Force Kill Frozen Node & Python Services
color 0C

echo ==============================================================================
echo             FORCE KILL ALL FROZEN NODE & PYTHON PROCESSES
echo ==============================================================================
echo.
echo Terminating running node.exe and python.exe processes...

taskkill /f /im node.exe
taskkill /f /im python.exe
taskkill /f /im "Zamzam Foods.exe" >nul 2>&1
taskkill /f /im msedgewebview2.exe >nul 2>&1

echo.
echo Terminating any stuck ports (8000, 3005) and orphaned headless browsers...
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = @(8000, 3005);
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue;
    if ($conns) {
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) {
                Write-Host ('Killing PID on port ' + $p + ': ' + $c.OwningProcess);
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue;
            }
        }
    }
}
$procs = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe' OR Name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' };
if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; }
"

wmic process where "(name='chrome.exe' or name='msedge.exe') and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%')" call terminate >nul 2>&1

echo.
echo Cleaning lockfiles...
del /f /q /s "%~dp0whatsapp-bridge\.wwebjs_auth\*lock*" >nul 2>&1
del /f /q /s "%~dp0whatsapp-bridge\.wwebjs_auth\*DevToolsActivePort*" >nul 2>&1
del /f /q /s "%~dp0whatsapp-bridge\.wwebjs_auth\*Singleton*" >nul 2>&1
rmdir /s /q "%~dp0whatsapp-bridge\.wwebjs_auth" >nul 2>&1

color 0A
echo.
echo ==============================================================================
echo [SUCCESS] node.exe and python.exe have been completely stopped!
echo All locks cleared. You can now launch 1_START_ZAMZAM_APP.bat fresh.
echo ==============================================================================
echo.
pause
