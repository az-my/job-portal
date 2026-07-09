"use client";

import { useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { SourceBadge } from "@/components/SourceBadge";
import { sourceColor, sourceLabel } from "@/lib/sources";
import type { Job } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExternalLink, Eye, FileJson, Columns2 } from "lucide-react";

interface DashboardProps {
  initialJobs: Job[];
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function PulseStrip({ jobs }: { jobs: Job[] }) {
  const stats = useMemo(() => {
    const by: Record<string, { count: number; newest: string }> = {};
    for (const job of jobs) {
      const s = job.source ?? "manual";
      const cur = (by[s] ??= { count: 0, newest: job.createdAt });
      cur.count++;
      if (job.createdAt > cur.newest) cur.newest = job.createdAt;
    }
    return Object.entries(by).sort(([, a], [, b]) => b.count - a.count);
  }, [jobs]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([source, s]) => {
        const color = sourceColor(source);
        return (
          <div
            key={source}
            className="glass glow-hover rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="size-2 rounded-full" style={{ background: color }} />
              {sourceLabel(source)}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{s.count}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              fresh listings · newest {timeAgo(s.newest)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobDetailDialog({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [tab, setTab] = useState<"fields" | "raw">("fields");

  const fields: [string, string | undefined][] = [
    ["Title", job.title],
    ["Company", job.company],
    ["Location", job.location],
    ["Type", job.type],
    ["Salary", job.salary],
    ["Description", job.description],
    ["Requirements", job.requirements],
    ["Source", job.source],
    ["Source ID", job.sourceId],
    ["Posted", new Date(job.createdAt).toLocaleString()],
    ["URL", job.url],
    ["Logo URL", job.logoUrl],
  ];

  let parsedRaw: object | string | null = null;
  if (job.raw) {
    try { parsedRaw = JSON.parse(job.raw); } catch { parsedRaw = job.raw; }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl glass">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="font-display">{job.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                {job.company} {job.location ? `· ${job.location}` : ""}
                <SourceBadge source={job.source} />
              </DialogDescription>
            </div>
            <div className="flex gap-1">
              <Button variant={tab === "fields" ? "default" : "outline"} size="sm" onClick={() => setTab("fields")}>
                <Columns2 className="size-4" />
              </Button>
              <Button variant={tab === "raw" ? "default" : "outline"} size="sm" onClick={() => setTab("raw")}>
                <FileJson className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-auto">
          {tab === "fields" ? (
            <div className="grid gap-3 pr-2">
              {fields.map(([label, value]) =>
                value ? (
                  <div key={label} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    {label === "URL" || label === "Logo URL" ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-glow underline-offset-2 hover:underline">{value}</a>
                    ) : label === "Salary" ? (
                      <span className="font-mono text-mint">{value}</span>
                    ) : (
                      <span>{value}</span>
                    )}
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <pre className="rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs whitespace-pre-wrap break-all">
              {parsedRaw ? JSON.stringify(parsedRaw, null, 2) : "No raw data available"}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard({ initialJobs }: DashboardProps) {
  const jobs = initialJobs;
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const columns: ColumnDef<Job>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            {row.original.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.logoUrl}
                alt=""
                className="size-7 shrink-0 rounded-md bg-muted object-contain ring-1 ring-border/60"
                loading="lazy"
              />
            ) : (
              <span
                className="grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold"
                style={{
                  color: sourceColor(row.original.source),
                  background: `color-mix(in oklch, ${sourceColor(row.original.source)} 15%, transparent)`,
                }}
              >
                {row.original.company.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium">{row.getValue("title")}</div>
              <div className="truncate text-xs text-muted-foreground">{row.original.company}</div>
            </div>
          </div>
        ),
      },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "salary",
        header: "Salary",
        cell: ({ row }) =>
          row.getValue("salary") ? (
            <span className="font-mono text-sm text-mint">{row.getValue("salary")}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <SourceBadge source={row.original.source} />,
      },
      {
        accessorKey: "createdAt",
        header: "Posted",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{timeAgo(row.getValue("createdAt"))}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setSelectedJob(row.original)}>
              <Eye className="size-4" />
            </Button>
            {row.original.url && (
              <a
                href={row.original.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Fresh job listings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {jobs.length} listings posted in the last 7 days across four boards, deduped and refreshed daily.
        </p>
      </div>

      <PulseStrip jobs={jobs} />

      <div className="glass rounded-lg p-3">
        <DataTable columns={columns} data={jobs} searchKey="title" searchPlaceholder="Search title or company…" pageSize={25} />
      </div>

      {selectedJob && (
        <JobDetailDialog job={selectedJob} open={!!selectedJob} onOpenChange={(v) => { if (!v) setSelectedJob(null); }} />
      )}
    </div>
  );
}
