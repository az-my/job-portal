import { getJobs, SUPABASE_URL, SUPABASE_REST_KEY, type Job } from "@/lib/db";

export const dynamic = "force-dynamic";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const JOB_COLUMNS = `source, source_id, title, company, location, type, description, salary, salary_min, salary_max, requirements, url, logo_url, raw, posted_at`;

const SQL_PROMPT = `You translate a job seeker's request (English or Indonesian) into ONE PostgreSQL SELECT statement that returns job postings.

Schema — table public.jobs and view public.jobs_fresh (same columns; jobs_fresh = active listings posted in the last 7 days; the jobs table keeps the full history/archive):
  source text          -- 'jobstreet' | 'dealls' | 'kalibrr' | 'glints'
  source_id text
  title text
  company text
  location text        -- e.g. 'Jakarta, Indonesia' / 'Tangerang, Banten'
  type text            -- 'full-time' | 'part-time' | 'remote' | 'contract'
  description text
  salary text          -- display string, may be empty
  salary_min bigint    -- monthly IDR, null when unknown
  salary_max bigint    -- monthly IDR, null when unknown
  requirements text    -- skills / qualifications, null when unknown
  url text
  posted_at timestamptz -- real posting date
  is_stale boolean

Rules:
- One SELECT only. Never modify data. No semicolons.
- Always start with exactly: SELECT ${JOB_COLUMNS} FROM public.jobs_fresh
- Return individual job postings only. Never aggregate, count, group, summarize, or perform data analysis.
- Never change, omit, reorder, alias, calculate, or add SELECT columns.
- Add only WHERE conditions and ORDER BY clauses based on the request, followed by LIMIT 100.
- Text matching: ILIKE '%term%' against title/description/requirements/company. Salary floors: coalesce(salary_max, salary_min) >= X and salary_min is not null.
- "5jt" / "5 juta" = 5000000 IDR (monthly).
- Default ordering is posted_at DESC. A user-requested job-relevant ordering such as salary may override it.
- If the request asks for analytics or a summary, interpret it as a useful filter over individual job postings instead.

Return JSON: {"sql": "..."}

Question: `;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { sql: { type: "STRING" } },
  required: ["sql"],
};

async function generateSql(q: string, key: string): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SQL_PROMPT + q }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no candidates");
  const sql = String(JSON.parse(text).sql ?? "").trim();
  if (!sql) throw new Error("Gemini returned empty SQL");
  return sql;
}

/** App-side validation; the run_job_query function re-checks and runs read-only with a 4s timeout. */
function validateSql(sql: string): string {
  const cleaned = sql.replace(/;\s*$/, "").trim();
  if (!/^select\b/i.test(cleaned)) throw new Error("Only SELECT statements are allowed");
  if (cleaned.includes(";")) throw new Error("Only a single statement is allowed");
  if (/\b(count|sum|avg|min|max)\s*\(|\bgroup\s+by\b|\bhaving\b/i.test(cleaned)) {
    throw new Error("Analytics and aggregation are not supported");
  }
  const fromIndex = cleaned.search(/\s+from\s+/i);
  if (fromIndex < 0) throw new Error("Missing FROM clause");
  const selected = cleaned.slice(6, fromIndex).replace(/\s+/g, " ").trim().toLowerCase();
  if (selected !== JOB_COLUMNS.toLowerCase()) throw new Error("Query must return the fixed job schema");
  if (!/^\s+from\s+public\.jobs_fresh\b/i.test(cleaned.slice(fromIndex))) {
    throw new Error("Queries must use jobs_fresh");
  }
  return cleaned;
}

function rowToJob(row: Record<string, unknown>, index: number): Job {
  return {
    id: `query-${String(row.source ?? "job")}-${String(row.source_id ?? index)}`,
    title: String(row.title ?? "Untitled"),
    company: String(row.company ?? "Unknown company"),
    location: String(row.location ?? ""),
    type: (["full-time", "part-time", "remote", "contract"].includes(String(row.type)) ? String(row.type) : "full-time") as Job["type"],
    description: String(row.description ?? ""),
    salary: String(row.salary ?? ""),
    salaryMin: typeof row.salary_min === "number" ? row.salary_min : undefined,
    salaryMax: typeof row.salary_max === "number" ? row.salary_max : undefined,
    requirements: row.requirements == null ? undefined : String(row.requirements),
    source: row.source == null ? undefined : String(row.source),
    sourceId: row.source_id == null ? undefined : String(row.source_id),
    url: row.url == null ? undefined : String(row.url),
    logoUrl: row.logo_url == null ? undefined : String(row.logo_url),
    raw: row.raw == null ? undefined : JSON.stringify(row.raw),
    createdAt: String(row.posted_at ?? new Date().toISOString()),
  };
}

async function runSql(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_job_query`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_REST_KEY!,
      Authorization: `Bearer ${SUPABASE_REST_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query_text: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    let message = body.slice(0, 300);
    try { message = JSON.parse(body).message ?? message; } catch {}
    throw new Error(`Query failed: ${message}`);
  }
  return JSON.parse(body);
}

function keywordFallback(q: string, jobs: Job[]): Job[] {
  const keywords = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: [number, Job][] = [];
  for (const job of jobs) {
    const haystack =
      `${job.title} ${job.company} ${job.description} ${job.requirements ?? ""}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (haystack.includes(kw)) score++;
    if (score > 0) scored.push([score, job]);
  }
  scored.sort((a, b) => b[0] - a[0] || b[1].createdAt.localeCompare(a[1].createdAt));
  return scored.map(([, job]) => job);
}

const STOP_WORDS = new Set([
  "a", "above", "around", "atas", "at", "atau", "below", "cari", "dengan", "di", "disclose", "find", "for", "full", "gaji", "in", "include",
  "info", "information", "job", "jobs", "juta", "latest", "listed", "lowongan", "me", "million", "newest", "of", "or", "paying", "posted", "publish",
  "roles", "rupiah", "salary", "show", "tampilkan", "terbaru", "that", "the", "this", "to", "with", "yang",
]);

const KEYWORD_ALIASES: Record<string, string[]> = {
  apoteker: ["apoteker", "pharmacist", "pharmacy", "kefarmasian"],
  desainer: ["designer", "desainer"],
  guru: ["teacher", "teaching", "guru"],
  hospitality: ["hospitality", "hotel", "housekeeping", "waiter", "waitress", "cook", "pastry"],
  hr: ["human resources", "hr", "recruitment", "recruiter"],
  manajer: ["manager", "manajer"],
  perhotelan: ["hospitality", "hotel", "housekeeping", "waiter", "waitress", "cook", "pastry", "daily worker", "room attendant"],
  produksi: ["production", "produksi"],
  sopir: ["driver", "sopir"],
  teacher: ["teacher", "teaching", "guru"],
};

const LOCATION_ALIASES: Record<string, string> = {
  "tangerang selatan": "south tangerang",
};

interface ParsedIntent {
  keywords: string[];
  location?: string;
  type?: Job["type"];
  salaryMin?: number;
  salaryListed: boolean;
  days?: number;
  excluded: string[];
}

function parseIntent(q: string): ParsedIntent {
  const lower = q.toLowerCase();
  const salaryMatch = lower.match(/(?:above|over|di atas|lebih dari|paying above)\s+(\d+(?:[.,]\d+)?)\s*(?:jt|juta|million)/);
  const salaryMin = salaryMatch ? Math.round(Number(salaryMatch[1].replace(",", ".")) * 1_000_000) : undefined;
  const daysMatch = lower.match(/(?:last|past|dalam)\s+(\d+)\s+days?/);
  const excluded = [...lower.matchAll(/(?:excluding|exclude|without|kecuali|bukan)\s+([a-z-]+)/g)].map((match) => match[1]);
  const type: Job["type"] | undefined = lower.includes("part-time") || lower.includes("part time") ? "part-time"
    : lower.includes("contract") || lower.includes("kontrak") ? "contract"
    : lower.includes("remote") || lower.includes("wfh") ? "remote"
    : lower.includes("full-time") || lower.includes("full time") ? "full-time"
    : undefined;
  const locationMatch = lower.match(/(?:in|around|near|di)\s+([a-z]+(?:\s+[a-z]+)?)(?:\s+(?:with|that|paying|above|yang|dan)|$)/);
  const requestedLocation = locationMatch?.[1]?.trim();
  const location = requestedLocation ? (LOCATION_ALIASES[requestedLocation] ?? requestedLocation) : undefined;
  const locationWords = new Set(requestedLocation?.split(/\s+/) ?? []);

  const scrubbed = lower
    .replace(/\d+(?:[.,]\d+)?\s*(?:jt|juta|million|rupiah)?/g, " ")
    .replace(/[^a-z\s-]/g, " ");
  const keywords = [...new Set(scrubbed.split(/\s+/).filter((word) =>
    word.length > 2 && !STOP_WORDS.has(word) && !locationWords.has(word) && !excluded.includes(word) &&
    !["time", "full-time", "part-time", "remote", "wfh", "contract", "kontrak", "days"].includes(word)
  ))];

  return {
    keywords,
    location,
    type,
    salaryMin,
    salaryListed: /salary|gaji|upah|compensation/.test(lower) && /listed|include|disclose|publish|information|salary|gaji/.test(lower),
    days: daysMatch ? Number(daysMatch[1]) : /this week|minggu ini/.test(lower) ? 7 : undefined,
    excluded,
  };
}

function deterministicFilter(q: string, jobs: Job[]): { jobs: Job[]; understood: boolean } {
  const intent = parseIntent(q);
  const understood = Boolean(intent.keywords.length || intent.location || intent.type || intent.salaryMin || intent.salaryListed || intent.days || intent.excluded.length);
  if (!understood) return { jobs: [], understood: false };
  const cutoff = intent.days ? Date.now() - intent.days * 86_400_000 : null;

  const matches = jobs.filter((job) => {
    const searchable = `${job.title} ${job.company} ${job.description} ${job.requirements ?? ""}`.toLowerCase();
    if (intent.location && !job.location.toLowerCase().includes(intent.location)) return false;
    if (intent.type && job.type !== intent.type) return false;
    if (intent.salaryListed && !job.salary && job.salaryMin == null && job.salaryMax == null) return false;
    if (intent.salaryMin && Math.max(job.salaryMax ?? 0, job.salaryMin ?? 0) < intent.salaryMin) return false;
    if (cutoff && new Date(job.createdAt).getTime() < cutoff) return false;
    if (intent.excluded.some((term) => searchable.includes(term))) return false;
    return intent.keywords.every((keyword) => {
      const aliases = KEYWORD_ALIASES[keyword] ?? [keyword];
      return aliases.some((alias) => searchable.includes(alias));
    });
  });
  return { jobs: matches, understood: true };
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "Missing ?q=" }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_REST_KEY);
  const allJobs = await getJobs();
  const local = deterministicFilter(q, allJobs);

  if (local.understood) {
    return Response.json({ q, mode: "filter", count: local.jobs.length, jobs: local.jobs.slice(0, 100) });
  }

  if (geminiKey && supabaseReady) {
    try {
      const sql = validateSql(await generateSql(q, geminiKey));
      const rows = await runSql(sql);
      const jobs = rows.slice(0, 100).map(rowToJob);
      return Response.json({ q, mode: "sql", sql, count: jobs.length, jobs });
    } catch {
      const jobs = keywordFallback(q, allJobs);
      return Response.json({
        q, mode: "fallback",
        llmError: "AI search is temporarily unavailable. Showing basic keyword matches instead.",
        count: jobs.length, jobs: jobs.slice(0, 100),
      });
    }
  }

  const jobs = keywordFallback(q, allJobs);
  return Response.json({
    q, mode: "fallback",
    llmError: "AI search is unavailable. Showing basic keyword matches instead.",
    count: jobs.length, jobs: jobs.slice(0, 100),
  });
}
