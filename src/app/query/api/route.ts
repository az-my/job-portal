import { getJobs, SUPABASE_URL, SUPABASE_ANON_KEY, type Job } from "@/lib/db";

export const dynamic = "force-dynamic";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SQL_PROMPT = `You translate job-search questions (English or Indonesian) into ONE PostgreSQL SELECT statement.

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
- Query jobs_fresh by default; use jobs only when the user asks about history/archive/trends over time.
- Text matching: ILIKE '%term%' against title/description/requirements/company. Salary floors: coalesce(salary_max, salary_min) >= X and salary_min is not null.
- "5jt" / "5 juta" = 5000000 IDR (monthly).
- Row listings: select title, company, location, type, salary, source, url, posted_at — order by posted_at desc, LIMIT 100. Aggregations: sensible columns, no limit needed.

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
  return cleaned;
}

async function runSql(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_job_query`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "Missing ?q=" }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (geminiKey && supabaseReady) {
    try {
      const sql = validateSql(await generateSql(q, geminiKey));
      const rows = await runSql(sql);
      return Response.json({ q, mode: "sql", sql, count: rows.length, rows: rows.slice(0, 200) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const jobs = keywordFallback(q, await getJobs());
      return Response.json({
        q, mode: "fallback",
        llmError: `Text-to-SQL failed (${message}) — plain keyword matching instead.`,
        count: jobs.length, jobs: jobs.slice(0, 100),
      });
    }
  }

  const jobs = keywordFallback(q, await getJobs());
  return Response.json({
    q, mode: "fallback",
    llmError: geminiKey ? "Supabase not configured." : "GEMINI_API_KEY not set.",
    count: jobs.length, jobs: jobs.slice(0, 100),
  });
}
