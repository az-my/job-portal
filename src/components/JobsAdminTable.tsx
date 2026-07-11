"use client";

import { BriefcaseBusiness, CalendarClock, ExternalLink, MapPin } from "lucide-react";
import type { Job } from "@/lib/db";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/ui/button";

export type AdminRow = Record<string, unknown> & { __job?: Job };

type TwoLineValue = { primary: string; secondary: string };

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function arrangementLabel(value?: string): string {
  if (!value) return "";
  return /^on-?site$/i.test(value) ? "On-site" : humanize(value);
}

function workSetup(job: Job): { arrangement: string; employment: string } {
  const legacyRemote = job.type === "remote";
  return {
    arrangement: arrangementLabel(job.workArrangement) || (legacyRemote ? "Remote" : "Not specified"),
    employment: legacyRemote ? "Employment type not listed" : humanize(job.type),
  };
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function displayShortDate(value: string, prefix: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${prefix} ${new Intl.DateTimeFormat("en-ID", { day: "numeric", month: "short" }).format(date)}`;
}

export function jobToAdminRow(job: Job): AdminRow {
  const setup = workSetup(job);
  const candidateProfile = [job.experience, job.education].filter(Boolean).join(" · ");
  const skills = job.skills?.slice(0, 3).join(" · ") || "Requirements in listing";
  const benefits = job.benefits?.slice(0, 2).join(" · ") || "";
  const payContext = [job.salaryPeriod ? humanize(job.salaryPeriod) : "", benefits].filter(Boolean).join(" · ");
  const timingContext = [job.expiresAt ? displayShortDate(job.expiresAt, "Closes") : "", job.urgent ? "Urgent hiring" : ""].filter(Boolean).join(" · ");
  const trustSignals = [job.verified ? "Verified" : "", job.vacancies ? `${job.vacancies} opening${job.vacancies === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  const activitySignals = [job.applicantCount != null ? `${job.applicantCount} applicants` : "", job.viewCount != null ? `${job.viewCount} views` : "", ...(job.activity || []).slice(0, 1)].filter(Boolean).join(" · ");
  return {
    role: { primary: job.title, secondary: [job.company, job.industry || job.category].filter(Boolean).join(" · ") },
    location: { primary: job.location || "Location not listed", secondary: [setup.arrangement, setup.employment].filter(Boolean).join(" · ") },
    pay: { primary: job.salary || "Not disclosed", secondary: payContext },
    requirements: { primary: candidateProfile || "Requirements in listing", secondary: skills },
    timing: { primary: displayShortDate(job.createdAt, "Posted"), secondary: timingContext },
    signals: { primary: trustSignals, secondary: activitySignals },
    url: job.url ?? "",
    __job: job,
  };
}

function isTwoLineValue(value: unknown): value is TwoLineValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.primary === "string" && typeof record.secondary === "string";
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function columnClass(column: string): string {
  if (column === "signals") return "hidden xl:table-cell";
  return column === "requirements" ? "hidden lg:table-cell" : "";
}

const COLUMN_LABELS: Record<string, string> = {
  role: "Role",
  requirements: "Requirements",
  location: "Location",
  pay: "Pay",
  timing: "Timing",
  signals: "Signals",
};

function MobileJobCard({ job, onInspect }: { job: Job; onInspect?: (job: Job) => void }) {
  const setup = workSetup(job);
  const tags = [job.experience, job.education, ...(job.skills || []).slice(0, 2)].filter(Boolean) as string[];
  return (
    <article className="px-4 py-4" aria-label={`${job.title} at ${job.company}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-semibold leading-snug">{job.title}</h3><p className="mt-1 text-base text-muted-foreground">{[job.company, job.category].filter(Boolean).join(" · ")}</p></div>
        <div className="flex shrink-0 flex-col items-end gap-1.5"><SourceBadge source={job.source} /><span className="rounded-full border bg-background px-2 py-0.5 text-base font-semibold">{setup.arrangement}</span></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-base">
        <div><span className="flex items-center gap-1.5 text-base text-muted-foreground"><MapPin className="size-3.5" />Location</span><p className="mt-1 font-medium">{job.location || "Location not listed"}</p><p className="mt-0.5 text-base text-muted-foreground">{setup.employment}</p></div>
        <div><span className="flex items-center gap-1.5 text-base text-muted-foreground"><CalendarClock className="size-3.5" />Pay & timing</span><p className="mt-1 font-mono font-semibold text-mint">{job.salary || "Not disclosed"}</p><p className="mt-0.5 text-base text-muted-foreground">{displayShortDate(job.createdAt, "Posted")}</p></div>
      </div>
      {!!job.benefits?.length && <p className="mt-3 text-base text-muted-foreground">Benefits: {job.benefits.slice(0, 2).join(" · ")}</p>}
      {!!tags.length && <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((item) => <span key={item} className="rounded-full bg-muted px-2 py-1 text-base text-muted-foreground">{item}</span>)}</div>}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <span className="flex items-center gap-1.5 text-base text-muted-foreground"><BriefcaseBusiness className="size-3.5" />{job.vacancies ? `${job.vacancies} openings` : job.expiresAt ? displayShortDate(job.expiresAt, "Closes") : "View full listing"}</span>
        <div>{onInspect && <Button variant="outline" size="sm" onClick={() => onInspect(job)} aria-label={`View details for ${job.title} at ${job.company}`}>Details</Button>}{job.url && <Button variant="ghost" size="icon-sm" render={<a href={job.url} target="_blank" rel="noopener noreferrer" />} nativeButton={false} aria-label={`Open listing for ${job.title} at ${job.company}`}><ExternalLink className="size-4" /></Button>}</div>
      </div>
    </article>
  );
}

export function AdminDataTable({ rows, onInspect }: { rows: AdminRow[]; onInspect?: (job: Job) => void }) {
  if (!rows.length) return <div className="px-4 py-10 text-center text-base text-muted-foreground">No rows match the current request.</div>;
  const columns = Object.keys(rows[0]).filter((column) => column !== "__job" && column !== "url");
  const hasActions = rows.some((row) => row.__job || cellText(row.url).startsWith("http"));

  return (
    <div>
      <div className="divide-y divide-border/60 md:hidden">{rows.map((row, index) => row.__job ? <MobileJobCard key={`${row.__job.source}-${row.__job.sourceId || row.__job.id}`} job={row.__job} onInspect={onInspect} /> : <div key={index} className="px-4 py-3 text-base">{Object.values(row).filter((value) => typeof value === "string").join(" · ")}</div>)}</div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b bg-muted/35 text-base text-muted-foreground"><tr>{columns.map((column) => <th key={column} scope="col" className={`px-3 py-2.5 font-semibold ${columnClass(column)}`}>{COLUMN_LABELS[column] || humanize(column)}</th>)}{hasActions && <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-border/60">{rows.map((row, index) => (
            <tr key={row.__job ? `${row.__job.source}-${row.__job.sourceId || row.__job.id}` : index} className="align-top transition-colors hover:bg-accent/35">
              {columns.map((column) => {
                const rawValue = row[column];
                if (isTwoLineValue(rawValue)) return <td key={column} className={`max-w-md px-3 py-3.5 ${columnClass(column)}`}>
                  {!!rawValue.primary && <div className={column === "pay" ? "font-mono font-semibold text-mint" : "font-semibold text-foreground"}>{rawValue.primary}</div>}
                  <div className={`${rawValue.primary && rawValue.secondary ? "mt-1" : ""} flex max-w-80 items-center gap-2 truncate text-base text-muted-foreground`} title={rawValue.secondary}>
                    {!!rawValue.secondary && <span className="truncate">{rawValue.secondary}</span>}
                    {column === "role" && row.__job?.source && <SourceBadge source={row.__job.source} />}
                  </div>
                </td>;
                const value = cellText(rawValue);
                const isSource = column === "source" && ["jobstreet", "dealls", "kalibrr", "glints", "pintarnya", "kitalulus"].includes(value);
                const isDate = /posted|date|created/i.test(column) && /^\d{4}-\d{2}-\d{2}/.test(value);
                return <td key={column} className={`max-w-96 truncate px-3 py-3 ${columnClass(column)}`} title={value}>{isSource ? <SourceBadge source={value} /> : isDate ? displayDate(value) : value || "—"}</td>;
              })}
              {hasActions && <td className="px-3 py-2 text-right whitespace-nowrap">{row.__job && onInspect && <Button variant="outline" size="sm" onClick={() => onInspect(row.__job!)} aria-label={`View details for ${row.__job.title} at ${row.__job.company}`}>Details</Button>}{cellText(row.url).startsWith("http") && <Button variant="ghost" size="icon-sm" render={<a href={cellText(row.url)} target="_blank" rel="noopener noreferrer" />} nativeButton={false} aria-label={row.__job ? `Open listing for ${row.__job.title} at ${row.__job.company}` : "Open listing"}><ExternalLink className="size-4" /></Button>}</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
