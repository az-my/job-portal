"use client";

import { useState } from "react";
import type { Job } from "@/lib/db";
import { SourceBadge } from "@/components/SourceBadge";
import { Search, ExternalLink, Sparkles, TriangleAlert, Loader2 } from "lucide-react";

interface QueryResponse {
  q: string;
  mode: "sql" | "fallback";
  sql?: string;
  llmError?: string;
  count: number;
  rows?: Record<string, unknown>[];
  jobs?: Job[];
}

const EXAMPLES = [
  "remote frontend jobs above 5jt posted this week",
  "average salary per source",
  "top 10 companies by number of open jobs",
  "gaji di atas 8 juta di jakarta",
  "how many jobs per day per source",
];

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DynamicTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No rows returned — the SQL ran fine, the data just doesn&apos;t have a match.</p>;
  }
  const columns = Object.keys(rows[0]);
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border/60">
          {columns.map((col) => (
            <th key={col} className="px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {rows.map((row, i) => (
          <tr key={i} className="align-top transition-colors hover:bg-accent/40">
            {columns.map((col) => {
              const value = cellText(row[col]);
              const isUrl = col === "url" && value.startsWith("http");
              const isSource = col === "source" && value in { jobstreet: 1, dealls: 1, kalibrr: 1, glints: 1 };
              const isMoney = /salary|avg|average/i.test(col) && /^\d/.test(value);
              return (
                <td key={col} className="max-w-96 truncate px-3 py-2" title={value}>
                  {isUrl ? (
                    <a href={value} target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="size-4" />
                    </a>
                  ) : isSource ? (
                    <SourceBadge source={value} />
                  ) : isMoney ? (
                    <span className="font-mono text-mint">{Number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}</span>
                  ) : (
                    value
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobsTable({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No jobs match.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-border/40">
        {jobs.map((job) => (
          <tr key={job.id} className="align-top transition-colors hover:bg-accent/40">
            <td className="px-4 py-2.5">
              <div className="font-medium">{job.title}</div>
              <div className="text-xs text-muted-foreground">
                {job.company}
                {job.location ? ` · ${job.location}` : ""} · {job.type}
                {job.salary ? <span className="font-mono text-mint"> · {job.salary}</span> : ""}
              </div>
            </td>
            <td className="whitespace-nowrap px-3 py-2.5">
              <SourceBadge source={job.source} />
            </td>
            <td className="px-3 py-2.5">
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                   className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-4" />
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QueryBuilder() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(query: string) {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/query/api?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRes(await r.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="relative mb-3"
      >
        <div className="glass glow-hover flex items-center gap-2 rounded-2xl p-1.5 pl-4 focus-within:shadow-[0_0_0_1px_var(--ring),0_8px_40px_-8px_oklch(0.65_0.21_292/0.35)]">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything about the jobs data, in English or Indonesian…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Translating…" : "Query"}
          </button>
        </div>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQ(example);
              run(example);
            }}
            className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {res && (
        <div className="space-y-4">
          <section className="glass overflow-hidden rounded-xl">
            <h2 className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2.5 font-display text-sm font-semibold">
              {res.mode === "sql" ? (
                <>
                  <Sparkles className="size-4 text-primary" /> Generated SQL
                  <span className="ml-auto text-xs font-normal text-muted-foreground">read-only role · 4s timeout</span>
                </>
              ) : (
                <>
                  <TriangleAlert className="size-4 text-glints" /> Fallback keyword search
                </>
              )}
            </h2>
            {res.sql && (
              <pre className="whitespace-pre-wrap break-all bg-background/50 px-4 py-3 font-mono text-xs leading-relaxed text-cyan-glow">
                {res.sql}
              </pre>
            )}
            {res.llmError && <p className="px-4 py-2.5 text-xs text-destructive">{res.llmError}</p>}
          </section>

          <section className="glass max-h-[65vh] overflow-auto rounded-xl">
            <h2 className="sticky top-0 z-10 border-b border-border/60 bg-popover/90 px-4 py-2.5 font-display text-sm font-semibold backdrop-blur">
              {res.count} row{res.count === 1 ? "" : "s"}
            </h2>
            <div className="overflow-x-auto">
              {res.mode === "sql" ? (
                <DynamicTable rows={res.rows ?? []} />
              ) : (
                <JobsTable jobs={res.jobs ?? []} />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
