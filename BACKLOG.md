# Backlog

Canonical project backlog. Edit this file directly — `/backlog` in the app renders it.
Format: `## Now / Next / Later / Done` sections with `- item` lines; keep one item per line.

## Now

- Retire db.json dual-write once Supabase has proven stable for a few daily runs (drop storage.py merge, workflow commit step, and the getJobs db.json fallback)
- Update /sources and /wiki content for the Supabase architecture (they still describe db.json as primary)

## Next

- Deploy to Vercel — env vars for GEMINI_API_KEY + Supabase keys
- Frontend filters on the jobs table: source, job type, salary sort (numeric salary now available), company logos
- Bump GitHub Actions versions (checkout, setup-python) — Node 20 deprecation warning in CI

## Later

- More sources: TopKarir, Karir.com, Indeed ID (LinkedIn is hardest — aggressive anti-scraping)
- Keyword watchlist + daily digest notification after each scrape run
- User-facing phase: public read-only board, auth for admin pages (/sources, /dataset, /wiki, /backlog, /query)
- Parallelize per-source pagination (currently pages within one source are sequential)

## Done

- Scrape pipeline: JobStreet + Dealls + Kalibrr + Glints, Python stdlib only, parallel fetch (~8s)
- Real posting dates everywhere; 7-day freshness window measured on posting age
- Dedup by (source, sourceId); per-run generated JobStreet session UUIDs
- GitHub Actions daily scrape (08:00 WIB) + manual dispatch, commits db.json back to repo
- Read-only frontend; scraper decoupled (CLI + CI only)
- /sources endpoint-intel page: per-portal findings, limits, field maps, live stats
- Shared flat-page admin nav
- /dataset page: stats, CSV/JSON export, schema reference
- /wiki page: architecture, runbook, decisions log
- /backlog page rendering this file
- /query page: NL search via Gemini (gemini-2.5-flash, structured output, keyword fallback); GEMINI_API_KEY in .env.local
- Numeric salaryMin/salaryMax stored at normalize time for all four sources (JobStreet parses the display label)
- Supabase project "job-portal" (wlxntcsxadknyhyixegf, ap-southeast-1): jobs table, UNIQUE (source, source_id), jobs_fresh view, RLS public-read, is_stale retention (no deletes — history kept)
- Scraper dual-write via PostgREST upsert (stdlib urllib) + mark_stale; graceful skip when unconfigured; 509 jobs backfilled
- Frontend reads jobs_fresh from Supabase (db.json fallback kept); /dataset exports come from Supabase too
- /query v2 text-to-SQL: Gemini writes a SELECT, executed by run_job_query() — read-only role owner, single-SELECT validation, 4s statement_timeout; attacks verified blocked (DELETE, chaining, auth.users read)
