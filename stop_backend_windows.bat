@echo off
setlocal EnableDelayedExpansion
title Stop Zamzam Foods Backend
color 0C

echo ==============================================================================
echo                 STOP ZAMZAM FOODS LOCAL BACKEND SERVER
echo ==============================================================================
echo.

echo Terminating backend process on port 8000...
powershell -NoProfile -Command "
$connections = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue;
if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess;
        if ($procId -gt 0) {
            Write-Host ('Stopping Backend process ID: ' + $procId);
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue;
        }
    }
    Write-Host '[SUCCESS] Backend server stopped.' -ForegroundColor Green;
} else {
    Write-Host '[INFO] Backend server is not running on port 8000.' -ForegroundColor Yellow;
}
"

echo Terminating WhatsApp Bridge on port 3005...
powershell -NoProfile -Command "
$connections = Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue;
if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess;
        if ($procId -gt 0) {
            Write-Host ('Stopping WhatsApp process ID: ' + $procId);
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue;
        }
    }
    Write-Host '[SUCCESS] WhatsApp Bridge stopped.' -ForegroundColor Green;
} else {
    Write-Host '[INFO] WhatsApp Bridge is not running on port 3005.' -ForegroundColor Yellow;
}
"

echo.
pause
