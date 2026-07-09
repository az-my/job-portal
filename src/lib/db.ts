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
}

export interface DbSchema {
  jobs: Job[];
}

const PROJECT_ROOT = process.cwd();
const DB_FILE = path.join(PROJECT_ROOT, 'data', 'db.json');

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  };
}

/**
 * Fresh jobs (7-day window), preferring Supabase; falls back to db.json when
 * Supabase is unconfigured or unreachable. PostgREST caps a response at 1000
 * rows — fine while the fresh window sits around 600.
 */
export async function getJobs(): Promise<Job[]> {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/jobs_fresh?select=*&order=posted_at.desc&limit=1000`,
        {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
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
