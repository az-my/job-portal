"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  FileJson,
  MapPin,
  Search,
  SearchX,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceBadge } from "@/components/SourceBadge";
import { sourceColor, sourceLabel } from "@/lib/sources";
import type { Job } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardProps {
  initialJobs: Job[];
}

type JsonRecord = Record<string, unknown>;

interface DeallsDetailResponse {
  code?: number;
  data?: { result?: JsonRecord };
  error?: string;
}

interface ExploreMeta {
  workSetup: string[];
  category: string;
  highlights: string[];
  signals: string[];
  verified: boolean;
  sponsored: boolean;
}

const SOURCES = ["jobstreet", "dealls", "kalibrr", "glints"] as const;
const PAGE_SIZE = 12;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDate(value: string): string {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function parseRaw(job: Job): JsonRecord {
  if (!job.raw) return {};
  try {
    return asRecord(JSON.parse(job.raw));
  } catch {
    return {};
  }
}

function deallsSlug(job: Job): string {
  if (job.source !== "dealls") return "";
  const rawSlug = text(parseRaw(job).slug);
  if (rawSlug) return rawSlug;
  if (!job.url) return "";
  try {
    return new URL(job.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return "";
  }
}

function plainHtml(value: unknown): string {
  return text(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function exploreMeta(job: Job): ExploreMeta {
  const raw = parseRaw(job);

  if (job.source === "jobstreet") {
    const workTypes = Array.isArray(raw.workTypes) ? raw.workTypes.map(text).filter(Boolean) : [];
    const arrangement = text(asRecord(raw.workArrangements).displayText);
    const classifications = Array.isArray(raw.classifications)
      ? raw.classifications
        .map((item) => text(asRecord(asRecord(item).classification).description))
        .filter(Boolean)
      : [];
    const tags = Array.isArray(raw.tags)
      ? raw.tags.map((item) => text(asRecord(item).label)).filter(Boolean)
      : [];
    const bulletPoints = Array.isArray(raw.bulletPoints)
      ? raw.bulletPoints.map(text).filter(Boolean)
      : [];

    return {
      workSetup: [...workTypes, arrangement].filter(Boolean),
      category: classifications[0] || "",
      highlights: bulletPoints.slice(0, 2),
      signals: tags.slice(0, 2),
      verified: false,
      sponsored: false,
    };
  }

  if (job.source === "dealls") {
    const employmentTypes = Array.isArray(raw.employmentTypes)
      ? raw.employmentTypes.map(text).filter(Boolean).map(humanize)
      : [];
    const workplace = text(raw.workplaceType);
    const skills = Array.isArray(raw.skills)
      ? raw.skills.map((item) => text(asRecord(item).name)).filter(Boolean)
      : [];
    const company = asRecord(raw.company);
    const signals = [
      raw.urgentlyNeeded === true ? "Urgent" : "",
      raw.thereAreStillFewApplicants === true ? "Few applicants" : "",
    ].filter(Boolean) as string[];

    return {
      workSetup: [...employmentTypes, workplace ? humanize(workplace) : ""].filter(Boolean),
      category: text(raw.jobRoleCategorySlug) ? humanize(text(raw.jobRoleCategorySlug)) : "",
      highlights: skills.slice(0, 2),
      signals,
      verified: company.verified === true,
      sponsored: raw.boosted === true,
    };
  }

  return { workSetup: [humanize(job.type)], category: "", highlights: [], signals: [], verified: false, sponsored: false };
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border bg-muted/45 px-2.5 py-1 text-sm font-semibold text-foreground/80">
      {children}
    </span>
  );
}

function ExploreJobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const meta = exploreMeta(job);
  const sourceHue = sourceColor(job.source);

  return (
    <Card
      className="min-h-[23rem] gap-0 border-t-4 py-0 transition-colors hover:bg-muted/20"
      style={{ borderTopColor: sourceHue }}
    >
      <CardHeader className="gap-4 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {job.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.logoUrl} alt="" className="size-12 shrink-0 rounded-lg border bg-white object-contain p-1.5" loading="lazy" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-lg text-base font-bold" style={{ color: sourceHue, background: `color-mix(in srgb, ${sourceHue} 12%, transparent)` }}>
                {job.company.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-base font-bold">
                <span className="truncate">{job.company}</span>
                {meta.verified && <CheckCircle2 className="size-4 shrink-0 text-mint" aria-label="Verified company" />}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {meta.sponsored && <MetaChip>Sponsored</MetaChip>}
            <SourceBadge source={job.source} />
          </div>
        </div>

        <CardTitle className="text-xl font-bold leading-snug">
          <button type="button" onClick={onOpen} className="cursor-pointer text-left outline-none hover:text-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50">
            {job.title}
          </button>
        </CardTitle>
        {meta.category && <p className="text-sm font-semibold text-muted-foreground">{meta.category}</p>}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 px-5 pb-5">
        <div className="grid gap-3 text-base">
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2">{job.location || "Location not provided"}</span>
          </div>
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <BriefcaseBusiness className="mt-0.5 size-4 shrink-0" />
            <span>{meta.workSetup.join(" · ") || humanize(job.type)}</span>
          </div>
        </div>

        {meta.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Skills and highlights">
            {meta.highlights.map((highlight) => <MetaChip key={highlight}>{highlight}</MetaChip>)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" />{timeAgo(job.createdAt)}</span>
          {meta.signals.map((signal) => <MetaChip key={signal}>{signal}</MetaChip>)}
        </div>

        <div className="mt-auto border-t pt-4">
          <p className={`text-lg font-bold ${job.salary ? "font-mono text-mint" : "text-foreground"}`}>
            {job.salary || "Salary not disclosed"}
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 bg-muted/35 px-5 py-3">
        <Button variant="outline" size="sm" onClick={onOpen}>View details</Button>
        {job.url && (
          <Button
            variant="ghost"
            size="sm"
            render={<a href={job.url} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            Open listing <ExternalLink className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function SourceSummary({ jobs }: { jobs: Job[] }) {
  const stats = useMemo(() => SOURCES.map((source) => {
    const sourceJobs = jobs.filter((job) => job.source === source);
    const newest = sourceJobs.reduce((latest, job) => job.createdAt > latest ? job.createdAt : latest, "");
    return { source, count: sourceJobs.length, newest };
  }), [jobs]);

  return (
    <div className="mb-5 grid grid-cols-2 border-y border-border lg:grid-cols-4">
      {stats.map(({ source, count, newest }, index) => (
        <div
          key={source}
          className={`min-h-24 px-4 py-4 ${index % 2 ? "border-l" : ""} lg:border-l lg:first:border-l-0`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: sourceColor(source) }} />
            {sourceLabel(source)}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{count}</span>
            <span className="text-sm text-muted-foreground">{newest ? `latest ${timeAgo(newest)}` : "awaiting import"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-border pl-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold" title={value}>{value || "Not provided"}</div>
    </div>
  );
}

function JobDetailDialog({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (value: boolean) => void }) {
  const [deallsResult, setDeallsResult] = useState<{ slug: string; payload: DeallsDetailResponse } | null>(null);
  const [deallsFailure, setDeallsFailure] = useState<{ slug: string; message: string } | null>(null);
  const slug = deallsSlug(job);
  const deallsDetail = deallsResult?.slug === slug ? deallsResult.payload : null;
  const deallsError = deallsFailure?.slug === slug ? deallsFailure.message : "";
  const deallsLoading = job.source === "dealls" && Boolean(slug) && !deallsDetail && !deallsError;

  useEffect(() => {
    if (!open || job.source !== "dealls" || !slug) return;
    const controller = new AbortController();

    fetch(`/api/jobs/dealls/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as DeallsDetailResponse;
        if (!response.ok) throw new Error(payload.error || `Detail request failed (${response.status})`);
        setDeallsResult({ slug, payload });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setDeallsFailure({ slug, message: error.message });
        }
      });

    return () => controller.abort();
  }, [job.source, open, slug]);

  const raw = parseRaw(job);
  const deallsJob = asRecord(deallsDetail?.data?.result);
  const details = asRecord(raw._details);
  const detailJob = asRecord(details.job);
  const products = asRecord(detailJob.products);
  const branding = asRecord(products.branding);
  const companyProfile = asRecord(details.companyProfile);
  const overview = asRecord(companyProfile.overview);
  const companyDescription = asRecord(overview.description);
  const rating = asRecord(asRecord(companyProfile.reviewsSummary).overallRating);
  const jobstreetQuestions = Array.isArray(asRecord(products.questionnaire).questions)
    ? asRecord(products.questionnaire).questions as unknown[]
    : [];
  const questions = job.source === "dealls" && Array.isArray(deallsJob.preScreeningQuestions)
    ? deallsJob.preScreeningQuestions
    : jobstreetQuestions;
  const bullets = Array.isArray(products.bullets) ? products.bullets as unknown[] : [];
  const expiry = text(asRecord(detailJob.expiresAt).dateTimeUtc);
  const status = text(deallsJob.status) || text(detailJob.status);
  const cover = text(asRecord(branding.cover).url);
  const profileParagraphs = Array.isArray(companyDescription.paragraphs)
    ? companyDescription.paragraphs.map(text).filter(Boolean)
    : [];
  const deallsLocation = asRecord(deallsJob.location);
  const deallsCompany = asRecord(deallsJob.company);
  const salaryRange = asRecord(deallsJob.salaryRange);
  const salaryText = salaryRange.start || salaryRange.end
    ? [salaryRange.start, salaryRange.end].filter(Boolean).map((value) => `Rp${Number(value).toLocaleString("id-ID")}`).join(" – ")
    : job.salary;
  const detailDescription = plainHtml(deallsJob.responsibilities) || job.description;
  const detailRequirements = plainHtml(deallsJob.requirements) || job.requirements || "";
  const detailLocation = text(asRecord(deallsLocation.city).name) || job.location;
  const detailWorkType = Array.isArray(deallsJob.employmentTypes)
    ? deallsJob.employmentTypes.map(text).filter(Boolean).join(", ")
    : job.type;
  const evidence = job.source === "dealls"
    ? (deallsDetail ?? { message: deallsLoading ? "Loading on-demand detail" : "On-demand detail unavailable" })
    : raw;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl gap-0 overflow-hidden p-0">
        {cover && (
          <div className="h-28 w-full overflow-hidden border-b bg-muted sm:h-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <DialogHeader className="border-b px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-start gap-3">
            {job.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.logoUrl} alt="" className="size-12 shrink-0 rounded-md border bg-white object-contain p-1" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted font-semibold">
                {job.company.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <SourceBadge source={job.source} />
                {status && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-mint">
                    <CheckCircle2 className="size-3.5" />{status}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl leading-tight sm:text-2xl">{job.title}</DialogTitle>
              <DialogDescription className="mt-1 text-base">{job.company}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="min-h-0 gap-0">
          <div className="flex items-center justify-between border-b px-5 sm:px-6">
            <TabsList variant="line" className="h-11">
              <TabsTrigger value="overview" className="px-3">Overview</TabsTrigger>
              <TabsTrigger value="company" className="px-3">Company</TabsTrigger>
              <TabsTrigger value="evidence" className="px-3">Raw JSON</TabsTrigger>
            </TabsList>
            {job.url && (
              <Button render={<a href={job.url} target="_blank" rel="noopener noreferrer" />} nativeButton={false} size="sm">
                Open listing <ExternalLink className="size-4" />
              </Button>
            )}
          </div>

          <div className="max-h-[68vh] overflow-y-auto">
            {job.source === "dealls" && deallsLoading && (
              <div className="border-b bg-muted/35 px-5 py-2 text-xs text-muted-foreground sm:px-6">Loading fresh Dealls details…</div>
            )}
            {job.source === "dealls" && deallsError && (
              <div className="border-b bg-destructive/10 px-5 py-2 text-xs text-destructive sm:px-6">{deallsError}. Showing stored listing data.</div>
            )}
            <TabsContent value="overview" className="m-0">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="px-5 py-5 sm:px-6">
                  <div className="grid grid-cols-2 gap-4 border-b pb-5 sm:grid-cols-4">
                    <Fact icon={MapPin} label="Location" value={detailLocation} />
                    <Fact icon={BriefcaseBusiness} label="Work type" value={detailWorkType} />
                    <Fact icon={CircleDollarSign} label="Compensation" value={salaryText} />
                    <Fact icon={CalendarClock} label="Posted" value={timeAgo(job.createdAt)} />
                  </div>

                  <section className="py-6">
                    <h2 className="text-base font-bold">Role description</h2>
                    <p className="mt-3 max-w-4xl whitespace-pre-line text-base leading-7 text-foreground/85">
                      {detailDescription || "No description was returned by the source."}
                    </p>
                  </section>

                  {(bullets.length > 0 || detailRequirements) && (
                    <section className="border-t py-6">
                      <h2 className="text-base font-bold">Highlights and requirements</h2>
                      {bullets.length > 0 && (
                        <ul className="mt-3 grid gap-2 text-base leading-7">
                          {bullets.map((bullet, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-mint" />{text(bullet)}</li>)}
                        </ul>
                      )}
                      {detailRequirements && <p className="mt-3 whitespace-pre-line text-base leading-7 text-muted-foreground">{detailRequirements}</p>}
                    </section>
                  )}
                </div>

                <aside className="border-t bg-muted/35 px-5 py-5 lg:border-l lg:border-t-0">
                  <h2 className="text-xs font-semibold uppercase text-muted-foreground">Listing intelligence</h2>
                  <dl className="mt-4 grid gap-4 text-base">
                    <div><dt className="text-muted-foreground">Published</dt><dd className="mt-1 font-medium">{formatDate(job.createdAt)}</dd></div>
                    <div><dt className="text-muted-foreground">Expires</dt><dd className="mt-1 font-medium">{formatDate(expiry)}</dd></div>
                    <div><dt className="text-muted-foreground">Source ID</dt><dd className="mt-1 font-mono text-xs">{job.sourceId || "Not provided"}</dd></div>
                  </dl>
                  {questions.length > 0 && (
                    <div className="mt-6 border-t pt-5">
                      <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4" />Screening questions</h2>
                      <ol className="mt-3 grid gap-3 text-sm leading-5 text-muted-foreground">
                        {questions.map((question, index) => {
                          const questionRecord = asRecord(question);
                          return <li key={index}><span className="mr-2 font-mono text-xs text-foreground">{String(index + 1).padStart(2, "0")}</span>{text(questionRecord.question) || text(questionRecord.title) || text(question)}</li>;
                        })}
                      </ol>
                    </div>
                  )}
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="company" className="m-0 px-5 py-6 sm:px-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 border-b pb-5">
                  <Building2 className="size-5 text-muted-foreground" />
                  <div><h2 className="font-semibold">{text(deallsCompany.name) || text(companyProfile.name) || job.company}</h2><p className="text-sm text-muted-foreground">{text(deallsCompany.sector) || text(overview.industry) || "Industry not provided"}</p></div>
                </div>
                <div className="grid gap-5 py-5 sm:grid-cols-3">
                  <Fact icon={Building2} label="Company size" value={text(asRecord(overview.size).description) || (asRecord(deallsCompany.size).start ? `${String(asRecord(deallsCompany.size).start)}–${String(asRecord(deallsCompany.size).end || "+")}` : "")} />
                  <Fact icon={CheckCircle2} label="Reviews" value={rating.value ? `${String(rating.value)} / 5` : "Not provided"} />
                  <Fact icon={ExternalLink} label="Website" value={text(deallsCompany.website) || text(asRecord(overview.website).url)} />
                </div>
                <div className="border-t pt-5">
                  <h3 className="text-sm font-semibold">About the company</h3>
                  <div className="mt-3 grid gap-3 text-[15px] leading-7 text-foreground/80">
                    {plainHtml(deallsCompany.description) ? <p>{plainHtml(deallsCompany.description)}</p> : profileParagraphs.length ? profileParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="text-muted-foreground">No company profile was returned for this listing.</p>}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="m-0 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><FileJson className="size-4" />Untouched source response used for audit and parser debugging</div>
              <pre className="overflow-x-auto rounded-md border bg-background p-4 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
                {evidence && Object.keys(evidence).length ? JSON.stringify(evidence, null, 2) : "No raw data available"}
              </pre>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard({ initialJobs }: DashboardProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const jobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialJobs.filter((job) => {
      if (sourceFilter !== "all" && job.source !== sourceFilter) return false;
      if (!needle) return true;
      const meta = exploreMeta(job);
      return [job.title, job.company, job.location, job.salary, meta.category, ...meta.workSetup, ...meta.highlights, ...meta.signals]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [initialJobs, query, sourceFilter]);
  const pageCount = Math.ceil(jobs.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleJobs = jobs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-bold uppercase tracking-wide text-primary">Indonesia job index</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Fresh opportunities</h1>
          <p className="mt-2 text-base text-muted-foreground">Listings from the last seven days, normalized without hiding the source evidence.</p>
        </div>
        <div className="text-right"><div className="text-3xl font-bold tabular-nums">{initialJobs.length}</div><div className="text-sm font-medium text-muted-foreground">active listings</div></div>
      </div>

      <SourceSummary jobs={initialJobs} />

      <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b pb-3" role="group" aria-label="Filter jobs by source">
        {["all", ...SOURCES].map((source) => (
          <Button key={source} variant={sourceFilter === source ? "default" : "ghost"} size="sm" onClick={() => { setSourceFilter(source); setPage(0); }}>
            {source === "all" ? "All sources" : sourceLabel(source)}
          </Button>
        ))}
      </div>

      <div className="relative mb-6 max-w-2xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          placeholder="Search roles, companies, locations or skills"
          aria-label="Search jobs"
          className="h-12 bg-background pl-10 pr-11"
        />
        {query && (
          <Button variant="ghost" size="icon-sm" onClick={() => { setQuery(""); setPage(0); }} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <X className="size-4" />
          </Button>
        )}
      </div>

      {visibleJobs.length ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleJobs.map((job) => <ExploreJobCard key={`${job.source}-${job.sourceId || job.id}`} job={job} onOpen={() => setSelectedJob(job)} />)}
        </div>
      ) : initialJobs.length ? (
        <div className="rounded-xl border bg-muted/25 px-6 py-16 text-center text-base text-muted-foreground">No jobs match this search and source filter.</div>
      ) : null}

      {jobs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <p className="text-base text-muted-foreground">{jobs.length} listing{jobs.length === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <span className="min-w-24 text-center text-sm font-semibold tabular-nums text-muted-foreground">Page {safePage + 1} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {!initialJobs.length && (
        <div className="mt-8 flex items-start gap-3 border-l-2 border-primary bg-muted/40 px-4 py-3 text-sm">
          <SearchX className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><p className="font-medium">Ready for the enriched rebuild</p><p className="mt-1 text-muted-foreground">The local and Supabase datasets are empty. The next JobStreet run will collect full descriptions, salary labels, branding and screening metadata.</p></div>
        </div>
      )}

      {selectedJob && <JobDetailDialog job={selectedJob} open onOpenChange={(value) => { if (!value) setSelectedJob(null); }} />}
    </div>
  );
}
