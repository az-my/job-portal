"use client";

import { ExternalLink } from "lucide-react";
import type { Job } from "@/lib/db";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/ui/button";

export type AdminRow = Record<string, unknown> & { __job?: Job };

export function jobToAdminRow(job: Job): AdminRow {
  return {
    job: job.title,
    company: job.company,
    source: job.source ?? "",
    location: job.location,
    type: job.type,
    salary: job.salary,
    posted: job.createdAt,
    url: job.url ?? "",
    __job: job,
  };
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminDataTable({ rows, onInspect }: { rows: AdminRow[]; onInspect?: (job: Job) => void }) {
  if (!rows.length) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">No rows match the current request.</div>;
  }

  const columns = Object.keys(rows[0]).filter((column) => column !== "__job" && column !== "url");
  const hasActions = rows.some((row) => row.__job || cellText(row.url).startsWith("http"));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/35 text-sm text-muted-foreground">
          <tr>
            {columns.map((column) => <th key={column} className="px-3 py-2.5 font-semibold">{column}</th>)}
            {hasActions && <th className="px-3 py-2.5 text-right font-semibold">actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row, index) => (
            <tr key={row.__job ? `${row.__job.source}-${row.__job.sourceId || row.__job.id}` : index} className="align-top transition-colors hover:bg-accent/35">
              {columns.map((column) => {
                const value = cellText(row[column]);
                const isSource = column === "source" && ["jobstreet", "dealls", "kalibrr", "glints"].includes(value);
                const isMoney = /salary|avg|average/i.test(column) && /^\d/.test(value);
                const isDate = /posted|date|created/i.test(column) && /^\d{4}-\d{2}-\d{2}/.test(value);
                return (
                  <td key={column} className="max-w-96 truncate px-3 py-3" title={value}>
                    {isSource ? <SourceBadge source={value} />
                      : isMoney ? <span className="font-mono text-mint">{Number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}</span>
                      : isDate ? displayDate(value)
                      : value || "—"}
                  </td>
                );
              })}
              {hasActions && (
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {row.__job && onInspect && <Button variant="outline" size="sm" onClick={() => onInspect(row.__job!)}>Inspect</Button>}
                  {cellText(row.url).startsWith("http") && (
                    <Button variant="ghost" size="icon-sm" render={<a href={cellText(row.url)} target="_blank" rel="noopener noreferrer" />} nativeButton={false} aria-label="Open listing">
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
