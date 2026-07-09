import { PageHeader } from "@/components/PageHeader";
import { QueryBuilder } from "@/components/QueryBuilder";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Query — KerjaRadar",
  description: "Natural-language questions translated to SQL by Gemini and run against the jobs database.",
};

export default function QueryPage() {
  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Ask the <span className="text-gradient">data</span>
          </span>
        }
        description="Plain language in, SQL out — Gemini writes one SELECT, shown with the results, and runs it against Supabase under a read-only role with a 4s timeout. Listings and aggregations both work."
      />
      <QueryBuilder />
    </div>
  );
}
