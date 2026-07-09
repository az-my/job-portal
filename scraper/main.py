"""Job Portal Scraper — the only entry point for scraping.

Usage:
    python scraper/main.py [max_pages] [source]

    max_pages  pages per source (default 3)
    source     all | jobstreet | dealls | kalibrr | glints (default all)
"""
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import dealls
import glints
import jobstreet
import kalibrr
import supabase_store
from normalize import normalize_jobs
from storage import cleanup_jobs, get_stats, merge_jobs

# name -> (collector, date extractor for the 7-day filter)
SOURCES = {
    "jobstreet": (jobstreet.collect_jobs, lambda item: (item.get("listingDate") or {}).get("dateTimeUtc")),
    "dealls": (dealls.collect_jobs, "publishedAt"),
    "kalibrr": (kalibrr.collect_jobs, "activation_date"),
    "glints": (glints.collect_jobs, "createdAt"),
}

VALID_SOURCES = ("all", *SOURCES)


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


def _fetch_source(name, max_pages):
    """Collect + 7-day filter + normalize one source (runs in a worker thread)."""
    collect, get_date = SOURCES[name]
    raw = collect(max_pages)
    recent = _filter_recent(raw, get_date)
    skipped = len(raw) - len(recent)
    if skipped > 0:
        print(f"[scraper] {name}: skipped {skipped} jobs older than 7 days")
    return normalize_jobs(recent, name)


def run_scraper(max_pages=3, source="all"):
    selected = list(SOURCES) if source == "all" else [source]
    print(f"[scraper] Fetching in parallel: {', '.join(selected)}")

    # network fetches run concurrently; db.json merges stay serial below
    with ThreadPoolExecutor(max_workers=len(selected)) as pool:
        futures = {name: pool.submit(_fetch_source, name, max_pages) for name in selected}

    results = []
    all_normalized = []
    for name in selected:
        try:
            normalized = futures[name].result()
        except Exception as err:
            print(f"[scraper] {name} error: {err}", file=sys.stderr)
            continue
        if not normalized:
            print(f"[scraper] {name} returned no recent data, skipping.")
            continue
        inserted, updated = merge_jobs(normalized)
        all_normalized.extend(normalized)
        print(f"[scraper] {name} done: {len(normalized)} jobs found, {inserted} new, {updated} updated")
        results.append({"source": name, "found": len(normalized), "inserted": inserted, "updated": updated})

    # --- Dual-write to Supabase (optional until migration completes) ---
    if all_normalized:
        try:
            written = supabase_store.upsert_jobs(all_normalized)
            if written is None:
                print("[scraper] Supabase not configured (SUPABASE_URL/SUPABASE_SECRET_KEY), skipping dual-write.")
            else:
                supabase_store.mark_stale(7)
                print(f"[scraper] Supabase: upserted {written} rows, refreshed stale flags")
        except Exception as err:
            print(f"[scraper] Supabase dual-write failed (db.json unaffected): {err}", file=sys.stderr)

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
