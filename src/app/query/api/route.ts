import { getDb, type Job } from "@/lib/db";

export const dynamic = "force-dynamic";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface QueryFilter {
  keywords: string[];
  sources: string[];
  types: string[];
  salaryMinIDR: number | null;
  maxAgeDays: number | null;
  location: string | null;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    sources: {
      type: "ARRAY",
      items: { type: "STRING", enum: ["jobstreet", "dealls", "kalibrr", "glints"] },
    },
    types: {
      type: "ARRAY",
      items: { type: "STRING", enum: ["full-time", "part-time", "remote", "contract"] },
    },
    salaryMinIDR: { type: "NUMBER", nullable: true },
    maxAgeDays: { type: "NUMBER", nullable: true },
    location: { type: "STRING", nullable: true },
  },
  required: ["keywords", "sources", "types"],
};

const PROMPT = `Translate a job-search request (English or Indonesian) into a filter for a job database.
- keywords: role/skill/company search terms only — never salary, date, location, source, or employment-type words. Lowercase. Empty array if the request has no term worth text-matching.
- sources: only when a specific portal is named (jobstreet, dealls, kalibrr, glints), else [].
- types: employment types explicitly requested ("remote", "magang"/"internship" → contract, "part time", …), else [].
- salaryMinIDR: minimum monthly salary in IDR ("5jt" = 5000000, "gaji di atas 10 juta" = 10000000), else null.
- maxAgeDays: recency in days ("today" = 1, "this week" = 7, "3 hari terakhir" = 3), else null.
- location: city/region name if mentioned, else null.

Request: `;

async function translateWithGemini(q: string, key: string): Promise<QueryFilter> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT + q }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no candidates: ${JSON.stringify(payload).slice(0, 200)}`);

  const parsed = JSON.parse(text);
  return {
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    types: Array.isArray(parsed.types) ? parsed.types : [],
    salaryMinIDR: typeof parsed.salaryMinIDR === "number" ? parsed.salaryMinIDR : null,
    maxAgeDays: typeof parsed.maxAgeDays === "number" ? parsed.maxAgeDays : null,
    location: typeof parsed.location === "string" && parsed.location ? parsed.location : null,
  };
}

function fallbackFilter(q: string): QueryFilter {
  return {
    keywords: q.toLowerCase().split(/\s+/).filter(Boolean),
    sources: [],
    types: [],
    salaryMinIDR: null,
    maxAgeDays: null,
    location: null,
  };
}

function applyFilter(jobs: Job[], filter: QueryFilter): Job[] {
  const cutoff = filter.maxAgeDays
    ? Date.now() - filter.maxAgeDays * 24 * 60 * 60 * 1000
    : null;
  const location = filter.location?.toLowerCase() ?? null;
  const keywords = filter.keywords.map((k) => k.toLowerCase());

  const scored: [number, Job][] = [];
  for (const job of jobs) {
    if (filter.sources.length && !filter.sources.includes(job.source ?? "")) continue;
    if (filter.types.length && !filter.types.includes(job.type)) continue;
    if (cutoff && new Date(job.createdAt).getTime() < cutoff) continue;
    if (location && !job.location.toLowerCase().includes(location)) continue;
    if (filter.salaryMinIDR) {
      const pay = job.salaryMax ?? job.salaryMin;
      if (!pay || pay < filter.salaryMinIDR) continue;
    }

    let score = 0;
    if (keywords.length) {
      const haystack =
        `${job.title} ${job.company} ${job.description} ${job.requirements ?? ""}`.toLowerCase();
      for (const kw of keywords) if (haystack.includes(kw)) score++;
      if (score === 0) continue;
    }
    scored.push([score, job]);
  }

  scored.sort((a, b) => b[0] - a[0] || b[1].createdAt.localeCompare(a[1].createdAt));
  return scored.map(([, job]) => job);
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ error: "Missing ?q=" }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  let filter: QueryFilter;
  let usedLLM = false;
  let llmError: string | null = null;

  if (key) {
    try {
      filter = await translateWithGemini(q, key);
      usedLLM = true;
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
      filter = fallbackFilter(q);
    }
  } else {
    llmError = "GEMINI_API_KEY not set — using plain keyword matching.";
    filter = fallbackFilter(q);
  }

  const jobs = applyFilter(getDb().jobs, filter);
  return Response.json({ q, usedLLM, llmError, filter, count: jobs.length, jobs: jobs.slice(0, 100) });
}
