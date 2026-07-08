# About This Project

**Job Aggregator** — a local-first job listing aggregator that scrapes Indonesian job boards (JobStreet and Dealls), normalizes the results into a single schema, and displays them in a high-density, searchable data table. Built with Next.js 16 (App Router + Server Actions), React 19, Tailwind CSS v4, and shadcn/ui.

> Note: the project began as a full job *portal* (candidates, employers, admins, applications) — traces of that remain in the README, the `User`/`Application` types, and `scripts/scrape.py`. It has since been refactored into a **pure aggregator**: scrape → normalize → store → browse.

## How It Works

```
┌─────────────────────────────── scraper/ (standalone package) ───────────────────────────────┐
│                                                                                              │
│  collect/jobstreet.ts ──┐                                                                    │
│   (GraphQL JobSearchV6) │    transform/normalize.ts      publish/storage.ts                  │
│                         ├──► (map to unified Job) ──► (merge by sourceId, cleanup >7d) ──┐   │
│  collect/dealls.ts ─────┘                                                                │   │
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

1. **Collect** — two source adapters fetch raw listings:
   - **JobStreet** (`scraper/functions/collect/jobstreet.ts`): POSTs to the `id.jobstreet.com/graphql` endpoint using the `JobSearchV6` / `JobCountsV6` queries, with browser-mimicking headers and hardcoded session/sol IDs (`scraper/core/config.ts`).
   - **Dealls** (`scraper/functions/collect/dealls.ts`): GETs the public `api.sejutacita.id/v1/explore-job/job` REST endpoint, paginated 18 per page.
2. **Transform** — `normalize.ts` maps both raw shapes into one `Job` interface (title, company, location, type, salary formatted as `Rp…jt`, source, sourceId, url, plus the full raw JSON payload for the raw-response viewer).
3. **Publish** — `storage.ts` merges into `data/db.json`, upserting by `sourceId`. A cleanup pass removes jobs older than 7 days and any job without a `source` (leftover manual entries). Dealls listings are also pre-filtered to the last 7 days (`orchestrator.ts`).
4. **Browse** — the single-page UI (`Dashboard.tsx`) renders a TanStack React Table with search, sorting, and pagination (25/page). Each row has an eye icon opening a detail dialog with two tabs — parsed fields and the raw API response — plus an external link to the original posting. The UI is read-only; scraping happens only via GitHub Actions or the scraper CLI.

## Directory Layout

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Entry page; reads `db.json` server-side (`force-dynamic`) |
| `src/lib/db.ts` | Tiny JSON-file "database" layer over `data/db.json` |
| `src/components/Dashboard.tsx` | Main client UI: header, jobs table, detail dialog (read-only) |
| `src/components/data-table.tsx` | Generic TanStack table wrapper (search, sort, pagination) |
| `src/components/ui/` | shadcn/ui primitives (button, card, dialog, input, select, table, tabs…) |
| `scraper/` | **Standalone package** (own `package.json`, `tsconfig`, `node_modules`) run with `tsx` |
| `scraper/orchestrator.ts` | Runs both sources, applies 7-day filters, cleanup, prints summary |
| `scraper/core/` | Config (endpoints, headers, session IDs), shared types, utils |
| `scraper/functions/` | FBA-style pipeline: `collect/` → `transform/` → `publish/` |
| `.github/workflows/scrape.yml` | Scheduled + manual scrape runs; commits `db.json` back to the repo |
| `data/db.json` | The database, refreshed by the workflow |

## Data Model

Defined in `scraper/core/types.ts` and re-exported by `src/lib/db.ts`:

- **`Job`** — `id`, `title`, `company`, `location`, `type` (`full-time` | `part-time` | `remote` | `contract`), `description`, `salary`, `source` (`jobstreet` | `dealls`), `sourceId` (dedup key), `url`, `logoUrl`, `requirements`, `raw` (stringified original API response), `createdAt`.
- **`User`** / **`Application`** — legacy from the portal phase; still in the schema and `db.json` but unused by the current UI.

## Running It

```bash
npm install            # app deps
cd scraper && npm install && cd ..   # scraper deps (separate package)

npm run dev            # http://localhost:3000 — read-only view of data/db.json
```

Scraping (CLI):

```bash
cd scraper
npx tsx index.ts                # 3 pages, all sources
npx tsx index.ts 5              # 5 pages, all sources
npx tsx index.ts 5 jobstreet    # 5 pages, JobStreet only
npx tsx index.ts 5 dealls       # 5 pages, Dealls only
npm run typecheck
```

Scraping (CI): GitHub → Actions → "Scrape Jobs" → Run workflow (pick source + max pages). Also runs daily at 01:00 UTC and commits the refreshed `db.json`.

## Design & Conventions

- **UI style**: "Solid Grid" — visible dark borders, high contrast, uppercase tracking-wide headings, maximum data density. Dark-mode-first via Tailwind v4 CSS variables in `globals.css`.
- **Components**: shadcn/ui built on **@base-ui/react** (not Radix), styled with `class-variance-authority` + `tailwind-merge`. A shadcn MCP server is configured in `.mcp.json`.
- **No real database** — everything lives in `data/db.json`; `src/lib/db.ts` reads it fresh per request and the scraper writes to it directly.
- **Next.js 16 caveat** (from `AGENTS.md`): this Next version has breaking changes vs. common knowledge — consult `node_modules/next/dist/docs/` before writing framework code.
- Turbopack root is pinned in `next.config.ts`.

## Known Rough Edges

- `README.md` still describes the old portal (persona switching, applications, pre-seeded admin) and no longer matches the code.
- JobStreet normalization leaves `location` empty and hardcodes `type: 'full-time'` (the GraphQL query doesn't fetch those fields); JobStreet items get `createdAt: now`, so the 7-day cleanup measures *scrape* age, not posting age.
- JobStreet session/sol IDs are hardcoded in `scraper/core/config.ts` and may expire.
- `db.json` still contains legacy `users`/`applications` arrays that nothing reads.
