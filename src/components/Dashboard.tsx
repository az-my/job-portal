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
import { QueryBuilder, type QueryResponse } from "@/components/QueryBuilder";
import { AdminDataTable, jobToAdminRow } from "@/components/JobsAdminTable";

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

function kalibrrCode(job: Job): string {
  if (job.source !== "kalibrr") return "";
  const raw = parseRaw(job);
  const company = asRecord(raw.company);
  const companyInfo = asRecord(raw.company_info);
  return text(company.code) || text(companyInfo.code) || "";
}

function kalibrrSlug(job: Job): string {
  if (job.source !== "kalibrr") return "";
  const rawSlug = text(parseRaw(job).slug);
  if (rawSlug) return rawSlug;
  if (!job.url) return "";
  try {
    return new URL(job.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return "";
  }
}

function plainDraftJs(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  try {
    const parsed = JSON.parse(value) as { blocks?: Array<{ text?: string }> };
    if (!Array.isArray(parsed.blocks)) return "";
    return parsed.blocks.map((block) => block.text || "").join("\n").trim();
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

function ListingsToolbar({
  jobs,
  sourceFilter,
  onSourceChange,
  query,
  onQueryChange,
}: {
  jobs: Job[];
  sourceFilter: string;
  onSourceChange: (source: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const stats = useMemo(() => SOURCES.map((source) => {
    const sourceJobs = jobs.filter((job) => job.source === source);
    return { source, count: sourceJobs.length };
  }), [jobs]);

  return (
    <section className="mb-6 flex flex-col gap-3 border-y border-border py-3 xl:flex-row xl:items-center" aria-label="Listing filters and source status">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="group" aria-label="Filter jobs by source">
        <button
          type="button"
          onClick={() => onSourceChange("all")}
          aria-pressed={sourceFilter === "all"}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${sourceFilter === "all" ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <span>All sources</span>
          <span className="font-mono text-sm tabular-nums opacity-70">{jobs.length}</span>
        </button>
        {stats.map(({ source, count }) => (
        <button
          key={source}
          type="button"
          onClick={() => onSourceChange(source)}
          aria-pressed={sourceFilter === source}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${sourceFilter === source ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <span className="size-2 rounded-full" style={{ background: sourceColor(source) }} />
          <span>{sourceLabel(source)}</span>
          <span className="font-mono text-sm tabular-nums opacity-70">{count}</span>
        </button>
      ))}
      </div>
      <div className="relative w-full shrink-0 xl:w-96">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter roles, companies, locations or skills"
          aria-label="Filter job listings"
          className="h-11 bg-background pl-10 pr-11"
        />
        {query && (
          <Button variant="ghost" size="icon-sm" onClick={() => onQueryChange("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </section>
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

  const kalibrrId = job.source === "kalibrr" ? job.sourceId : "";
  const kalibrrCompanyCode = kalibrrCode(job);
  const kalibrrSlugValue = kalibrrSlug(job);
  const [kalibrrDetail, setKalibrrDetail] = useState<Record<string, unknown> | null>(null);
  const [kalibrrFailure, setKalibrrFailure] = useState<string | null>(null);
  const kalibrrKey = `${kalibrrId}::${kalibrrCompanyCode}::${kalibrrSlugValue}`;
  const kalibrrLoading = job.source === "kalibrr" && Boolean(kalibrrId && kalibrrCompanyCode && kalibrrSlugValue) && !kalibrrDetail && !kalibrrFailure;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    if (job.source === "dealls" && slug) {
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
    }

    if (job.source === "kalibrr" && kalibrrId && kalibrrCompanyCode && kalibrrSlugValue) {
      const params = new URLSearchParams({ companyCode: kalibrrCompanyCode, slug: kalibrrSlugValue });
      fetch(`/api/jobs/kalibrr/${encodeURIComponent(kalibrrId)}?${params}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as Record<string, unknown>;
          if (!response.ok) throw new Error((payload.error as string) || `Detail request failed (${response.status})`);
          setKalibrrDetail(payload);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name !== "AbortError") {
            setKalibrrFailure(error.message);
          }
        });
    }

    return () => controller.abort();
  }, [job.source, open, slug, kalibrrId, kalibrrCompanyCode, kalibrrSlugValue]);

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

  const kalibrrJob = job.source === "kalibrr" ? kalibrrDetail : null;
  const kalibrrDescription = plainHtml(text(asRecord(asRecord(kalibrrJob).description)));
  const kalibrrQualifications = plainHtml(text(asRecord(kalibrrJob).qualifications));
  const kalibrrCompanyObj = asRecord(asRecord(kalibrrJob).company);
  const kalibrrCompanyInfo = asRecord(asRecord(kalibrrJob).companyInfo);
  const kalibrrGoogleLocation = asRecord(asRecord(kalibrrJob).googleLocation);
  const kalibrrAddressComponents = asRecord(kalibrrGoogleLocation.addressComponents);
  const kalibrrDetailTenure = text(asRecord(kalibrrJob).tenure);
  const kalibrrDetailSalaryBase = asRecord(kalibrrJob).baseSalary as number | undefined;
  const kalibrrDetailSalaryMax = asRecord(kalibrrJob).maximumSalary as number | undefined;
  const kalibrrSalaryText = kalibrrDetailSalaryBase
    ? `Rp${Number(kalibrrDetailSalaryBase).toLocaleString("id-ID")}${kalibrrDetailSalaryMax && kalibrrDetailSalaryMax !== kalibrrDetailSalaryBase ? ` – Rp${Number(kalibrrDetailSalaryMax).toLocaleString("id-ID")}` : ""}`
    : job.salary;
  const kalibrrDetailDescription = kalibrrDescription || job.description;
  const kalibrrDetailRequirements = kalibrrQualifications || job.requirements || "";
  const kalibrrDetailLocation = kalibrrAddressComponents.city
    ? [text(kalibrrAddressComponents.city), text(kalibrrAddressComponents.region), text(kalibrrAddressComponents.country)].filter(Boolean).join(", ")
    : job.location;
  const kalibrrDetailWorkType = kalibrrDetailTenure
    ? kalibrrDetailTenure.toLowerCase().includes("part")
      ? "part-time"
      : kalibrrDetailTenure.toLowerCase().includes("contract") || kalibrrDetailTenure.toLowerCase().includes("freelance")
        ? "contract"
        : "full-time"
    : job.type;
  const kalibrrEvidence = job.source === "kalibrr"
    ? (kalibrrDetail ?? { message: kalibrrLoading ? "Loading on-demand detail" : "On-demand detail unavailable" })
    : evidence;

  const glintsJob = job.source === "glints" ? parseRaw(job) : null;
  const glintsDescription = plainDraftJs(text(asRecord(glintsJob).descriptionJsonString));
  const glintsCompany = asRecord(asRecord(glintsJob).company);
  const glintsCompanyDesc = plainDraftJs(text(glintsCompany.descriptionJsonString));
  const glintsCategory = asRecord(asRecord(glintsJob).hierarchicalJobCategory);
  const glintsSalaries = Array.isArray(asRecord(glintsJob).salaries) ? asRecord(glintsJob).salaries as unknown[] : [];
  const glintsSalaryText = glintsSalaries.length > 0
    ? glintsSalaries.map((s: unknown) => {
        const sr = s as Record<string, unknown>;
        const min = sr.minAmount;
        const max = sr.maxAmount;
        if (!min && !max) return "";
        const currency = text(sr.CurrencyCode) || "IDR";
        if (currency === "IDR") {
          const parts = [];
          if (min) parts.push(`Rp${Number(min).toLocaleString("id-ID")}`);
          if (max) parts.push(`Rp${Number(max).toLocaleString("id-ID")}`);
          return parts.join(" – ");
        }
        return [min, max].filter(Boolean).join("-") + ` ${currency}`;
      }).filter(Boolean).join(", ")
    : job.salary;
  const glintsLocation = [text(asRecord(asRecord(glintsJob).city).name), text(asRecord(asRecord(glintsJob).country).name)].filter(Boolean).join(", ") || job.location;
  const glintsWorkType = text(asRecord(glintsJob).workArrangementOption) === "REMOTE"
    ? "remote"
    : humanize(text(asRecord(glintsJob).type)) || job.type;
  const glintsBanner = text(asRecord(glintsJob).bannerPic);
  const glintsEvidence = job.source === "glints" ? glintsJob : evidence;

  const effLocation = job.source === "kalibrr" ? kalibrrDetailLocation : job.source === "glints" ? glintsLocation : detailLocation;
  const effWorkType = job.source === "kalibrr" ? kalibrrDetailWorkType : job.source === "glints" ? glintsWorkType : detailWorkType;
  const effSalary = job.source === "kalibrr" ? kalibrrSalaryText : job.source === "glints" ? glintsSalaryText : salaryText;
  const effDescription = job.source === "kalibrr" ? kalibrrDetailDescription : job.source === "glints" ? (glintsDescription || job.description) : detailDescription;
  const effRequirements = job.source === "kalibrr" ? kalibrrDetailRequirements : job.source === "glints" ? job.requirements || "" : detailRequirements;
  const effEvidence = job.source === "kalibrr" ? kalibrrEvidence : job.source === "glints" ? glintsEvidence : evidence;
  const effCompanyName = job.source === "kalibrr" ? text(kalibrrCompanyObj.name) || text(kalibrrCompanyInfo.name) || text(companyProfile.name) || job.company : job.source === "glints" ? text(glintsCompany.name) || job.company : text(deallsCompany.name) || text(companyProfile.name) || job.company;
  const effIndustry = job.source === "kalibrr" ? text(kalibrrCompanyInfo.industry) || text(overview.industry) : job.source === "glints" ? text(asRecord(glintsCompany.industry).name) : text(deallsCompany.sector) || text(overview.industry);
  const effCompanySize = job.source === "kalibrr" ? "" : job.source === "glints" ? humanize(text(glintsCompany.size)) : text(asRecord(overview.size).description) || (asRecord(deallsCompany.size).start ? `${String(asRecord(deallsCompany.size).start)}–${String(asRecord(deallsCompany.size).end || "+")}` : "");
  const effWebsite = job.source === "kalibrr" ? text(kalibrrCompanyInfo.url) : job.source === "glints" ? text(glintsCompany.website) : text(deallsCompany.website) || text(asRecord(overview.website).url);
  const effCompanyDesc = job.source === "kalibrr" ? plainHtml(text(kalibrrCompanyInfo.description)) || plainHtml(text(kalibrrCompanyObj.description)) : job.source === "glints" ? (glintsCompanyDesc ? <p>{glintsCompanyDesc}</p> : <p className="text-muted-foreground">No company profile was returned for this listing.</p>) : (plainHtml(deallsCompany.description) ? <p>{plainHtml(deallsCompany.description)}</p> : profileParagraphs.length ? profileParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="text-muted-foreground">No company profile was returned for this listing.</p>);
  const effStatus = job.source === "kalibrr" ? "" : job.source === "glints" ? "" : status;

  const coverUrl = job.source === "glints" ? glintsBanner : cover;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl gap-0 overflow-hidden p-0">
        {coverUrl && (
          <div className="h-28 w-full overflow-hidden border-b bg-muted sm:h-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
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
                {effStatus && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-mint">
                    <CheckCircle2 className="size-3.5" />{effStatus}
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
            {job.source === "kalibrr" && kalibrrLoading && (
              <div className="border-b bg-muted/35 px-5 py-2 text-xs text-muted-foreground sm:px-6">Loading fresh Kalibrr details…</div>
            )}
            {job.source === "kalibrr" && kalibrrFailure && (
              <div className="border-b bg-destructive/10 px-5 py-2 text-xs text-destructive sm:px-6">{kalibrrFailure}. Showing stored listing data.</div>
            )}
            <TabsContent value="overview" className="m-0">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="px-5 py-5 sm:px-6">
                  <div className="grid grid-cols-2 gap-4 border-b pb-5 sm:grid-cols-4">
                    <Fact icon={MapPin} label="Location" value={effLocation} />
                    <Fact icon={BriefcaseBusiness} label="Work type" value={effWorkType} />
                    <Fact icon={CircleDollarSign} label="Compensation" value={effSalary} />
                    <Fact icon={CalendarClock} label="Posted" value={timeAgo(job.createdAt)} />
                  </div>

                  <section className="py-6">
                    <h2 className="text-base font-bold">Role description</h2>
                    <p className="mt-3 max-w-4xl whitespace-pre-line text-base leading-7 text-foreground/85">
                      {effDescription || "No description was returned by the source."}
                    </p>
                  </section>

                  {(bullets.length > 0 || effRequirements) && (
                    <section className="border-t py-6">
                      <h2 className="text-base font-bold">Highlights and requirements</h2>
                      {bullets.length > 0 && (
                        <ul className="mt-3 grid gap-2 text-base leading-7">
                          {bullets.map((bullet, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-mint" />{text(bullet)}</li>)}
                        </ul>
                      )}
                      {effRequirements && <p className="mt-3 whitespace-pre-line text-base leading-7 text-muted-foreground">{effRequirements}</p>}
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
                  <div><h2 className="font-semibold">{effCompanyName}</h2><p className="text-sm text-muted-foreground">{effIndustry || "Industry not provided"}</p></div>
                </div>
                <div className="grid gap-5 py-5 sm:grid-cols-3">
                  <Fact icon={Building2} label="Company size" value={effCompanySize || "Not provided"} />
                  <Fact icon={CheckCircle2} label="Reviews" value={rating.value ? `${String(rating.value)} / 5` : "Not provided"} />
                  <Fact icon={ExternalLink} label="Website" value={effWebsite || "Not provided"} />
                </div>
                <div className="border-t pt-5">
                  <h3 className="text-sm font-semibold">About the company</h3>
                  <div className="mt-3 grid gap-3 text-base leading-7 text-foreground/80">
                    {effCompanyDesc}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="m-0 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><FileJson className="size-4" />Untouched source response used for audit and parser debugging</div>
              <pre className="overflow-x-auto rounded-md border bg-background p-4 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
                {effEvidence && Object.keys(effEvidence).length ? JSON.stringify(effEvidence, null, 2) : "No raw data available"}
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
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
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
  const tableRows = (queryResult?.jobs ?? visibleJobs).map(jobToAdminRow);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Fresh opportunities</h1>
        <span className="text-sm font-medium text-muted-foreground"><strong className="font-semibold tabular-nums text-foreground">{initialJobs.length}</strong> active listings</span>
      </div>

      <section className="mb-5" aria-label="Find jobs">
        <QueryBuilder onResult={setQueryResult} onReset={() => setQueryResult(null)} />
      </section>

      <ListingsToolbar
        jobs={initialJobs}
        sourceFilter={sourceFilter}
        onSourceChange={(source) => { setSourceFilter(source); setPage(0); setQueryResult(null); }}
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(0); setQueryResult(null); }}
      />

      {(initialJobs.length || queryResult) ? (
        <section className="overflow-hidden rounded-xl border bg-background" aria-label={queryResult ? "Query results" : "Job listings"}>
          {!queryResult && <div className="border-b bg-muted/20 px-3 py-2 text-sm font-semibold">{jobs.length} listing{jobs.length === 1 ? "" : "s"}</div>}
          <AdminDataTable rows={tableRows} onInspect={setSelectedJob} />
        </section>
      ) : null}

      {!queryResult && jobs.length > 0 && (
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
