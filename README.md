# Job Aggregator

Aggregates fresh job listings (last 7 days) from Indonesian job boards — **JobStreet**, **Dealls**, **Kalibrr**, and **Glints** — into one high-density, searchable table.

A standalone Python scraper (stdlib only) collects, normalizes, and dedupes listings into `data/db.json`. A read-only Next.js UI renders them. GitHub Actions runs the scraper daily and commits the refreshed data back to the repo.

```
GitHub Actions (daily / manual) ──► python scraper/main.py ──► data/db.json ──► Next.js (read-only)
```

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Scrape manually (needs Python 3.10+, no pip installs):

```bash
python scraper/main.py 5 all        # 5 pages per source
python scraper/main.py 5 glints     # one source: jobstreet | dealls | kalibrr | glints
```

Or from GitHub: **Actions → Scrape Jobs → Run workflow** (also runs daily at 08:00 WIB).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui (@base-ui) · TanStack Table · Python stdlib scraper

See [ABOUT.md](./ABOUT.md) for architecture details, data model, and conventions.
