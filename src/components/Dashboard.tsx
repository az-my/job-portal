"use client";

import { useState, useMemo, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import type { Job } from "@/lib/db";
import { getJobs, scrapeJobStreetAction } from "@/app/actions";
import { Briefcase, ExternalLink, RefreshCw } from "lucide-react";

interface DashboardProps {
  initialJobs: Job[];
}

export default function Dashboard({ initialJobs }: DashboardProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [scraping, startScrape] = useTransition();
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const scrapeCount = jobs.filter((j) => j.source).length;
  const totalCount = jobs.length;

  const handleScrape = () => {
    startScrape(async () => {
      try {
        const res = await scrapeJobStreetAction(10);
        if (res.success) {
          const updated = await getJobs();
          setJobs(updated);
          setStatus({ text: `Imported ${res.count} jobs from JobStreet` });
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
            <span className="text-xs uppercase tracking-wider text-zinc-500">{s}</span>
          ) : (
            <span className="text-xs text-zinc-300">manual</span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Posted",
        cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleDateString(),
      },
      {
        id: "link",
        header: "",
        cell: ({ row }) => {
          const url = row.original.url;
          return url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
            >
              source <ExternalLink className="size-3" />
            </a>
          ) : null;
        },
      },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 border-b border-zinc-900 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5" />
            <h1 className="text-sm font-bold uppercase tracking-widest">Job Aggregator</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>{totalCount} jobs</span>
            {scrapeCount > 0 && <span>{scrapeCount} scraped</span>}
            <Button size="xs" variant="outline" onClick={handleScrape} disabled={scraping}>
              <RefreshCw className={`size-3 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Scraping..." : "Scrape"}
            </Button>
          </div>
        </div>
      </header>

      {status && (
        <div
          className={`mb-4 border px-3 py-2 text-xs ${
            status.error
              ? "border-zinc-900 bg-red-50 text-red-700"
              : "border-zinc-900 bg-zinc-50 text-zinc-700"
          }`}
        >
          {status.text}
        </div>
      )}

      <DataTable columns={columns} data={jobs} searchKey="title" searchPlaceholder="Search jobs..." pageSize={25} />
    </div>
  );
}
