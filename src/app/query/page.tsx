import { AdminNav } from "@/components/AdminNav";
import { QueryBuilder } from "@/components/QueryBuilder";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Query — Job Aggregator",
  description: "Natural-language job search translated to a structured filter by Gemini.",
};

export default function QueryPage() {
  return (
    <div className="px-2 py-2 max-w-5xl">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Query Builder</h1>
          </div>
          <AdminNav />
        </div>
        <p className="mt-2 text-muted-foreground">
          Type what you want in plain language — Gemini (gemini-2.5-flash) translates it into the structured
          filter shown beside the results, then the filter runs against the local DB. One LLM call per query;
          falls back to plain keyword matching if the key is missing or the call fails.
        </p>
      </header>

      <QueryBuilder />
    </div>
  );
}
