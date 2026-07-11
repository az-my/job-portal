"use client";

import { useState } from "react";
import type { Job } from "@/lib/db";
import { ChevronDown, ChevronUp, Loader2, Search, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface QueryResponse {
  q: string;
  mode: "filter" | "sql" | "fallback";
  sql?: string;
  llmError?: string;
  count: number;
  jobs?: Job[];
}

const EXAMPLES = [
  "Tampilkan lowongan marketing full-time di Cikarang dengan info gaji",
  "Cari lowongan admin",
  "Tampilkan lowongan accounting di Tangerang Selatan",
  "Cari lowongan perhotelan di Bandung",
  "Tampilkan lowongan full-time di Bali dengan info gaji",
  "Cari lowongan guru di Jakarta Selatan",
  "Cari lowongan manajer HR dengan gaji di atas 20 juta",
  "Cari lowongan manajer produksi di Jakarta",
  "Tampilkan lowongan apoteker di Yogyakarta",
  "Cari lowongan sopir di Banten",
  "Cari lowongan desainer interior di Jakarta Selatan",
  "Tampilkan lowongan full-time terbaru dengan info gaji",
];

export function QueryBuilder({ onResult, onReset }: { onResult?: (result: QueryResponse) => void; onReset?: () => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  async function run(query: string) {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const result: QueryResponse = await r.json();
      setRes(result);
      onResult?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQ("");
    setRes(null);
    setError(null);
    onReset?.();
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="mb-2"
      >
        <div className="flex items-center gap-2 rounded-xl border bg-background p-1 pl-3 focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Describe the job you want, in English or Indonesian…"
            aria-label="Describe the job you want"
            className="h-11 w-full border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
          />
          {(q || res) && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={reset} className="shrink-0 text-muted-foreground" aria-label="Reset job search" title="Reset search">
              <X className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="h-11 shrink-0 px-4 text-base"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Searching…" : "Search jobs"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggested job searches">
        <span className="mr-1 text-base font-medium text-muted-foreground">Try:</span>
        {EXAMPLES.filter((example) => example !== q).slice(0, showMore ? EXAMPLES.length : 4).map((example) => (
          <Button
            key={example}
            type="button"
            onClick={() => {
              setQ(example);
              run(example);
            }}
            variant="ghost"
            className="h-auto rounded-full bg-muted/50 px-3 py-1.5 text-base text-muted-foreground"
          >
            {example}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={() => setShowMore((value) => !value)} className="h-auto px-2 py-1.5 text-base font-semibold text-primary">
          {showMore ? <>Less <ChevronUp className="size-3.5" /></> : <>More suggestions <ChevronDown className="size-3.5" /></>}
        </Button>
      </div>

      {error && (
        <div className="mt-2 text-base text-destructive">
          {error}
        </div>
      )}

      {res && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
          {res.mode === "fallback" && <TriangleAlert className="size-3.5 text-glints" />}
          <span className="font-semibold text-foreground">{res.count} matching job{res.count === 1 ? "" : "s"}</span>
          <span aria-hidden>·</span>
          <span>{res.mode === "fallback" ? "Basic keyword matches" : "Filters applied"}</span>
          {res.llmError && <span>· {res.llmError}</span>}
          <Button type="button" variant="link" onClick={reset} className="h-auto p-0 text-base font-semibold">Reset</Button>
        </div>
      )}
    </div>
  );
}
