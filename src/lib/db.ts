import fs from 'fs';
import path from 'path';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'remote' | 'contract';
  description: string;
  salary: string;
  salaryMin?: number;
  salaryMax?: number;
  createdAt: string;
  requirements?: string;
  source?: string;
  sourceId?: string;
  url?: string;
  logoUrl?: string;
  raw?: string;
  category?: string;
  skills?: string[];
  workArrangement?: string;
  education?: string;
  experience?: string;
  expiresAt?: string;
  benefits?: string[];
  industry?: string;
  companySize?: string;
  vacancies?: number;
  applicantCount?: number;
  activity?: string[];
  verified?: boolean;
  urgent?: boolean;
  salaryPeriod?: string;
  viewCount?: number;
}

export interface DbSchema {
  jobs: Job[];
}

const PROJECT_ROOT = process.cwd();
const DB_FILE = path.join(PROJECT_ROOT, 'data', 'db.json');

export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_REST_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface JobRow {
  id: number;
  source: string;
  source_id: string;
  title: string;
  company: string;
  location: string;
  type: Job['type'];
  description: string;
  salary: string;
  salary_min: number | null;
  salary_max: number | null;
  requirements: string | null;
  url: string | null;
  logo_url: string | null;
  raw: unknown;
  posted_at: string;
  [key: string]: unknown;
}

type EnrichedJob = Pick<Job,
  | 'category' | 'skills' | 'workArrangement' | 'education' | 'experience'
  | 'expiresAt' | 'benefits' | 'industry' | 'companySize' | 'vacancies'
  | 'applicantCount' | 'activity'
  | 'verified' | 'urgent' | 'salaryPeriod' | 'viewCount'
>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/**
 * Reads enriched fields from either future first-class columns or the
 * `_normalized` envelope stored in `raw`. This keeps old Supabase schemas
 * readable while allowing the scraper to publish richer data immediately.
 */
export function enrichedFieldsFromRow(row: Record<string, unknown>): Partial<EnrichedJob> {
  const raw = asRecord(row.raw);
  const normalized = asRecord(raw?._normalized);
  const source = { ...normalized, ...row };
  const result: Partial<EnrichedJob> = {};

  const stringKeys = ['category', 'workArrangement', 'education', 'experience', 'expiresAt', 'industry', 'companySize', 'salaryPeriod'] as const;
  for (const key of stringKeys) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = source[key] ?? source[snakeKey];
    if (typeof value === 'string' && value.trim()) result[key] = value;
  }
  for (const key of ['skills', 'benefits', 'activity'] as const) {
    const value = source[key];
    if (Array.isArray(value)) {
      const strings = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
      if (strings.length) result[key] = strings;
    }
  }
  for (const key of ['vacancies', 'applicantCount', 'viewCount'] as const) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = source[key] ?? source[snakeKey];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ['verified', 'urgent'] as const) {
    const value = source[key];
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

function rowToJob(row: JobRow): Job {
  return {
    id: `sb-${row.id}`,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    description: row.description,
    salary: row.salary,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    createdAt: row.posted_at,
    source: row.source,
    sourceId: row.source_id,
    url: row.url ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    requirements: row.requirements ?? undefined,
    raw: row.raw ? JSON.stringify(row.raw) : undefined,
    ...enrichedFieldsFromRow(row),
  };
}

/**
 * Fresh jobs (7-day window), preferring Supabase; falls back to db.json when
 * Supabase is unconfigured or unreachable. PostgREST caps a response at 1000
 * rows — fine while the fresh window sits around 600.
 */
export async function getJobs(): Promise<Job[]> {
  if (SUPABASE_URL && SUPABASE_REST_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/jobs_fresh?select=*&order=posted_at.desc&limit=1000`,
        {
          headers: { apikey: SUPABASE_REST_KEY, Authorization: `Bearer ${SUPABASE_REST_KEY}` },
          cache: 'no-store',
        }
      );
      if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
      const rows: JobRow[] = await res.json();
      return rows.map(rowToJob);
    } catch (err) {
      console.error('[db] Supabase read failed, falling back to db.json:', err);
    }
  }
  return getDb().jobs;
}

export function getDb(): DbSchema {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch {
    return { jobs: [] };
  }
}
