# Owner desk — September 8, 2026

## Implemented

- A compact owner-only workspace: Inbox, Requests, Reviews, Discord.
- Full request text, official updates, title/details/status editing, queue up/down controls.
- Queue order is the owner's triage order, not a manipulation of public votes.
- Visible / Hidden / Trash / All views. Request and review removal is recoverable.
- Reader reviews can be moderated, but their words and star rating cannot be rewritten.
- Existing private support replies, internal notes, public post hide/restore and ticket status remain available.
- Discord channel list, full text/embeds, older messages, bot replies and editing the bot's replies.
- Live Discord access is limited to the configured guild's support channel and Tickets category. The ticket creation panel and unrelated channels are excluded. Channel membership is checked again before every operation. No DM access or permanent Discord deletion endpoint.
- Server-checked owner sessions on every action, conflict detection for edits, audited writes, language filtering, suppressed Discord mentions, bounded payloads and pages.

No new admin was granted. The existing Gabe account was verified as the sole admin with an Apple identity. Apple purchases and complimentary membership were not modified.

## Release state

Migration `20260908000036_owner_desk.sql` is applied to the existing TopBook backend. Its integration tests run in rolled-back transactions, with synthetic accounts/content only.

The support-only Worker is **published** as version `59266fc7-80a3-42d7-b9c1-008e659f1283` on September 8. Wrangler authorization was restored for the existing Gabe Cloudflare account only; unrelated product scopes and accounts were excluded. Existing `SUPABASE_ANON_KEY` was preserved. The Discord bot token has **not** been installed into the Worker.

The actual existing Gabe browser session opened the live owner desk and loaded Inbox, full Requests, and Reviews. Request editing was opened and canceled without changing reader content. Phone-sized rendering (390px viewport) showed no horizontal overflow. This verifies existing app-issued support access, not a new Apple browser OAuth login or live moderation writes.

A local diagnostic parser error included the existing Discord bot credential in private task output. It was not copied to the website, source or deployment. Rotate it through a controlled existing-bot credential update before provisioning the Worker; track T126. Do not repeat its value in any report. The currently running bot was not reset or restarted. The live owner Discord tab correctly says it is not connected yet.

The native app-issued support sign-in link remains supported. Direct browser Apple OAuth is implemented but deliberately disabled by `APPLE_WEB_ENABLED=false`. Production GoTrue currently only accepts the native Apple client ID and has no web redirect allowlist.

## Remaining release gates

1. Completed: account-only Wrangler authorization, production build, 32 tests, dry run, and deployment of only `support/wrangler.jsonc`.
2. Rotate the disclosed TopBook bot credential, coordinate its replacement on the existing bot, then supply the replacement as Worker secret `DISCORD_BOT_TOKEN` using Wrangler stdin. Never put it in Vite vars, source, a URL, logs or browser storage. `SUPABASE_ANON_KEY` remains the existing public key; never substitute service-role. Verify actual reply/edit delivery in a controlled support conversation afterward.
3. Completed: live assets match the local build; public forum/requests work; anonymous, malformed and forged sessions cannot read owner or Discord data; cross-origin and oversized requests fail closed. The real existing owner session opens the desk. A fresh non-owner Apple account and production mutation acceptance remain separate from these HTTP checks and mock/rollback tests.
4. For browser Apple login: create/configure a Sign in with Apple **Services ID grouped with `app.booksearcher.ios`** in the existing Apple team. Add `booksearcher-api.gabemills.com` as the auth domain with the exact Apple return URL `https://booksearcher-api.gabemills.com/auth/v1/callback`.
5. Configure GoTrue's Apple web Services ID first while preserving `app.booksearcher.ios` as an accepted native audience. Generate the Apple web client secret for that Services ID, update its server-only secret, and set the explicit support callback redirect allowlist. The code requests `https://gabemills.com/support/auth/callback?flow=<random hex>`; allow only this callback/query pattern, not arbitrary hosts. Preserve existing native/OAuth settings. This step needs native + web identity regression checks and a controlled auth-service update.
6. Test the real Apple web flow: same owner account grants owner UI; another Apple account does not; cancel, expired flow, wrong-browser callback, replay and role revocation fail safely. Confirm it does not create a second owner profile. Only then enable `APPLE_WEB_ENABLED=true` and redeploy.

Apple setup reference: https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web

## Checks

From the website parent:

```sh
npm run support:build
npm run support:test
wrangler deploy --dry-run --config support/wrangler.jsonc
```

Local interactive fixtures only:

```sh
node support/test/preview-owner.mjs
# http://127.0.0.1:4178/support/desk — clearly labeled local preview
```

The fixture is a loopback-only, in-memory test harness, not an authentication bypass in the production bundle. It never calls Discord or the production database. Restarting clears demo changes.

32 web/worker tests pass. SQL integration checks pass before and after migration deployment. Mobile (390px) and desktop (1280px) were inspected locally; DOM widths showed no horizontal overflow. Local browser interactions covered request editing/status, ordering, trash/restore, review hiding, official update submission, Discord demo reply/edit, and returning to the selected Requests section. The latest test run also emitted Vite test-harness WebSocket port-in-use warnings while a local preview was running; all assertions passed and the deployed Worker has no HMR connection.

Live rollout checks are in the Codex workspace scripts `work/check-owner-assets.mjs` and `work/verify-owner-release.mjs`. They print only check outcomes, never credentials or reader content. Production browser read-only checks confirmed Gabe owner access, request editor cancellation, review loading, and the intentionally disconnected Discord state. No reader content was changed during live acceptance.

Real Discord read-only checks succeeded: one permitted support channel, no currently open ticket channels, no messages in that support channel. Actual delivery/edit acceptance in a real Discord ticket is still a post-deployment gate; no production Discord messages were sent as tests.

Discord uses a retry nonce and disabled repeat-click controls. On uncertain delivery the UI says to refresh Discord before retrying; it does not promise exactly-once delivery across unlimited retries.

## Rollback

If needed, roll back only the support Worker to previous version `603ade19-7010-4d16-9ab4-53702729a3bb`. Leave the additive database migration and data intact; do not drop tables, reset accounts or restart/wipe either protected VM. A long URL is a bookmark, never authorization. There are no browser grant-admin, subscription-transfer or account-delete tools in this release.
