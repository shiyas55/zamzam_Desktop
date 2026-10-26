#!/bin/bash
# Zamzam Foods — macOS Automatic Backend & WhatsApp Bridge Startup on Boot/Login

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_EXEC="$PROJECT_DIR/.venv/bin/python"
MANAGE_PY="$PROJECT_DIR/backend/manage.py"
NODE_EXEC=$(which node)
BACKEND_PLIST="$HOME/Library/LaunchAgents/com.zamzamfoods.backend.plist"
WHATSAPP_PLIST="$HOME/Library/LaunchAgents/com.zamzamfoods.whatsapp.plist"

echo "=================================================="
echo "  Zamzam Foods — Enable Auto-Start on macOS Boot"
echo "=================================================="
echo ""

if [ ! -f "$PYTHON_EXEC" ]; then
    echo "ERROR: Virtual environment not found at $PYTHON_EXEC"
    exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

# Unload previous services if already loaded
launchctl unload "$BACKEND_PLIST" 2>/dev/null || true
launchctl unload "$WHATSAPP_PLIST" 2>/dev/null || true

# 1. Register Backend LaunchAgent (Port 8000)
cat <<EOF > "$BACKEND_PLIST"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zamzamfoods.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_EXEC</string>
        <string>$MANAGE_PY</string>
        <string>runserver</string>
        <string>127.0.0.1:8000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/backend/backend_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/backend/backend_stderr.log</string>
</dict>
</plist>
EOF

# 2. Register WhatsApp Bridge LaunchAgent (Port 3005)
if [ -n "$NODE_EXEC" ] && [ -f "$PROJECT_DIR/whatsapp-bridge/server.js" ]; then
cat <<EOF > "$WHATSAPP_PLIST"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zamzamfoods.whatsapp</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_EXEC</string>
        <string>$PROJECT_DIR/whatsapp-bridge/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR/whatsapp-bridge</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/whatsapp-bridge/bridge_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/whatsapp-bridge/bridge_stderr.log</string>
</dict>
</plist>
EOF
fi

# Load and start services
launchctl load "$BACKEND_PLIST"
if [ -f "$WHATSAPP_PLIST" ]; then
    launchctl load "$WHATSAPP_PLIST"
fi

echo "✓ Registered Backend service (com.zamzamfoods.backend)"
echo "✓ Registered WhatsApp Bridge service (com.zamzamfoods.whatsapp)"
echo ""
echo "Zamzam Foods Backend and WhatsApp Bridge will now AUTOMATICALLY"
echo "start in the background every time your computer turns on or logs in."
echo ""
echo "To disable auto-start anytime, run: ./disable_autostart_mac.sh"
echo "=================================================="
