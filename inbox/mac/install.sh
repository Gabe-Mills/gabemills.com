#!/bin/sh
# Installs the website inbox poller on this Mac (T731).
#   ./install.sh <INBOX_URL> <INBOX_TOKEN>
# e.g. ./install.sh https://gabemills.com/api/inbox "$TOKEN"
set -eu
URL="$1"
TOKEN="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
CFG="$HOME/.config/website-inbox"
BIN="$CFG/website_inbox.py"
PLIST="$HOME/Library/LaunchAgents/com.gabemills.website-inbox.plist"

mkdir -p "$CFG" "$HOME/Documents/Website Inbox"
umask 077
printf 'INBOX_URL=%s\nINBOX_TOKEN=%s\n' "$URL" "$TOKEN" > "$CFG/env"
chmod 600 "$CFG/env"
cp "$HERE/website_inbox.py" "$BIN"
chmod 700 "$BIN"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.gabemills.website-inbox</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/python3</string><string>$BIN</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$CFG/inbox.log</string>
  <key>StandardErrorPath</key><string>$CFG/inbox.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed: messages will land in ~/Documents/Website Inbox (log: $CFG/inbox.log)"
