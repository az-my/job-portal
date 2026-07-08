"""Collect job listings from the Kalibrr job-board API.

Uses the public REST endpoint (kjs/job_board/search) rather than the
_next/data/<buildId>/ routes: the build id changes on every Kalibrr deploy
and its pages ignore pagination, while this endpoint needs no build id,
no cookies, and honors limit/offset.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from config import KALIBRR_API, KALIBRR_HEADERS, REQUEST_TIMEOUT


def _fetch_page(offset, limit=15):
    params = urllib.parse.urlencode({
        "limit": limit,
        "offset": offset,
        "sort": "Freshness",
    })

    req = urllib.request.Request(f"{KALIBRR_API}?{params}", headers=KALIBRR_HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
            body = res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        snippet = err.read(500).decode("utf-8", errors="replace")
        raise RuntimeError(f"Kalibrr API HTTP {err.code} {err.reason} — {snippet}") from err

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as err:
        raise RuntimeError(f"Kalibrr API returned invalid JSON: {body[:200]}") from err

    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise RuntimeError(f"Kalibrr API unexpected response shape: {str(payload)[:200]}")

    return payload


def collect_jobs(max_pages=5, limit=15):
    jobs = []
    seen_ids = set()

    for page in range(max_pages):
        payload = _fetch_page(page * limit, limit)
        page_jobs = payload["jobs"]
        if not page_jobs:
            break

        for job in page_jobs:
            job_id = job.get("id")
            if job_id is None or job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            jobs.append(job)

        if len(page_jobs) < limit:
            break

    return jobs
