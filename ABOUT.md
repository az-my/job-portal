# About This Project

**Job Aggregator** — a local-first job listing aggregator that scrapes Indonesian job boards (JobStreet, Dealls, and Kalibrr), normalizes the results into a single schema, and displays them in a high-density, searchable data table. Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and shadcn/ui.

> Note: the project began as a full job *portal* (candidates, employers, admins, applications) and was refactored into a **pure aggregator**: scrape → normalize → store → browse.

## How It Works

```
┌─────────────────────────────── scraper/ (standalone Python)   ───────────────────────────────┐
│                                                                                              │
│  jobstreet.py ───────────┐                                                                    │
│   (GraphQL JobSearchV6) │       normalize.py                 storage.py                      │
│                         ├──► (map to unified Job) ──► (merge by sourceId, cleanup >7d) ──┐   │
│  dealls.py ─────────────┘                                                                │   │
│   (REST sejutacita API)                                                                  │   │
└──────────────────────────────────────────────────────────────────────────────────────────┼──┘
                                                                                           ▼
                                                                                     data/db.json
                                                                                           │
┌─────────────────────────────── Next.js app (src/) — read-only ────────────────────────────┼──┐
│                                                                                           ▼  │
│  app/page.tsx (force-dynamic) ──► lib/db.ts (reads db.json) ──► components/Dashboard.tsx     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

The scraper runs via GitHub Actions (`.github/workflows/scrape.yml`): manual trigger with
source/max_pages inputs, plus a daily cron at 01:00 UTC. It commits the updated `db.json`
back to the repo. The frontend never triggers scraping — it only reads the database.
```

1. **Collect** — three source adapters fetch raw listings:
   - **JobStreet** (`scraper/jobstreet.py`): POSTs to the `id.jobstreet.com/graphql` endpoint using the `JobSearchV6` query with `sortMode=ListedDate` (newest first), browser-mimicking headers, and per-run generated session UUIDs (`scraper/config.py`).
   - **Dealls** (`scraper/dealls.py`): GETs the public `api.sejutacita.id/v1/explore-job/job` REST endpoint, paginated 18 per page.
   - **Kalibrr** (`scraper/kalibrr.py`): GETs `www.kalibrr.id/kjs/job_board/search` with `limit`/`offset` pagination and `sort=Freshness`. Deliberately avoids the `_next/data/<buildId>/` routes — the build id rotates on every Kalibrr deploy and those pages ignore pagination.
2. **Transform** — `normalize.py` maps both raw shapes into one `Job` dict (title, company, location, type, salary formatted as `Rp…jt`, source, sourceId, url, plus the full raw JSON payload for the raw-response viewer).
3. **Publish** — `storage.py` merges into `data/db.json`, upserting by `sourceId`. A cleanup pass removes jobs older than 7 days and any job without a `source` (leftover manual entries). Dealls listings are also pre-filtered to the last 7 days (`main.py`).
4. **Browse** — the single-page UI (`Dashboard.tsx`) renders a TanStack React Table with search, sorting, and pagination (25/page). Each row has an eye icon opening a detail dialog with two tabs — parsed fields and the raw API response — plus an external link to the original posting. The UI is read-only; scraping happens only via GitHub Actions or the scraper CLI.

## Directory Layout

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Entry page; reads `db.json` server-side (`force-dynamic`) |
| `src/lib/db.ts` | Tiny JSON-file "database" layer over `data/db.json` |
| `src/components/Dashboard.tsx` | Main client UI: header, jobs table, detail dialog (read-only) |
| `src/components/data-table.tsx` | Generic TanStack table wrapper (search, sort, pagination) |
| `src/components/ui/` | shadcn/ui primitives (button, card, dialog, input, select, table, tabs…) |
| `scraper/` | **Standalone Python scraper** (stdlib only, no pip deps) — the only way to scrape |
| `scraper/main.py` | CLI entry + orchestration: runs sources, 7-day filter, cleanup, summary |
| `scraper/config.py` | Endpoints, headers, session IDs |
| `scraper/jobstreet.py`, `scraper/dealls.py`, `scraper/kalibrr.py` | Source collectors |
| `scraper/normalize.py`, `scraper/storage.py` | Transform to unified Job schema; merge/cleanup db.json |
| `.github/workflows/scrape.yml` | Scheduled + manual scrape runs; commits `db.json` back to the repo |
| `data/db.json` | The database, refreshed by the workflow |

## Data Model

Defined in `src/lib/db.ts` (the Python scraper produces the same shape):

- **`Job`** — `id`, `title`, `company`, `location`, `type` (`full-time` | `part-time` | `remote` | `contract`), `description`, `salary`, `source` (`jobstreet` | `dealls` | `kalibrr`), `sourceId` (dedup key, scoped per source), `url`, `logoUrl`, `requirements`, `raw` (stringified original API response), `createdAt` (real posting date from each source).

## Running It

```bash
npm install            # app deps (the scraper needs only Python 3.10+, no pip installs)

npm run dev            # http://localhost:3000 — read-only view of data/db.json
```

Scraping (CLI):

```bash
python scraper/main.py                # 3 pages, all sources
python scraper/main.py 5              # 5 pages, all sources
python scraper/main.py 5 jobstreet    # 5 pages, JobStreet only
python scraper/main.py 5 dealls       # 5 pages, Dealls only
python scraper/main.py 5 kalibrr      # 5 pages, Kalibrr only
```

Scraping (CI): GitHub → Actions → "Scrape Jobs" → Run workflow (pick source + max pages). Also runs daily at 01:00 UTC and commits the refreshed `db.json`.

## Design & Conventions

- **UI style**: "Solid Grid" — visible dark borders, high contrast, uppercase tracking-wide headings, maximum data density. Dark-mode-first via Tailwind v4 CSS variables in `globals.css`.
- **Components**: shadcn/ui built on **@base-ui/react** (not Radix), styled with `class-variance-authority` + `tailwind-merge`. A shadcn MCP server is configured in `.mcp.json`.
- **No real database** — everything lives in `data/db.json`; `src/lib/db.ts` reads it fresh per request and the scraper writes to it directly.
- **Next.js 16 caveat** (from `AGENTS.md`): this Next version has breaking changes vs. common knowledge — consult `node_modules/next/dist/docs/` before writing framework code.
- Turbopack root is pinned in `next.config.ts`.

## Known Rough Edges

- All three sources are scraped sequentially; a slow source delays the others (fine at 3 sources).
- JobStreet's GraphQL schema is unofficial and could change without notice; same for the Dealls and Kalibrr endpoints.
