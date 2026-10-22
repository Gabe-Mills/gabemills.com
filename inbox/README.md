# gabemills.com inbox (T731)

The home page's orb (Sherwood) has two forms — **Request one** and **Ask Gabe** — that post to this
Worker. Messages wait in KV until Gabe's Mac pulls them; each becomes a Markdown file in
`~/Documents/Website Inbox` with a macOS notification. A message is deleted only after the Mac has
written its file, so nothing is lost while the Mac is asleep (messages expire after 30 days).

```
browser ──POST /api/inbox──▶ gabemills-inbox Worker ──KV──▶ GET /pull ◀── Mac LaunchAgent (60 s)
                                                           POST /ack ◀──  writes file + notifies
```

Protections: same-origin only, 8 KB body cap, field limits, email check, honeypot field, 5 messages
per IP per 10 minutes. `/pull` and `/ack` need the bearer `INBOX_TOKEN`.

## Local

```sh
printf 'INBOX_TOKEN=dev-local-token-not-secret\n' > inbox/.dev.vars
npx wrangler dev --config inbox/wrangler.jsonc --env dev --port 8803 --ip 127.0.0.1
npm run dev   # vite proxies /api/inbox to :8803
```

## Deploy (once)

```sh
npx wrangler kv namespace create INBOX --config inbox/wrangler.jsonc   # paste the id into wrangler.jsonc
openssl rand -hex 32 | npx wrangler secret put INBOX_TOKEN --config inbox/wrangler.jsonc
npx wrangler deploy --config inbox/wrangler.jsonc
inbox/mac/install.sh https://gabemills.com/api/inbox "<the same token>"
```

The route `gabemills.com/api/inbox*` is more specific than the home site's `gabemills.com/*`, so the
two don't collide. Compatibility date is pinned to 2026-07-08 because that's the newest the local
workerd supports.
