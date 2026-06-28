"use client";

import { useState, useMemo, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { Job } from "@/lib/db";
import { getJobs, scrapeAllAction } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Briefcase, ExternalLink, RefreshCw, Eye, FileJson, Columns2 } from "lucide-react";

interface DashboardProps {
  initialJobs: Job[];
}

function JobDetailDialog({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [tab, setTab] = useState<"fields" | "raw">("fields");

  const fields: [string, string | undefined][] = [
    ["Title", job.title],
    ["ID", job.id],
    ["Company", job.company],
    ["Location", job.location],
    ["Type", job.type],
    ["Salary", job.salary],
    ["Description", job.description],
    ["Requirements", job.requirements],
    ["Source", job.source],
    ["Source ID", job.sourceId],
    ["Posted By", job.postedBy],
    ["Created At", new Date(job.createdAt).toLocaleString()],
    ["URL", job.url],
    ["Logo URL", job.logoUrl],
  ];

  let parsedRaw: object | string | null = null;
  if (job.raw) {
    try { parsedRaw = JSON.parse(job.raw); } catch { parsedRaw = job.raw; }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>{job.title}</DialogTitle>
              <DialogDescription>{job.company} &middot; {job.location}</DialogDescription>
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
                  <div key={label} className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-medium text-muted-foreground">{label}</span>
                    {label === "URL" || label === "Logo URL" ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground break-all">{value}</a>
                    ) : (
                      <span>{value}</span>
                    )}
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <pre className="bg-muted p-3 rounded-md text-base whitespace-pre-wrap break-all">
              {parsedRaw ? JSON.stringify(parsedRaw, null, 2) : "No raw data available"}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard({ initialJobs }: DashboardProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [scraping, startScrape] = useTransition();
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const scrapeCount = jobs.filter((j) => j.source).length;
  const totalCount = jobs.length;

  const handleScrape = () => {
    startScrape(async () => {
      try {
        const res = await scrapeAllAction(5);
        if (res.success) {
          const updated = await getJobs();
          setJobs(updated);
          setStatus({ text: `Imported ${res.count} jobs (all sources)` });
        } else {
          setStatus({ text: "error" in res ? String(res.error) : "Scrape failed", error: true });
        }
      } catch {
        setStatus({ text: "Scrape failed", error: true });
      }
      setTimeout(() => setStatus(null), 5000);
    });
  };

  const columns: ColumnDef<Job>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("title")}</span>
        ),
      },
      { accessorKey: "company", header: "Company", enableSorting: true },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "salary",
        header: "Salary",
        cell: ({ row }) => row.getValue("salary") || "—",
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const s = row.getValue("source") as string | undefined;
          return s ? (
            <span className="uppercase tracking-wider text-muted-foreground">{s}</span>
          ) : (
            <span className="text-muted-foreground">manual</span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Posted",
        cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleDateString("en-CA"),
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
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
    <div className="px-2 py-2">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Job Aggregator</h1>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>{totalCount} jobs</span>
            {scrapeCount > 0 && <span>{scrapeCount} scraped</span>}
            <Button variant="outline" onClick={handleScrape} disabled={scraping}>
              <RefreshCw className={`size-4 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Scraping..." : "Scrape"}
            </Button>
          </div>
        </div>
      </header>

      {status && (
        <div
          className={`mb-4 border border-border px-3 py-2 ${
            status.error
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground"
          }`}
        >
          {status.text}
        </div>
      )}

      <DataTable columns={columns} data={jobs} searchKey="title" searchPlaceholder="Search jobs..." pageSize={25} />

      {selectedJob && (
        <JobDetailDialog job={selectedJob} open={!!selectedJob} onOpenChange={(v) => { if (!v) setSelectedJob(null); }} />
      )}
    </div>
  );
}
