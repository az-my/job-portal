# Backlog

Canonical project backlog. Edit this file directly — `/backlog` in the app renders it.
Format: `## Now / Next / Later / Done` sections with `- item` lines; keep one item per line.

## Now — Supabase migration (in order)

- Provision Supabase project + `jobs` table: columns mirroring the Job schema (snake_case), `raw` as jsonb, UNIQUE (source, source_id), indexes on created_at/source/type, numeric salary_min/salary_max
- Scraper writes to Supabase via PostgREST upsert (stdlib urllib, on_conflict=source,source_id) — dual-write with db.json during transition; add SUPABASE_URL + secret key to GitHub Actions
- Retention change: keep history — mark jobs stale instead of deleting after 7 days; "fresh" becomes a filtered view (free archive)
- Frontend reads from Supabase (jobs table, /sources stats, /dataset) instead of db.json
- /query v2 — Gemini text-to-SQL: schema in prompt, show generated SQL, execute via READ-ONLY role + single-SELECT validation + statement_timeout (never execute LLM SQL with a privileged key)
- Retire db.json dual-write once Supabase is stable

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
