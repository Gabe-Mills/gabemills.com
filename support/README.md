# TopBook support — operations

For the September 8 owner workspace implementation, current verification and remaining deployment/Apple-login gates, see [OWNER_DESK.md](OWNER_DESK.md). Older release notes below describe the prior deployed website.

Live: https://gabemills.com/support

Owner bookmark: https://gabemills.com/support/desk/gabe-7bc3eaf46d524812a9f08163e25c07bd

The bookmark is not a credential. The server verifies the signed-in account's `app_admins` role on every request. Public help/forum/Requests are readable without sign-in. Private tickets are readable by their owner and support admins only. Staff notes are never returned to ordinary readers. A private ticket cannot be converted to a public post.

## Sign in and operate

Use TopBook build 12: You → Help & support → **Open help center** (called **Open support** in builds 10–11). Open **Use another device → Copy private sign-in link** for a Mac, then paste it into your own browser within five minutes. (Build 10 calls this **Use support on another device**.) It works once; never send it to another person. The browser session lasts seven days. Sign out revokes that session; deleting the TopBook account removes its sessions and support conversations. Being signed into Apple in Safari alone does not authenticate this website.

Gabe's existing verified TopBook account is the only support admin assigned by this change. Owner TopBook+ is an independent complimentary grant in `account_benefits`; it does not transfer, renew, or cancel an Apple purchase. Use authorized database administration to revoke this benefit or admin role; neither is writable from the browser or app.

The admin desk shows public posts and private tickets with scope labels. Open a conversation to reply, save a **Staff-only note**, or move status (Open, In progress, Waiting for you, Resolved). Readers can reopen their private conversation by replying. Public posts can be reported by readers and hidden/restored by admins. Requests & ideas uses the existing native app board, not a second database: admins can comment and move requests to Open, Planned, In progress, or Shipped. Creating ideas and voting remain in the app.

The automated helper uses prepared answers locally in the browser; it does not call an AI provider, receive private conversation history, or incur AI charges. “Talk to a human” opens a private message composer. Human replies are asynchronous. There is no email, push, or real-time notification service: refresh the inbox or check the conversation for replies. No 24-hour response promise is made.

The September 3 presentation refresh uses four icon-and-label tabs: Help, Community, Messages and Ideas. Private human support is a filled button; the public community is a separate outlined button. Only server-verified admins see their name with **Admin** and the **Admin inbox** button in the owner toolbar. Other readers see their name in the header. The same stable admin bookmark still opens the inbox; the HTML shell is public but private data and actions require authorization. No auth, data or billing rules changed. Role revocation is checked on every API request even if a browser still has an old page open.

## Run and deploy

From the parent website directory:

```sh
npm run support:test
npm run support:build
npm run support:dev
```

The Vite preview renders the UI. Authenticated API workflows require the Worker and production backend, or a separately configured staging backend; the plain Vite dev server is not a fake persisted backend.

Production deployment uses the existing Cloudflare account/zone:

```sh
env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN wrangler whoami
env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN wrangler deploy --config support/wrangler.jsonc
```

The saved environment API token was invalid; Wrangler's existing OAuth login works when that override is removed. Do not print or replace credentials unnecessarily.

`wrangler.jsonc` records non-secret `SITE_ORIGIN`, `SUPABASE_URL`, account, assets and the two `/support*` routes. Provision `SUPABASE_ANON_KEY` through `wrangler secret put` on stdin (the public anon key, **never** service-role). No private key belongs in Vite assets. The Worker is restricted to support routes and preserves the original Pages homepage. `www` support visits redirect to the apex origin.

Backend source lives in `/Users/gabemills/.cursor/TopBook/backend/supabase/`:

- Migration 24: support schema, single-use sign-in, scoped sessions, forum/private/admin/Requests RPC.
- Migration 25: account benefits and read-own owner-access RPC.
- Migration 26: fixes an ambiguous SQL column in the website Requests listing; anonymous/admin listing now has explicit regression assertions.
- `tests/support_portal.sql`: transactional integration tests; always run inside BEGIN/ROLLBACK so synthetic users and messages do not survive.
- `functions/legal/index.ts`: deployed privacy/support disclosures.

These migrations are additive on the existing protected TopBook Supabase VM. No new VM, account reset, Apple purchase mutation, or service plan upgrade was performed.

## Security boundaries

- App JWT is used only to mint a five-minute code; it is not put in a web URL. Codes and seven-day session tokens are random 256-bit values, stored only as SHA-256 digests in the database.
- Sign-in code uses the URL fragment, is removed before exchange, and is single-use. Session cookie is Secure, HttpOnly, SameSite=Strict, Path=/support. Browser local/session storage is not used for credentials.
- BFF requires exact same-origin JSON POST, limits streamed request bodies to 20 KB, sanitizes infrastructure errors, and ignores client-supplied account/session identity. Database authorization remains enforced even if callers bypass the BFF.
- Direct client access to support tables is revoked with RLS enabled. Security-definer functions use explicit search paths and authorize owner/admin server-side. Existing Requests functions re-check the validated session user.
- Create/reply limits and idempotency prevent ordinary duplicate submissions. Public lists use bounded pagination. Public text is React-escaped; no HTML injection or third-party scripts are enabled.
- CSP, no-store, no-referrer, frame blocking, and permission restrictions apply. Worker observability is disabled to avoid application payload logging. Cloudflare infrastructure metadata may still be processed as disclosed.
- Root website and support share an origin. Keep the root website and its scripts trusted; path isolation is not a substitute for separate-origin security.

This is not a SOC 2 attestation, independent penetration test, or proof of 10,000 concurrent users. Monitor latency/error rates and capacity before expanding traffic. The existing database backup policy is unchanged; a backup-restore drill was not performed for this release.

## Verification and recovery

Worker suite checks CSRF, methods/content type, body bounds, token handling, spoofed identity, logout, error redaction, headers, and the asset canonicalization redirect regression. Database tests cover actual persistence, one-use login/replay, owner/admin isolation, internal note privacy, moderation, Requests integration, duplicate retry, rate limiting, revocation and deletion.

The live smoke test creates one explicitly labeled private QA ticket on Gabe's account, replies, adds a staff note, resolves it, then reloads to verify persistence. It also creates a labeled public QA discussion and hides it through the moderation UI after checking delivery. Retain these as QA evidence; neither contains customer information.

For a bad deployment: inspect `wrangler deployments list --config support/wrangler.jsonc`, then use Wrangler rollback to the last verified version. Do not roll back the first working release to an empty bootstrap Worker. For initial-release failure, deploy a minimal maintenance response on these exact routes while repairing it. Keep database data and additive schemas intact; do not drop or reset them to roll back the website. Never terminate or wipe the protected TopBook VM. Keep native build 9 available as the previous TestFlight build.

Release artifacts and exact test/deployment IDs are under `/Users/gabemills/Documents/Codex/2026-08-28/files-pasted-by-the-user-you/outputs/topbook-support/` and `outputs/topbook-testflight-build-10/`.
