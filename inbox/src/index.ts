/**
 * gabemills.com inbox (T731).
 *
 * The home page's orb collects questions and build requests; they're queued
 * here in KV, and a LaunchAgent on Gabe's Mac pulls them every minute, writes
 * each one to a file and raises a notification. A message is only deleted once
 * the Mac acks it, so nothing is lost while the Mac is asleep.
 *
 *   POST /api/inbox         public: { kind, name, email, topic?, message, website(honeypot) }
 *   GET  /api/inbox/pull    Bearer INBOX_TOKEN: up to 50 queued messages
 *   POST /api/inbox/ack     Bearer INBOX_TOKEN: { ids: string[] } deletes them
 */

export interface Env {
  INBOX: KVNamespace;
  INBOX_TOKEN: string;
  /** comma-separated, e.g. "https://gabemills.com,https://www.gabemills.com" */
  ALLOWED_ORIGINS: string;
}

const KINDS = new Set(["question", "request"]);
const MAX_BODY = 8 * 1024;
const RATE_LIMIT = 5; // per IP
const RATE_WINDOW = 600; // seconds

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");

function authed(req: Request, env: Env) {
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${env.INBOX_TOKEN}`;
  if (!env.INBOX_TOKEN || got.length !== want.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

async function submit(req: Request, env: Env) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  if (!allowed.includes(origin)) return json({ error: "origin" }, 403);
  const cors = { "access-control-allow-origin": origin, vary: "origin" };

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return json({ error: "too_large" }, 413, cors);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413, cors);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_json" }, 400, cors);
  }

  // bots fill every field; people never see this one. Pretend it worked.
  if (clean(body.website, 200)) return json({ ok: true }, 200, cors);

  const kind = clean(body.kind, 20);
  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const topic = clean(body.topic, 40);
  const message = clean(body.message, 2000);
  if (!KINDS.has(kind)) return json({ error: "kind" }, 400, cors);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email" }, 400, cors);
  if (message.length < 3) return json({ error: "message" }, 400, cors);

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const rateKey = `rate:${ip}`;
  const count = Number((await env.INBOX.get(rateKey)) ?? 0);
  if (count >= RATE_LIMIT) return json({ error: "rate" }, 429, cors);
  await env.INBOX.put(rateKey, String(count + 1), { expirationTtl: RATE_WINDOW });

  const at = new Date().toISOString();
  const id = `${at.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const record = { id, at, kind, name, email, topic, message, country: (req as { cf?: { country?: string } }).cf?.country ?? "" };
  // queued for 30 days at most, in case the Mac is gone for a long time
  await env.INBOX.put(`msg:${id}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true }, 200, cors);
}

async function pull(env: Env) {
  const list = await env.INBOX.list({ prefix: "msg:", limit: 50 });
  const items = [];
  for (const k of list.keys) {
    const v = await env.INBOX.get(k.name);
    if (v) items.push(JSON.parse(v));
  }
  return json({ items });
}

async function ack(req: Request, env: Env) {
  let ids: unknown;
  try {
    ids = (await req.json<{ ids?: unknown }>()).ids;
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(ids)) return json({ error: "ids" }, 400);
  const valid = ids.filter((i): i is string => typeof i === "string" && /^[\w-]{10,80}$/.test(i)).slice(0, 100);
  await Promise.all(valid.map((i) => env.INBOX.delete(`msg:${i}`)));
  return json({ ok: true, deleted: valid.length });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/inbox") {
      if (req.method === "OPTIONS") {
        const origin = req.headers.get("origin") ?? "";
        if (!env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin)) return new Response(null, { status: 403 });
        return new Response(null, {
          status: 204,
          headers: { "access-control-allow-origin": origin, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type", vary: "origin" },
        });
      }
      if (req.method === "POST") return submit(req, env);
      return json({ error: "method" }, 405);
    }
    if (pathname === "/api/inbox/pull" || pathname === "/api/inbox/ack") {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      if (pathname === "/api/inbox/pull" && req.method === "GET") return pull(env);
      if (pathname === "/api/inbox/ack" && req.method === "POST") return ack(req, env);
      return json({ error: "method" }, 405);
    }
    return json({ error: "not_found" }, 404);
  },
};
