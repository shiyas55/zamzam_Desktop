#!/bin/bash
# Zamzam Foods — macOS Disable Auto-Start

BACKEND_PLIST="$HOME/Library/LaunchAgents/com.zamzamfoods.backend.plist"
WHATSAPP_PLIST="$HOME/Library/LaunchAgents/com.zamzamfoods.whatsapp.plist"

echo "Disabling Zamzam Foods Auto-Start on macOS..."

if [ -f "$BACKEND_PLIST" ]; then
    launchctl unload "$BACKEND_PLIST" 2>/dev/null || true
    rm -f "$BACKEND_PLIST"
    echo "✓ Removed com.zamzamfoods.backend LaunchAgent"
fi

if [ -f "$WHATSAPP_PLIST" ]; then
    launchctl unload "$WHATSAPP_PLIST" 2>/dev/null || true
    rm -f "$WHATSAPP_PLIST"
    echo "✓ Removed com.zamzamfoods.whatsapp LaunchAgent"
fi

echo "Auto-start disabled successfully."
