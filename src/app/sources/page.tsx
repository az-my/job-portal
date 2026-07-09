import { getJobs, type Job } from "@/lib/db";
import { SOURCE_INTEL, PIPELINE_NOTES } from "@/lib/source-intel";
import { AdminNav } from "@/components/AdminNav";
import { Database, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Source Intel — Job Aggregator",
  description: "Endpoint findings, limitations, and field mappings for every scraped job portal.",
};

interface SourceStats {
  count: number;
  newest: string | null;
  oldest: string | null;
  withSalary: number;
  withLocation: number;
}

function computeStats(jobs: Job[]): Record<string, SourceStats> {
  const stats: Record<string, SourceStats> = {};
  for (const job of jobs) {
    const source = job.source ?? "manual";
    const s = (stats[source] ??= { count: 0, newest: null, oldest: null, withSalary: 0, withLocation: 0 });
    s.count++;
    if (!s.newest || job.createdAt > s.newest) s.newest = job.createdAt;
    if (!s.oldest || job.createdAt < s.oldest) s.oldest = job.createdAt;
    if (job.salary) s.withSalary++;
    if (job.location) s.withLocation++;
  }
  return stats;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";
}

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : "—";
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-3 py-2">
      <div className="text-muted-foreground uppercase tracking-wider text-xs">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function IntelList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="uppercase tracking-widest text-xs font-bold text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-muted-foreground select-none">▪</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SourcesPage() {
  const jobs = await getJobs();
  const stats = computeStats(jobs);
  const total = jobs.length;

  return (
    <div className="px-2 py-2 max-w-5xl">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Source Intel</h1>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>{SOURCE_INTEL.length} endpoints</span>
            <span>{total} jobs in DB</span>
            <AdminNav />
          </div>
        </div>
        <p className="mt-2 text-muted-foreground">
          Field notes from probing each portal&apos;s API: how to fetch the latest jobs, hard limits, error
          behavior, and how raw fields map into the unified Job schema. Internal / super-admin only.
        </p>
      </header>

      <section className="mb-8 border border-border p-4">
        <h2 className="uppercase tracking-widest text-xs font-bold text-muted-foreground mb-3">
          Pipeline Rules (apply to every source)
        </h2>
        <ul className="space-y-1.5">
          {PIPELINE_NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="text-muted-foreground select-none">▪</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-8">
        {SOURCE_INTEL.map((src) => {
          const s = stats[src.id];
          return (
            <section key={src.id} id={src.id} className="border border-border">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold uppercase tracking-widest">{src.name}</h2>
                  <span className="border border-border px-1.5 py-0.5 text-xs font-mono">{src.method}</span>
                  <span className="text-muted-foreground text-xs">{src.kind}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{src.collector}</span>
              </div>

              <div className="px-4 py-3 border-b border-border">
                <code className="font-mono break-all">
                  {src.method} {src.endpoint}
                </code>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-3 border-b border-border">
                <StatCell label="In DB" value={s ? String(s.count) : "0"} />
                <StatCell label="Newest" value={s ? fmtDate(s.newest) : "—"} />
                <StatCell label="Oldest" value={s ? fmtDate(s.oldest) : "—"} />
                <StatCell label="Has salary" value={s ? pct(s.withSalary, s.count) : "—"} />
                <StatCell label="Has location" value={s ? pct(s.withLocation, s.count) : "—"} />
              </div>

              <div className="px-4 py-4 grid gap-5 md:grid-cols-2">
                <div className="space-y-5">
                  <IntelList
                    title="How to get the latest jobs"
                    items={[src.freshness, `Pagination: ${src.pagination}`, `Date field: ${src.dateField}`]}
                  />
                  <IntelList title="Auth" items={[src.auth]} />
                  <IntelList title="Request notes" items={src.requestNotes} />
                </div>
                <div className="space-y-5">
                  <IntelList title="Limitations" items={src.limitations} />
                  <IntelList title="Gotchas" items={src.gotchas} />
                </div>
              </div>

              <div className="px-4 pb-4">
                <h3 className="uppercase tracking-widest text-xs font-bold text-muted-foreground mb-2">
                  Field mapping (API → Job)
                </h3>
                <div className="overflow-x-auto border border-border">
                  <table className="w-full text-left">
                    <tbody>
                      {src.fieldMap.map(([from, to]) => (
                        <tr key={from} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{from}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">→ {to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ExternalLink className="size-3.5" />
                  <span className="font-mono">{src.jobUrlPattern}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
