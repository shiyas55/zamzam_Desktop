#!/usr/bin/env bash
# ==============================================================================
# Zamzam Foods — macOS Application Launcher
# Usage: ./start_zamzam_mac.sh
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=============================================================================="
echo "            ZAMZAM FOODS — APPLICATION LAUNCHER (macOS)"
echo "=============================================================================="
echo ""

# 1. Detect Python
PYTHON_BIN="$PROJECT_DIR/venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"
fi
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

# 2. Start Backend on Port 8000 if not already listening
if lsof -i :8000 >/dev/null 2>&1; then
    echo "[1/3] Backend engine is already active on http://127.0.0.1:8000"
else
    echo "[1/3] Starting Backend Server on http://127.0.0.1:8000..."
    nohup "$PYTHON_BIN" "$PROJECT_DIR/backend/manage.py" runserver 127.0.0.1:8000 --noreload > /dev/null 2>&1 &
    sleep 2
fi

# 3. Start WhatsApp Bridge on Port 3005 if not already listening
if lsof -i :3005 >/dev/null 2>&1; then
    echo "[2/3] WhatsApp Bridge is already active on http://127.0.0.1:3005"
else
    echo "[2/3] Starting WhatsApp Bridge on http://127.0.0.1:3005..."
    if command -v node >/dev/null 2>&1 && [ -d "$PROJECT_DIR/whatsapp-bridge" ]; then
        cd "$PROJECT_DIR/whatsapp-bridge"
        nohup node server.js > /dev/null 2>&1 &
        cd "$PROJECT_DIR"
        sleep 1
    fi
fi

# 4. Open Application in default browser
echo "[3/3] Opening Zamzam Foods UI in your browser..."
open "http://127.0.0.1:8000/"

echo ""
echo "=============================================================================="
echo " Zamzam Foods is running successfully!"
echo " Web UI:     http://127.0.0.1:8000/"
echo " API Docs:   http://127.0.0.1:8000/api/v1/docs/"
echo " WhatsApp:   http://127.0.0.1:3005/qr"
echo "=============================================================================="

