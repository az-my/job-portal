# Backlog

Canonical project backlog. Edit this file directly — `/backlog` in the app renders it.
Format: `## Now / Next / Later / Done` sections with `- item` lines; keep one item per line.

## Now

- Build /query page — natural-language search builder powered by Gemini (blocked: needs GEMINI_API_KEY in .env.local)
- Store numeric salaryMin/salaryMax at normalize time in the scraper (prereq for salary filtering in /query)

## Next

- Deploy to Vercel — daily scrape commit auto-triggers redeploy with fresh data
- Frontend filters on the jobs table: source, job type, salary sort (needs numeric salary), company logos
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
