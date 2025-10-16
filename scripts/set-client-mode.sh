#!/bin/bash

# Script to configure app for CLIENT mode
# Usage: ./scripts/set-client-mode.sh <server-ip>

if [ -z "$1" ]; then
  echo "❌ Error: Server IP required"
  echo "Usage: ./scripts/set-client-mode.sh 192.168.1.100"
  exit 1
fi

SERVER_IP=$1
CONFIG_FILE="$HOME/Library/Application Support/Electron/config.json"

# Create config directory if it doesn't exist
mkdir -p "$HOME/Library/Application Support/Electron"

# Write client mode config
cat > "$CONFIG_FILE" << EOF
{
  "app_mode": "client",
  "server_url": "http://${SERVER_IP}:3000",
  "initialized": true
}
EOF

echo "✅ Client mode configured!"
echo "📡 Server URL: http://${SERVER_IP}:3000"
echo "📁 Config: $CONFIG_FILE"
echo ""
echo "🚀 Now run: npm start"
