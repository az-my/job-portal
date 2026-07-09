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
          Ask in plain language — Gemini (gemini-2.5-flash) writes a SQL SELECT, shown above the results, and
          it runs against Supabase under a read-only role with a 4s timeout. Listings and aggregations both
          work. One LLM call per query; falls back to keyword matching if translation fails.
        </p>
      </header>

      <QueryBuilder />
    </div>
  );
}
