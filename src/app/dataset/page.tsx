import { getDb, type Job } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";
import { FileSpreadsheet, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dataset — Job Aggregator",
  description: "Browse and export the aggregated jobs dataset.",
};

const SCHEMA: [string, string, string][] = [
  ["id", "string", "Internal id (job-<random>) — regenerated per scrape, do not join on this"],
  ["title", "string", "Job title as posted"],
  ["company", "string", "Employer name"],
  ["location", "string", "City/region, comma-joined; empty when the source omits it"],
  ["type", "enum", "full-time | part-time | remote | contract"],
  ["salary", "string", "Display string (Rp5jt - Rp8jt, ≥ Rp2jt) or empty — not yet numeric"],
  ["source", "enum", "jobstreet | dealls | kalibrr | glints"],
  ["sourceId", "string", "The portal's own id — stable dedup key, scoped per source"],
  ["url", "string", "Link to the original posting"],
  ["logoUrl", "string", "Company logo URL or empty"],
  ["createdAt", "ISO 8601", "Real posting date from the source (drives the 7-day window)"],
  ["description", "string", "Bullet points / synthesized summary; plain text"],
  ["requirements", "string?", "Skills / qualifications / classification, comma-joined"],
  ["raw", "string", "Untouched source API payload as JSON string (JSON export only)"],
];

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : "—";
}

function Bar({ label, count, max, sub }: { label: string; count: number; max: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-5 bg-muted/40 border border-border relative">
        <div className="h-full bg-foreground/80" style={{ width: max ? `${(count / max) * 100}%` : 0 }} />
      </div>
      <span className="w-20 shrink-0 font-mono text-xs">
        {count}
        {sub ? <span className="text-muted-foreground"> {sub}</span> : null}
      </span>
    </div>
  );
}

export default function DatasetPage() {
  const db = getDb();
  const jobs = db.jobs;
  const total = jobs.length;

  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let withSalary = 0, withLocation = 0, withRequirements = 0, withLogo = 0;

  for (const job of jobs) {
    bySource[job.source ?? "manual"] = (bySource[job.source ?? "manual"] ?? 0) + 1;
    byType[job.type] = (byType[job.type] ?? 0) + 1;
    byDay[job.createdAt.slice(0, 10)] = (byDay[job.createdAt.slice(0, 10)] ?? 0) + 1;
    if (job.salary) withSalary++;
    if (job.location) withLocation++;
    if (job.requirements) withRequirements++;
    if (job.logoUrl) withLogo++;
  }

  const days = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));
  const maxSource = Math.max(0, ...Object.values(bySource));
  const maxDay = Math.max(0, ...Object.values(byDay));

  const coverage: [string, number][] = [
    ["salary", withSalary],
    ["location", withLocation],
    ["requirements", withRequirements],
    ["logo", withLogo],
  ];

  return (
    <div className="px-2 py-2 max-w-4xl">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Dataset</h1>
          </div>
          <AdminNav />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-muted-foreground">
            {total} jobs · rolling 7-day window · refreshed by the daily scrape commit
          </p>
          <div className="flex">
            <a
              href="/dataset/export?format=csv"
              className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 hover:bg-muted transition-colors"
            >
              <Download className="size-4" /> CSV
            </a>
            <a
              href="/dataset/export?format=json"
              className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 -ml-px hover:bg-muted transition-colors"
            >
              <Download className="size-4" /> JSON (full, incl. raw)
            </a>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <section className="border border-border">
          <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30">
            By source
          </h2>
          <div className="px-4 py-3 space-y-2">
            {Object.entries(bySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <Bar key={source} label={source} count={count} max={maxSource} sub={pct(count, total)} />
              ))}
          </div>
        </section>

        <section className="border border-border">
          <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30">
            By type / field coverage
          </h2>
          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {Object.entries(byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{type}</span>
                  <span className="font-mono text-xs">{count}</span>
                </div>
              ))}
            {coverage.map(([field, count]) => (
              <div key={field} className="flex justify-between">
                <span className="font-mono text-xs text-muted-foreground">has {field}</span>
                <span className="font-mono text-xs">{pct(count, total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="border border-border mb-4">
        <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30">
          Postings per day (createdAt)
        </h2>
        <div className="px-4 py-3 space-y-2">
          {days.map(([day, count]) => (
            <Bar key={day} label={day} count={count} max={maxDay} />
          ))}
        </div>
      </section>

      <section className="border border-border">
        <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30">
          Schema (CSV export omits <code className="font-mono normal-case">raw</code>)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              {SCHEMA.map(([field, type, note]) => (
                <tr key={field} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-1.5 font-mono text-xs whitespace-nowrap">{field}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{type}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
