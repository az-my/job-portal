"""Dual-write sink: upsert normalized jobs into Supabase via PostgREST.

Optional — skipped with a notice when SUPABASE_URL / SUPABASE_SECRET_KEY are
not configured (env vars, or .env.local at the repo root). db.json remains
the primary store until the migration completes.
"""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH_SIZE = 200
TIMEOUT = 60


def _load_config():
    env = dict(os.environ)
    env_file = os.path.join(PROJECT_ROOT, ".env.local")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    env.setdefault(key.strip(), value.strip())
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_SECRET_KEY")
    return (url.rstrip("/"), key) if url and key else (None, None)


def _to_row(job, now_iso):
    raw = None
    if job.get("raw"):
        try:
            raw = json.loads(job["raw"])
        except json.JSONDecodeError:
            raw = None

    return {
        "source": job["source"],
        "source_id": job["sourceId"],
        "title": job.get("title") or "Untitled",
        "company": job.get("company") or "",
        "location": job.get("location") or "",
        "type": job.get("type") or "full-time",
        "description": job.get("description") or "",
        "salary": job.get("salary") or "",
        "salary_min": job.get("salaryMin"),
        "salary_max": job.get("salaryMax"),
        "requirements": job.get("requirements"),
        "url": job.get("url"),
        "logo_url": job.get("logoUrl") or None,
        "raw": raw,
        "posted_at": job["createdAt"],
        "last_seen_at": now_iso,
        "is_stale": False,
    }


def _request(url, key, method, path, payload=None, prefer=None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "content-type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(f"{url}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return res.status
    except urllib.error.HTTPError as err:
        snippet = err.read(400).decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} -> HTTP {err.code}: {snippet}") from err


def upsert_jobs(jobs):
    """Upsert normalized Job dicts. Returns rows written, or None when unconfigured."""
    url, key = _load_config()
    if not url:
        return None

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    # a batch upsert must not contain the same (source, source_id) twice
    # (pages can shift mid-scrape and re-serve a job); keep the last seen
    by_key = {}
    for j in jobs:
        if j.get("sourceId"):
            by_key[(j["source"], j["sourceId"])] = j
    rows = [_to_row(j, now_iso) for j in by_key.values()]

    for i in range(0, len(rows), BATCH_SIZE):
        _request(
            url, key, "POST",
            "/rest/v1/jobs?on_conflict=source,source_id",
            rows[i:i + BATCH_SIZE],
            prefer="resolution=merge-duplicates,return=minimal",
        )
    return len(rows)


def mark_stale(days=7):
    """Flag listings older than the freshness window. Returns None when unconfigured."""
    url, key = _load_config()
    if not url:
        return None

    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    _request(
        url, key, "PATCH",
        f"/rest/v1/jobs?is_stale=eq.false&posted_at=lt.{cutoff}",
        {"is_stale": True},
        prefer="return=minimal",
    )
    return True
