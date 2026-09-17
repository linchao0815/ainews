#!/usr/bin/env python3
"""Collect shared URLs, fetch readable content, and store it under telegram_inbox/.

Sources, chosen in this order:
  1. INBOX_URLS env var (whitespace-separated) — set by the repository_dispatch workflow trigger
  2. --from-export FILE — a Telegram Desktop "Export chat history" JSON, for backfilling
  3. Telegram Bot API getUpdates — polls chats where the bot is admin (needs TELEGRAM_BOT_TOKEN)
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests
import trafilatura

INBOX = Path("telegram_inbox")
STATE = INBOX / "state.json"

# Login-walled / JS-rendered platforms: plain fetching only yields a shell, so flag for a human.
SOCIAL_HOSTS = ("facebook.com", "fb.com", "fb.watch", "instagram.com", "threads.net", "threads.com", "x.com", "twitter.com")
SKIP_HOSTS = ("t.me", "telegram.me", "telegram.org")
TRACKING_PARAMS = ("utm_", "fbclid", "igshid", "igsh", "gclid", "mc_cid", "mc_eid", "ref_src", "xmt", "slof")
MAX_TEXT_CHARS = 6000
MAX_SEEN = 5000
USER_AGENT = "Mozilla/5.0 (compatible; ainews-telegram-collector/1.0)"


def _slice_utf16(text: str, offset: int, length: int) -> str:
    # Telegram entity offsets count UTF-16 code units, not Python characters.
    raw = text.encode("utf-16-le")
    return raw[offset * 2:(offset + length) * 2].decode("utf-16-le", errors="ignore")


def extract_urls(msg: dict) -> list[str]:
    urls = []
    for text_key, ent_key in (("text", "entities"), ("caption", "caption_entities")):
        text = msg.get(text_key) or ""
        for ent in msg.get(ent_key) or []:
            if ent["type"] == "url":
                urls.append(_slice_utf16(text, ent["offset"], ent["length"]))
            elif ent["type"] == "text_link":
                urls.append(ent["url"])
    preview = (msg.get("link_preview_options") or {}).get("url")
    if preview:
        urls.append(preview)
    return urls


def extract_urls_from_export(msg: dict) -> list[str]:
    # Telegram Desktop export: `text` is a string or a list mixing plain strings and entity dicts.
    entities = msg.get("text_entities") or (msg.get("text") if isinstance(msg.get("text"), list) else [])
    urls = []
    for ent in entities:
        if not isinstance(ent, dict):
            continue
        if ent.get("type") == "link":
            urls.append(ent["text"])
        elif ent.get("type") == "text_link":
            urls.append(ent["href"])
    return urls


def normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parts = urlsplit(url)
    query = sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith(TRACKING_PARAMS))
    return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path, urlencode(query), ""))


def host_of(url: str) -> str:
    host = urlsplit(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def dedupe_key(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(("https", host_of(url), parts.path.rstrip("/"), parts.query, ""))


def host_in(host: str, hosts: tuple[str, ...]) -> bool:
    return any(host == h or host.endswith("." + h) for h in hosts)


def _og(page: str, prop: str) -> str | None:
    for pattern in (
        rf'<meta[^>]+property=["\']og:{prop}["\'][^>]*content=["\']([^"\']*)',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]*property=["\']og:{prop}["\']',
    ):
        m = re.search(pattern, page, re.IGNORECASE)
        if m and m.group(1).strip():
            return html.unescape(m.group(1).strip())
    return None


def fetch(url: str) -> dict:
    entry = {"status": "fetch_failed", "final_url": url, "title": None, "text": None}
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
        entry["final_url"] = normalize_url(resp.url)
    except requests.RequestException as exc:
        entry["error"] = str(exc)[:200]
        return entry

    if host_in(host_of(entry["final_url"]), SOCIAL_HOSTS):
        entry.update(status="needs_manual_review", title=_og(resp.text, "title"), text=_og(resp.text, "description"))
        return entry
    if resp.status_code >= 400:
        entry["error"] = f"HTTP {resp.status_code}"
        return entry

    extracted = trafilatura.extract(resp.text, url=entry["final_url"], output_format="json", include_comments=False, with_metadata=True)
    if not extracted:
        entry["error"] = "no readable main content"
        return entry
    meta = json.loads(extracted)
    entry.update(
        status="ok",
        title=meta.get("title"),
        text=(meta.get("text") or "")[:MAX_TEXT_CHARS],
        published=meta.get("date"),
        site=meta.get("sitename"),
    )
    return entry


def render_markdown(entries: list[dict], day: str) -> str:
    groups = {"ok": [], "needs_manual_review": [], "fetch_failed": []}
    for e in entries:
        groups[e["status"]].append(e)

    lines = [f"# Telegram 連結收集 {day}", "", f"共 {len(entries)} 條連結（完整內文見同名 .jsonl）", ""]

    lines += [f"## 已抓取內文（{len(groups['ok'])}）", ""]
    for e in groups["ok"]:
        meta = " ｜ ".join(filter(None, [f"來源：{e['chat']}", f"貼文時間：{e['posted_at'][:16]}", e.get("site") and f"站台：{e['site']}", e.get("published") and f"發布：{e['published']}"]))
        excerpt = " ".join((e.get("text") or "").split())[:300]
        lines += [f"### [{e.get('title') or e['final_url']}]({e['final_url']})", f"- {meta}", f"> {excerpt}", ""]

    lines += [f"## 需人工確認：FB／IG／Threads／X 貼文（{len(groups['needs_manual_review'])}）", ""]
    for e in groups["needs_manual_review"]:
        hint = " — " + " / ".join(filter(None, [e.get("title"), e.get("text")])) if (e.get("title") or e.get("text")) else ""
        lines += [f"- {e['final_url']}（來源：{e['chat']}，{e['posted_at'][:10]}）{hint}"]
    lines.append("")

    lines += [f"## 抓取失敗（{len(groups['fetch_failed'])}）", ""]
    for e in groups["fetch_failed"]:
        lines += [f"- {e['url']} — {e.get('error', 'unknown error')}"]
    lines.append("")
    return "\n".join(lines)


def bot_diagnostics(api: str) -> None:
    me = requests.get(f"{api}/getMe", timeout=30).json()
    if not me.get("ok"):
        sys.exit(f"getMe failed: {me.get('description', me)} — check TELEGRAM_BOT_TOKEN")
    bot = me["result"]
    print(f"bot: @{bot.get('username')} (id {bot['id']})")

    hook = requests.get(f"{api}/getWebhookInfo", timeout=30).json().get("result", {})
    print(f"webhook: {hook.get('url') or '(none)'} | pending updates on Telegram side: {hook.get('pending_update_count', 0)}")
    if hook.get("url"):
        sys.exit("A webhook is set on this bot, so getUpdates receives nothing; call deleteWebhook first.")


# Each candidate is (raw_url, fields describing where it came from).
Candidate = tuple[str, dict]


def candidates_from_env(now: dt.datetime) -> list[Candidate]:
    source = os.environ.get("INBOX_SOURCE") or "repository_dispatch"
    return [(u, {"chat": source, "message_id": None, "posted_at": now.isoformat()}) for u in os.environ["INBOX_URLS"].split()]


def candidates_from_export(path: Path, tz: ZoneInfo) -> list[Candidate]:
    export = json.loads(path.read_text(encoding="utf-8"))
    chat = export.get("name") or str(export.get("id"))
    out = []
    for msg in export.get("messages", []):
        if msg.get("type") != "message":
            continue
        if msg.get("date_unixtime"):
            posted = dt.datetime.fromtimestamp(int(msg["date_unixtime"]), tz)
        else:
            posted = dt.datetime.fromisoformat(msg["date"]).replace(tzinfo=tz)
        fields = {"chat": chat, "message_id": msg.get("id"), "posted_at": posted.isoformat()}
        out += [(u, fields) for u in extract_urls_from_export(msg)]
    print(f"export: {len(export.get('messages', []))} messages in '{chat}', {len(out)} link candidates")
    return out


def candidates_from_telegram(state: dict, tz: ZoneInfo) -> list[Candidate]:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    api = f"https://api.telegram.org/bot{token}"
    allowed_chats = {c.strip() for c in os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "").split(",") if c.strip()}
    bot_diagnostics(api)

    params = {"timeout": 0, "allowed_updates": json.dumps(["message", "channel_post"])}
    if state["last_update_id"]:
        params["offset"] = state["last_update_id"] + 1
    resp = requests.get(f"{api}/getUpdates", params=params, timeout=30)
    resp.raise_for_status()
    updates = resp.json()["result"]
    if not updates:
        print("getUpdates returned nothing. Remember: bots never see posts made by other bots, and only admin bots receive channel posts.")

    out = []
    for upd in updates:
        state["last_update_id"] = max(state["last_update_id"], upd["update_id"])
        msg = upd.get("channel_post") or upd.get("message")
        if not msg:
            continue
        chat = msg["chat"]
        if allowed_chats and str(chat["id"]) not in allowed_chats:
            continue
        fields = {
            "chat": chat.get("title") or chat.get("username") or str(chat["id"]),
            "message_id": msg["message_id"],
            "posted_at": dt.datetime.fromtimestamp(msg["date"], tz).isoformat(),
        }
        out += [(u, fields) for u in extract_urls(msg)]
    print(f"{len(updates)} updates processed")
    return out


def process(candidates: list[Candidate], state: dict, now: dt.datetime) -> list[dict]:
    seen = set(state["seen"])
    new_entries = []
    for raw, fields in candidates:
        url = normalize_url(raw)
        if host_in(host_of(url), SKIP_HOSTS):
            continue
        key = hashlib.sha1(dedupe_key(url).encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        state["seen"].append(key)
        entry = {"url": url, **fields, "collected_at": now.isoformat()}
        entry.update(fetch(url))
        new_entries.append(entry)
        print(f"[{entry['status']}] {url}")
    return new_entries


def write_outputs(new_entries: list[dict], now: dt.datetime) -> None:
    day = now.strftime("%Y-%m-%d")
    jsonl = INBOX / f"{day}.jsonl"
    with jsonl.open("a", encoding="utf-8") as f:
        for e in new_entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    day_entries = [json.loads(line) for line in jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]
    (INBOX / f"{day}.md").write_text(render_markdown(day_entries, day), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-export", type=Path, help="Telegram Desktop chat export (result.json) to backfill from")
    args = parser.parse_args()

    tz = ZoneInfo(os.environ.get("INBOX_TZ", "Asia/Taipei"))
    now = dt.datetime.now(tz)
    INBOX.mkdir(exist_ok=True)
    state = json.loads(STATE.read_text()) if STATE.exists() else {"last_update_id": 0, "seen": []}

    if os.environ.get("INBOX_URLS", "").strip():
        candidates = candidates_from_env(now)
    elif args.from_export:
        candidates = candidates_from_export(args.from_export, tz)
    else:
        candidates = candidates_from_telegram(state, tz)

    new_entries = process(candidates, state, now)
    if new_entries:
        write_outputs(new_entries, now)

    state["seen"] = state["seen"][-MAX_SEEN:]
    STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
    print(f"{len(new_entries)} new URLs")


if __name__ == "__main__":
    main()
