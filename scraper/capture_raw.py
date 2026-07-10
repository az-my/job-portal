"""Capture representative upstream JSON response bodies without normalization.

Usage: python scraper/capture_raw.py

The generated files under data/raw are evidence for schema design. They are not
read by the application and must not be treated as the normalized dataset.
"""
import json
import os
import uuid
from datetime import datetime, timezone

import dealls
import glints
import jobstreet
import kalibrr


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(PROJECT_ROOT, "data", "raw")


def _write(name, payload):
    path = os.path.join(RAW_DIR, name)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)
        file.write("\n")
    return path


def capture():
    os.makedirs(RAW_DIR, exist_ok=True)
    captured_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    jobstreet_search = jobstreet._graphql_request(
        jobstreet.JOB_SEARCH_QUERY,
        "JobSearchV6",
        {"page": 1, "pageSize": 1},
        return_payload=True,
    )
    search_jobs = (((jobstreet_search.get("data") or {}).get("jobSearchV6") or {}).get("data") or [])
    if not search_jobs:
        raise RuntimeError("JobStreet search capture returned no jobs")

    jobstreet_detail = jobstreet._graphql_request(
        jobstreet.JOB_DETAILS_QUERY,
        "JobDetailsEnrichment",
        {
            "jobId": str(search_jobs[0]["id"]),
            "zone": "asia-4",
            "locale": "id-ID",
            "languageCode": "id",
            "visitorId": str(uuid.uuid4()),
        },
        wrap_params=False,
        return_payload=True,
    )

    responses = {
        "jobstreet-search.json": jobstreet_search,
        "jobstreet-detail.json": jobstreet_detail,
        "dealls.json": dealls._fetch_page(1, 1),
        "kalibrr.json": kalibrr._fetch_page(0, 1),
        "glints.json": glints._fetch_page(1, 1, return_payload=True),
    }
    paths = [_write(name, payload) for name, payload in responses.items()]

    manifest = {
        "capturedAt": captured_at,
        "purpose": "Unmodified representative JSON response bodies for cross-portal schema analysis",
        "files": {
            "jobstreet-search.json": {"method": "POST", "operation": "JobSearchV6", "page": 1, "pageSize": 1},
            "jobstreet-detail.json": {"method": "POST", "operation": "JobDetailsEnrichment", "sourceId": str(search_jobs[0]["id"])},
            "dealls.json": {"method": "GET", "page": 1, "limit": 1, "status": "active"},
            "kalibrr.json": {"method": "GET", "offset": 0, "limit": 1, "sort": "Freshness"},
            "glints.json": {"method": "POST", "operation": "searchJobsV3", "page": 1, "pageSize": 1},
        },
        "warning": "Raw responses may contain public recruiter or author metadata. Review before publishing outside this repository.",
    }
    _write("manifest.json", manifest)
    return paths


if __name__ == "__main__":
    for captured_path in capture():
        print(os.path.relpath(captured_path, PROJECT_ROOT))
