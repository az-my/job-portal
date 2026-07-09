"use client";

import { useState } from "react";
import type { Job } from "@/lib/db";
import { Search, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";

interface QueryResponse {
  q: string;
  usedLLM: boolean;
  llmError: string | null;
  filter: Record<string, unknown>;
  count: number;
  jobs: Job[];
}

const EXAMPLES = [
  "remote frontend jobs above 5jt posted this week",
  "gaji di atas 8 juta di jakarta",
  "internship from glints posted in the last 3 days",
  "data engineer kalibrr atau dealls",
];

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
        className="flex mb-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe the jobs you want, in English or Indonesian…"
          className="flex-1 border border-border bg-transparent px-3 py-2 outline-none focus:bg-muted/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 border border-border -ml-px px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Search className={`size-4 ${loading ? "animate-pulse" : ""}`} />
          {loading ? "Translating…" : "Query"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-6 text-muted-foreground">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQ(example);
              run(example);
            }}
            className="border border-border px-2 py-0.5 text-xs hover:bg-muted hover:text-foreground transition-colors"
          >
            {example}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-border bg-destructive/10 text-destructive px-3 py-2 mb-4">{error}</div>
      )}

      {res && (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(280px,1fr)_2fr] mb-4">
            <section className="border border-border">
              <h2 className="border-b border-border px-3 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30 flex items-center gap-1.5">
                {res.usedLLM ? <Sparkles className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
                {res.usedLLM ? "Gemini filter" : "Fallback keyword filter"}
              </h2>
              <pre className="px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                {JSON.stringify(res.filter, null, 2)}
              </pre>
              {res.llmError && (
                <p className="px-3 pb-2 text-xs text-destructive">{res.llmError}</p>
              )}
            </section>

            <section className="border border-border overflow-auto max-h-[60vh]">
              <h2 className="border-b border-border px-3 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30 sticky top-0">
                {res.count} match{res.count === 1 ? "" : "es"}
                {res.count > res.jobs.length ? ` (showing ${res.jobs.length})` : ""}
              </h2>
              <table className="w-full text-left">
                <tbody>
                  {res.jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-b-0 align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{job.title}</div>
                        <div className="text-muted-foreground text-xs">
                          {job.company}
                          {job.location ? ` · ${job.location}` : ""} · {job.type}
                          {job.salary ? ` · ${job.salary}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        <span className="uppercase tracking-wider">{job.source}</span>
                        <span> · {new Date(job.createdAt).toLocaleDateString("en-CA")}</span>
                      </td>
                      <td className="px-3 py-2">
                        {job.url && (
                          <a href={job.url} target="_blank" rel="noopener noreferrer"
                             className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {res.jobs.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground">No jobs match this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
