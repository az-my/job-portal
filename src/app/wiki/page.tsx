import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: "Wiki — Job Aggregator",
  description: "Architecture, runbook, and decisions log for the job aggregator.",
};

const RUNBOOK: [string, string][] = [
  ["Scrape everything now", "python scraper/main.py 5 all  (repo root; Python 3.10+, no pip installs)"],
  ["Scrape one source", "python scraper/main.py 5 jobstreet|dealls|kalibrr|glints"],
  ["Scrape from GitHub", "Actions → Scrape Jobs → Run workflow — pick source + max pages"],
  ["Daily schedule", "01:00 UTC (08:00 WIB) cron; commits db.json back to master, message: chore: scrape jobs (…)"],
  ["Dispatch via CLI", "gh workflow run scrape.yml -f source=all -f max_pages=5 && gh run watch"],
  ["Inspect a job's raw payload", "Jobs table → eye icon → JSON tab"],
];

const TROUBLESHOOTING: [string, string][] = [
  [
    "JobStreet: HTTP 200 but GraphQL errors say only 'An error occurred'",
    "A required header is missing — usually x-custom-features. It is NOT a query problem; schema mistakes return HTTP 400 with real messages. Check scraper/config.py JOBSTREET_HEADERS first.",
  ],
  [
    "JobStreet: sudden flood of months-old jobs",
    "sortMode: ListedDate stopped being sent or stopped working — the default relevance sort returns year-old listings. The 7-day filter will discard them, so symptoms look like 'JobStreet returned no recent data'.",
  ],
  [
    "Kalibrr: 404s",
    "If anyone switched to _next/data/<buildId>/ URLs — don't: the build id rotates every Kalibrr deploy. The kjs/job_board/search endpoint needs no build id.",
  ],
  [
    "Glints: 403 'please login for more information'",
    "Normal on page 2+ — anonymous access is one page of max 50 jobs. The collector stops gracefully. Only worry if page 1 starts returning 403.",
  ],
  [
    "A whole source vanished from the DB",
    "Sources fail independently (per-source try/except), but jobs older than 7 days are cleaned every run — if a source errors for more than 7 days its jobs age out. Check the Actions logs for that source's error line.",
  ],
  [
    "Empty dashboard locally",
    "data/db.json is committed — git pull to get the latest scrape commit, or run the scraper once.",
  ],
];

const DECISIONS: [string, string][] = [
  [
    "Python stdlib-only scraper",
    "Zero install anywhere Python exists (CI needs setup-python only). urllib is enough for JSON APIs; no requests/bs4 dependency to maintain.",
  ],
  [
    "Git-scraper pattern (db.json committed to the repo)",
    "No database service to run or pay for; git history doubles as the dataset's audit trail; CI commit → deploy hook works out of the box. Trade-off: repo grows over time; acceptable at ~300 jobs/week scale.",
  ],
  [
    "Frontend is strictly read-only",
    "The old Scrape button exec()'d shell commands from a Server Action — a security hole that also breaks on serverless. Scraping now only happens via CLI or CI.",
  ],
  [
    "7-day freshness window, measured on real posting dates",
    "The product is 'what is fresh', not an archive. Jobs older than 7 days (posting age, not scrape age) are pre-filtered and cleaned every run.",
  ],
  [
    "Dedup key is (source, sourceId)",
    "JobStreet and Kalibrr both use plain numeric ids — a bare sourceId key would let them collide and overwrite each other.",
  ],
  [
    "Parallel fetch, serial merge",
    "Collectors are network-bound → thread pool (full run ≈ 8s). storage.py writes db.json without locking, so merges stay sequential.",
  ],
  [
    "Flat pages, no auth (current phase)",
    "Super-admin/staging tool for now; every page is a flat top-level route. Auth arrives with the user-facing phase, gating the admin pages.",
  ],
];

function KvTable({ rows, mono = false }: { rows: [string, string][]; mono?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-b-0 align-top">
              <td className="px-4 py-2 font-medium w-1/3">{k}</td>
              <td className={`px-3 py-2 text-muted-foreground ${mono ? "font-mono text-xs" : ""}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border mb-4">
      <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function WikiPage() {
  return (
    <div className="px-2 py-2 max-w-4xl">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Wiki</h1>
          </div>
          <AdminNav />
        </div>
        <p className="mt-2 text-muted-foreground">
          How this thing works and why it is built this way. Per-endpoint API detail lives in{" "}
          <Link href="/sources" className="underline underline-offset-2 hover:text-foreground">
            Sources
          </Link>
          ; repo docs in README.md / ABOUT.md.
        </p>
      </header>

      <Section title="Architecture">
        <div className="px-4 py-3 space-y-3">
          <pre className="font-mono text-xs leading-relaxed overflow-x-auto border border-border bg-muted/30 p-3">
{`GitHub Actions (daily 08:00 WIB / manual dispatch)
        │
        ▼
python scraper/main.py ── parallel fetch: jobstreet │ dealls │ kalibrr │ glints
        │                  each: collect → 7-day filter → normalize to Job
        ▼
serial merge into data/db.json  (upsert by (source, sourceId), then cleanup > 7d)
        │
        ▼
git commit + push  ──►  Next.js app reads db.json per request (read-only)`}
          </pre>
          <p className="text-muted-foreground">
            One unified <code className="font-mono">Job</code> schema regardless of source; every record keeps
            the untouched API payload in <code className="font-mono">raw</code>. The frontend cannot trigger
            scraping — there is no write path from the browser.
          </p>
        </div>
      </Section>

      <Section title="Runbook">
        <KvTable rows={RUNBOOK} mono />
      </Section>

      <Section title="Troubleshooting">
        <KvTable rows={TROUBLESHOOTING} />
      </Section>

      <Section title="Decisions log">
        <KvTable rows={DECISIONS} />
      </Section>
    </div>
  );
}
