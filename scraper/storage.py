"""Persist jobs into data/db.json: merge by sourceId, cleanup old entries."""
import json
import os
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(PROJECT_ROOT, "data")
DB_FILE = os.path.join(DB_DIR, "db.json")

EMPTY_DB = {"users": [], "jobs": [], "applications": []}


def read_db():
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            db = json.load(f)
    except (OSError, json.JSONDecodeError):
        return dict(EMPTY_DB)
    for key in EMPTY_DB:
        db.setdefault(key, [])
    return db


def write_db(db):
    os.makedirs(DB_DIR, exist_ok=True)
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
        f.write("\n")


def merge_jobs(new_jobs):
    db = read_db()
    by_source_id = {j["sourceId"]: i for i, j in enumerate(db["jobs"]) if j.get("sourceId")}
    inserted = 0
    updated = 0

    for job in new_jobs:
        existing_index = by_source_id.get(job.get("sourceId"), -1)
        if existing_index >= 0:
            db["jobs"][existing_index] = {**db["jobs"][existing_index], **job}
            updated += 1
        else:
            by_source_id[job["sourceId"]] = len(db["jobs"])
            db["jobs"].append(job)
            inserted += 1

    write_db(db)
    return inserted, updated


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def cleanup_jobs(days_old=7):
    db = read_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
    removed = 0
    removed_manual = 0
    kept = []

    for job in db["jobs"]:
        if not job.get("source"):
            removed_manual += 1
            continue
        created = _parse_date(job.get("createdAt"))
        if created is None or created < cutoff:
            removed += 1
            continue
        kept.append(job)

    if len(kept) != len(db["jobs"]):
        db["jobs"] = kept
        write_db(db)

    return removed, removed_manual


def get_stats():
    db = read_db()
    source_counts = {}
    for job in db["jobs"]:
        source = job.get("source") or "manual"
        source_counts[source] = source_counts.get(source, 0) + 1
    return {"totalJobs": len(db["jobs"]), "sourceCounts": source_counts}
