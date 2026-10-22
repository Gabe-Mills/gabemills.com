#!/usr/bin/env python3
"""Pulls gabemills.com inbox messages onto this Mac (T731).

Run every minute by the LaunchAgent com.gabemills.website-inbox. Each message
becomes a Markdown file in ~/Documents/Website Inbox and a notification; it is
acked (deleted from the server) only after its file is on disk.

Config: ~/.config/website-inbox/env with INBOX_URL and INBOX_TOKEN.
Standard library only, so it runs on the system python3.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

ENV = Path.home() / ".config" / "website-inbox" / "env"
OUT = Path.home() / "Documents" / "Website Inbox"


def load_env():
    cfg = {}
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"')
    return cfg


def call(url, token, data=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"authorization": f"Bearer {token}", "content-type": "application/json", "user-agent": "website-inbox/1"},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def safe(s, n=40):
    return re.sub(r"[^\w .@-]+", "", s or "").strip()[:n] or "someone"


def write(item):
    OUT.mkdir(parents=True, exist_ok=True)
    when = datetime.fromisoformat(item["at"].replace("Z", "+00:00")).astimezone()
    kind = "Question" if item["kind"] == "question" else "Request"
    path = OUT / f"{when:%Y-%m-%d %H.%M} {kind} - {safe(item.get('name'))}.md"
    if path.exists():
        path = path.with_name(f"{path.stem} {item['id'][-8:]}.md")
    lines = [
        f"# {kind} from {item.get('name') or 'someone'}",
        "",
        f"- **When:** {when:%a %b %-d, %Y at %-I:%M %p}",
        f"- **Email:** {item.get('email', '')}",
    ]
    if item.get("topic"):
        lines.append(f"- **What:** {item['topic']}")
    if item.get("country"):
        lines.append(f"- **From:** {item['country']}")
    lines += ["", item.get("message", ""), "", f"<!-- id {item['id']} -->", ""]
    path.write_text("\n".join(lines))
    return path, kind


def notify(kind, item, path):
    title = f"gabemills.com — new {kind.lower()}"
    msg = f"{item.get('name') or 'Someone'}: {item.get('message', '')[:120]}"
    script = (
        f"display notification {json.dumps(msg)} with title {json.dumps(title)} sound name \"Glass\""
    )
    subprocess.run(["osascript", "-e", script], check=False, capture_output=True)


def main():
    cfg = load_env()
    base = cfg["INBOX_URL"].rstrip("/")
    token = cfg["INBOX_TOKEN"]
    items = call(f"{base}/pull", token).get("items", [])
    done = []
    for item in items:
        try:
            path, kind = write(item)
        except Exception as e:  # keep it on the server; try again next minute
            print(f"could not write {item.get('id')}: {e}", file=sys.stderr)
            continue
        notify(kind, item, path)
        done.append(item["id"])
        print(f"saved {path.name}")
    if done:
        call(f"{base}/ack", token, {"ids": done})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"inbox pull failed: {e}", file=sys.stderr)
        sys.exit(1)
