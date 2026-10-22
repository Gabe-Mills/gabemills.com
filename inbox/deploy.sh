#!/bin/sh
# One-shot deploy of the website inbox (T731): token -> Worker secret -> Worker -> Mac poller.
# Safe to re-run; it reuses the token in ~/.config/website-inbox/env if one is already there.
set -eu
cd "$(dirname "$0")/.."
[ -f "$HOME/.config/cloudflare/env" ] && . "$HOME/.config/cloudflare/env"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID 2>/dev/null || true

TOKEN=""
[ -f "$HOME/.config/website-inbox/env" ] && TOKEN="$(sed -n 's/^INBOX_TOKEN=//p' "$HOME/.config/website-inbox/env")"
[ -n "$TOKEN" ] || TOKEN="$(openssl rand -hex 32)"

echo "1/3 deploying the inbox Worker"
npx wrangler deploy --config inbox/wrangler.jsonc
echo "2/3 setting INBOX_TOKEN"
printf '%s' "$TOKEN" | npx wrangler secret put INBOX_TOKEN --config inbox/wrangler.jsonc
echo "3/3 installing the Mac poller"
sh inbox/mac/install.sh https://gabemills.com/api/inbox "$TOKEN"
echo "done: forms on gabemills.com now land in ~/Documents/Website Inbox"
