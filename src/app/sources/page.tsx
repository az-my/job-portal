import { getJobs, type Job } from "@/lib/db";
import { SOURCE_INTEL, PIPELINE_NOTES } from "@/lib/source-intel";
import { PageHeader } from "@/components/PageHeader";
import { sourceColor } from "@/lib/sources";
import { Database, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Source Intel — KerjaRadar",
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
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 font-mono text-mint">{value}</div>
    </div>
  );
}

function IntelList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-primary/70 select-none">▪</span>
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
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Database className="size-5 text-primary" /> Source Intel
          </span>
        }
        description="Field notes from probing each portal's API: how to fetch the latest jobs, hard limits, error behavior, and how raw fields map into the unified Job schema. Internal / super-admin only."
        actions={
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-mono text-mint">{SOURCE_INTEL.length}</span> endpoints
            </span>
            <span>
              <span className="font-mono text-mint">{total}</span> jobs in DB
            </span>
          </div>
        }
      />

      <section className="glass rounded-xl p-5 mb-8">
        <h2 className="font-display text-sm font-semibold text-muted-foreground mb-3">
          Pipeline Rules (apply to every source)
        </h2>
        <ul className="space-y-1.5">
          {PIPELINE_NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="text-primary/70 select-none">▪</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-6">
        {SOURCE_INTEL.map((src) => {
          const s = stats[src.id];
          const hue = sourceColor(src.id);
          return (
            <section key={src.id} id={src.id} className="glass glow-hover rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold" style={{ color: hue }}>
                    {src.name}
                  </h2>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-mono">{src.method}</span>
                  <span className="text-muted-foreground text-xs">{src.kind}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{src.collector}</span>
              </div>

              <div className="px-5 py-3 border-b border-border/60">
                <code className="font-mono text-xs break-all text-muted-foreground">
                  <span style={{ color: hue }}>{src.method}</span> {src.endpoint}
                </code>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-4 border-b border-border/60">
                <StatCell label="In DB" value={s ? String(s.count) : "0"} />
                <StatCell label="Newest" value={s ? fmtDate(s.newest) : "—"} />
                <StatCell label="Oldest" value={s ? fmtDate(s.oldest) : "—"} />
                <StatCell label="Has salary" value={s ? pct(s.withSalary, s.count) : "—"} />
                <StatCell label="Has location" value={s ? pct(s.withLocation, s.count) : "—"} />
              </div>

              <div className="px-5 py-4 grid gap-6 md:grid-cols-2">
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

              <div className="px-5 pb-5">
                <h3 className="font-display text-sm font-semibold text-muted-foreground mb-2">
                  Field mapping (API → Job)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-border/60">
                      {src.fieldMap.map(([from, to]) => (
                        <tr key={from} className="hover:bg-accent/40 transition-colors">
                          <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap" style={{ color: hue }}>
                            {from}
                          </td>
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
