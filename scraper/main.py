"""Job Portal Scraper — the only entry point for scraping.

Usage:
    python scraper/main.py [max_pages] [source]

    max_pages  pages per source (default 3)
    source     all | jobstreet | dealls | kalibrr (default all)
"""
import sys
from datetime import datetime, timedelta, timezone

import dealls
import jobstreet
import kalibrr
from normalize import normalize_jobs
from storage import cleanup_jobs, get_stats, merge_jobs

VALID_SOURCES = ("all", "jobstreet", "dealls", "kalibrr")


def _filter_recent(docs, get_date, days=7):
    """Keep docs whose date (via get_date key or callable) is within the last `days`; undated docs pass."""
    if isinstance(get_date, str):
        key = get_date
        get_date = lambda doc: doc.get(key)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = []
    for doc in docs:
        published = get_date(doc)
        if not published:
            recent.append(doc)
            continue
        try:
            d = datetime.fromisoformat(str(published).replace("Z", "+00:00"))
        except ValueError:
            continue
        if d >= cutoff:
            recent.append(doc)
    return recent


def run_jobstreet(max_pages):
    print("[scraper] Starting JobStreet scrape...")
    raw = jobstreet.collect_jobs(max_pages)
    recent = _filter_recent(raw, lambda item: (item.get("listingDate") or {}).get("dateTimeUtc"))
    skipped = len(raw) - len(recent)
    if skipped > 0:
        print(f"[scraper] JobStreet: skipped {skipped} jobs older than 7 days")
    if not recent:
        print("[scraper] JobStreet returned no recent data, skipping.")
        return None

    inserted, updated = merge_jobs(normalize_jobs(recent, "jobstreet"))
    print(f"[scraper] JobStreet done: {len(recent)} jobs found, {inserted} new, {updated} updated")
    return {"source": "jobstreet", "found": len(recent), "inserted": inserted, "updated": updated}


def run_dealls(max_pages):
    print("[scraper] Starting Dealls scrape...")
    raw = dealls.collect_jobs(max_pages)
    recent = _filter_recent(raw, "publishedAt")
    skipped = len(raw) - len(recent)
    if skipped > 0:
        print(f"[scraper] Dealls: skipped {skipped} jobs older than 7 days")
    if not recent:
        print("[scraper] Dealls returned no recent data, skipping.")
        return None

    inserted, updated = merge_jobs(normalize_jobs(recent, "dealls"))
    print(f"[scraper] Dealls done: {len(recent)} jobs found, {inserted} new, {updated} updated")
    return {"source": "dealls", "found": len(recent), "inserted": inserted, "updated": updated}


def run_kalibrr(max_pages):
    print("[scraper] Starting Kalibrr scrape...")
    raw = kalibrr.collect_jobs(max_pages)
    recent = _filter_recent(raw, "activation_date")
    skipped = len(raw) - len(recent)
    if skipped > 0:
        print(f"[scraper] Kalibrr: skipped {skipped} jobs older than 7 days")
    if not recent:
        print("[scraper] Kalibrr returned no recent data, skipping.")
        return None

    inserted, updated = merge_jobs(normalize_jobs(recent, "kalibrr"))
    print(f"[scraper] Kalibrr done: {len(recent)} jobs found, {inserted} new, {updated} updated")
    return {"source": "kalibrr", "found": len(recent), "inserted": inserted, "updated": updated}


def run_scraper(max_pages=3, source="all"):
    results = []
    runners = {"jobstreet": run_jobstreet, "dealls": run_dealls, "kalibrr": run_kalibrr}

    for name, runner in runners.items():
        if source not in ("all", name):
            continue
        try:
            result = runner(max_pages)
            if result:
                results.append(result)
        except Exception as err:
            print(f"[scraper] {name} error: {err}", file=sys.stderr)

    print("[scraper] Running cleanup...")
    removed, removed_manual = cleanup_jobs(7)
    if removed > 0:
        print(f"[scraper] Cleanup: removed {removed} old jobs")
    if removed_manual > 0:
        print(f"[scraper] Cleanup: removed {removed_manual} manual-source jobs")

    stats = get_stats()
    print(f"[scraper] Total in DB: {stats['totalJobs']} jobs ({stats['sourceCounts']})")
    return results


def main():
    args = sys.argv[1:]
    max_pages = int(args[0]) if args else 3
    source = args[1] if len(args) > 1 else "all"

    if source not in VALID_SOURCES:
        print(f"[scraper] Invalid source '{source}'. Use: {', '.join(VALID_SOURCES)}", file=sys.stderr)
        sys.exit(1)

    print("[scraper] Job Portal Scraper (Python)")
    print(f"[scraper] Max pages: {max_pages}, source: {source}")
    print()

    results = run_scraper(max_pages, source)

    print()
    print("[scraper] Summary:")
    for r in results:
        print(f"  {r['source']}: {r['found']} jobs ({r['inserted']} new, {r['updated']} updated)")


if __name__ == "__main__":
    main()
