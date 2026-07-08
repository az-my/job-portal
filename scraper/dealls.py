"""Collect job listings from the Dealls (sejutacita) REST API."""
import json
import urllib.parse
import urllib.request

from config import DEALLS_API, DEALLS_HEADERS, REQUEST_TIMEOUT


def _fetch_page(page, limit=18):
    params = urllib.parse.urlencode({
        "page": page,
        "sortParam": "mostRelevant",
        "sortBy": "asc",
        "boostTheBoostedJob": "true",
        "published": "true",
        "limit": limit,
        "status": "active",
    })

    req = urllib.request.Request(f"{DEALLS_API}?{params}", headers=DEALLS_HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        return json.loads(res.read().decode("utf-8"))


def collect_jobs(max_pages=5, limit=18):
    first = _fetch_page(1, limit)
    docs = list(first["data"]["docs"])

    total_pages = min(max_pages, first["data"]["totalPages"])
    for page in range(2, total_pages + 1):
        result = _fetch_page(page, limit)
        docs.extend(result["data"]["docs"])

    return docs
