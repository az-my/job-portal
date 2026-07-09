import { getJobs } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SourceBadge } from "@/components/SourceBadge";
import { sourceColor } from "@/lib/sources";
import { FileSpreadsheet, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dataset — KerjaRadar",
  description: "Browse and export the aggregated jobs dataset.",
};

const SCHEMA: [string, string, string][] = [
  ["id", "string", "Internal id (job-<random>) — regenerated per scrape, do not join on this"],
  ["title", "string", "Job title as posted"],
  ["company", "string", "Employer name"],
  ["location", "string", "City/region, comma-joined; empty when the source omits it"],
  ["type", "enum", "full-time | part-time | remote | contract"],
  ["salary", "string", "Display string (Rp5jt - Rp8jt) or empty; numeric bounds live in salaryMin/salaryMax"],
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

function SourceBar({ source, count, max, sub }: { source: string; count: number; max: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0">
        <SourceBadge source={source} />
      </span>
      <div className="flex-1 h-5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: max ? `${(count / max) * 100}%` : 0, background: sourceColor(source) }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs text-mint">
        {count}
        {sub ? <span className="text-muted-foreground"> {sub}</span> : null}
      </span>
    </div>
  );
}

function DayBar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-glow"
          style={{ width: max ? `${(count / max) * 100}%` : 0 }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs text-mint">{count}</span>
    </div>
  );
}

export default async function DatasetPage() {
  const jobs = await getJobs();
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
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> Dataset
          </span>
        }
        description={`${total} jobs · rolling 7-day window · refreshed by the daily scrape commit`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/dataset/export?format=csv"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ring-1 ring-border hover:bg-accent transition-colors"
            >
              <Download className="size-4" /> CSV
            </a>
            <a
              href="/dataset/export?format=json"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ring-1 ring-border hover:bg-accent transition-colors"
            >
              <Download className="size-4" /> JSON (full, incl. raw)
            </a>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <section className="glass rounded-xl overflow-hidden">
          <h2 className="font-display text-sm font-semibold text-muted-foreground px-5 pt-4">By source</h2>
          <div className="px-5 py-4 space-y-2.5">
            {Object.entries(bySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <SourceBar key={source} source={source} count={count} max={maxSource} sub={pct(count, total)} />
              ))}
          </div>
        </section>

        <section className="glass rounded-xl overflow-hidden">
          <h2 className="font-display text-sm font-semibold text-muted-foreground px-5 pt-4">
            By type / field coverage
          </h2>
          <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{type}</span>
                  <span className="font-mono text-xs text-mint">{count}</span>
                </div>
              ))}
            {coverage.map(([field, count]) => (
              <div key={field} className="flex justify-between">
                <span className="font-mono text-xs text-muted-foreground">has {field}</span>
                <span className="font-mono text-xs text-mint">{pct(count, total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass rounded-xl overflow-hidden mb-4">
        <h2 className="font-display text-sm font-semibold text-muted-foreground px-5 pt-4">
          Postings per day (createdAt)
        </h2>
        <div className="px-5 py-4 space-y-2.5">
          {days.map(([day, count]) => (
            <DayBar key={day} label={day} count={count} max={maxDay} />
          ))}
        </div>
      </section>

      <section className="glass rounded-xl overflow-hidden">
        <h2 className="font-display text-sm font-semibold text-muted-foreground px-5 pt-4">
          Schema (CSV export omits <code className="font-mono">raw</code>)
        </h2>
        <div className="overflow-x-auto px-2 pb-2 pt-3">
          <table className="w-full text-left">
            <tbody className="divide-y divide-border/60">
              {SCHEMA.map(([field, type, note]) => (
                <tr key={field} className="hover:bg-accent/40 transition-colors">
                  <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap text-primary">{field}</td>
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
