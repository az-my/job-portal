"""Collect job listings from Pintarnya REST API."""
import json
import urllib.parse
import urllib.request

from config import PINTARNYA_API, PINTARNYA_HEADERS, REQUEST_TIMEOUT


def _build_url(page, page_size=20):
    params = urllib.parse.urlencode({
        "search": "",
        "min_salary": "",
        "max_salary": "",
        "type_of_employment": "",
        "type_of_shift": "",
        "type_of_work": "",
        "min_education_level": "",
        "latitude": "",
        "longitude": "",
        "sort": "-published_at",
        "education_level": "",
        "filter_profile": "false",
        "page_size": page_size,
        "page": page,
    })
    return f"{PINTARNYA_API}?{params}"


def _fetch_page(url):
    req = urllib.request.Request(url, headers=PINTARNYA_HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        return json.loads(res.read().decode("utf-8"))


def collect_jobs(max_pages=5, page_size=20):
    seen_ids = set()
    docs = []

    for page in range(1, max_pages + 1):
        url = _build_url(page, page_size)
        result = _fetch_page(url)

        data = result.get("data") or {}
        items = data.get("list") or []
        if not items:
            break

        for item in items:
            item_id = item.get("id")
            if item_id and item_id not in seen_ids:
                seen_ids.add(item_id)
                docs.append(item)

    return docs
