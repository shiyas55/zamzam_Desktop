#!/usr/bin/env bash
cd "$(dirname "$0")/whatsapp-bridge"

echo "=============================================================================="
echo "            ZAMZAM FOODS - WHATSAPP AUTOMATION BRIDGE (macOS)"
echo "=============================================================================="
echo ""
echo "Starting WhatsApp Bridge on http://localhost:3005 ..."
echo ""
echo "Cleaning up any stale WhatsApp Chrome processes..."
pkill -f "wwebjs_auth" 2>/dev/null || true
sleep 1

node server.js
