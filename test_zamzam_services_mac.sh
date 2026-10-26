#!/bin/bash
# Zamzam Foods - Service Health & WhatsApp Auto-Test (macOS)

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=================================================="
echo "    ZAMZAM FOODS — SYSTEM & WHATSAPP HEALTH CHECK"
echo "=================================================="
echo ""

# 1. Check Python
echo "[1/4] Checking Python Environment..."
if [ -f "$PROJECT_DIR/.venv/bin/python" ]; then
    PY_VER=$("$PROJECT_DIR/.venv/bin/python" --version 2>&1)
    echo "  >> [OK] $PY_VER detected in .venv"
else
    echo "  >> [NOTICE] .venv Python not found. Using system python3."
fi

# 2. Check Node
echo ""
echo "[2/4] Checking Node.js Environment..."
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node --version)
    echo "  >> [OK] Node.js $NODE_VER detected."
else
    echo "  >> [MISSING] Node.js is not found in PATH."
fi

# 3. Check Backend on port 8000
echo ""
echo "[3/4] Checking Backend Server (Port 8000)..."
if curl -s -I http://127.0.0.1:8000/api/v1/customers/ | grep -q "HTTP"; then
    echo "  >> [OK] Backend is ACTIVE on http://127.0.0.1:8000"
else
    echo "  >> [OFFLINE] Backend is not responding on port 8000."
fi

# 4. Check WhatsApp Bridge on port 3005
echo ""
echo "[4/4] Checking WhatsApp Automation Bridge (Port 3005)..."
STATUS_JSON=$(curl -s http://localhost:3005/status 2>/dev/null)
if [ -n "$STATUS_JSON" ]; then
    IS_CONN=$(echo "$STATUS_JSON" | grep -o '"connected":true')
    PHONE=$(echo "$STATUS_JSON" | sed -n 's/.*"phone":"\([^"]*\)".*/\1/p')
    NAME=$(echo "$STATUS_JSON" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')

    if [ -n "$IS_CONN" ]; then
        echo "  >> [OK] WhatsApp Bridge is CONNECTED! Linked to: $PHONE ($NAME)"
    else
        echo "  >> [ACTION NEEDED] WhatsApp Bridge is active, but QR scan is required at: http://localhost:3005/qr"
    fi
else
    echo "  >> [OFFLINE] WhatsApp Bridge is not running on port 3005."
fi

echo ""
echo "=================================================="
echo "Test completed."
echo "=================================================="
