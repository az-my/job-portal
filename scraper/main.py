"""Job Portal Scraper — the only entry point for scraping.

Usage:
    python scraper/main.py [max_pages] [source]

    max_pages  pages per source (default 3)
    source     all | jobstreet | dealls (default all)
"""
import sys
from datetime import datetime, timedelta, timezone

import dealls
import jobstreet
from normalize import normalize_jobs
from storage import cleanup_jobs, get_stats, merge_jobs

VALID_SOURCES = ("all", "jobstreet", "dealls")


def _filter_recent_dealls(docs, days=7):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = []
    for doc in docs:
        published = doc.get("publishedAt")
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
    items = jobstreet.collect_jobs(max_pages)
    if not items:
        print("[scraper] JobStreet returned no data, skipping.")
        return None

    inserted, updated = merge_jobs(normalize_jobs(items, "jobstreet"))
    print(f"[scraper] JobStreet done: {len(items)} jobs found, {inserted} new, {updated} updated")
    return {"source": "jobstreet", "found": len(items), "inserted": inserted, "updated": updated}


def run_dealls(max_pages):
    print("[scraper] Starting Dealls scrape...")
    raw = dealls.collect_jobs(max_pages)
    recent = _filter_recent_dealls(raw)
    skipped = len(raw) - len(recent)
    if skipped > 0:
        print(f"[scraper] Dealls: skipped {skipped} jobs older than 7 days")
    if not recent:
        print("[scraper] Dealls returned no recent data, skipping.")
        return None

    inserted, updated = merge_jobs(normalize_jobs(recent, "dealls"))
    print(f"[scraper] Dealls done: {len(recent)} jobs found, {inserted} new, {updated} updated")
    return {"source": "dealls", "found": len(recent), "inserted": inserted, "updated": updated}


def run_scraper(max_pages=3, source="all"):
    results = []
    runners = {"jobstreet": run_jobstreet, "dealls": run_dealls}

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
