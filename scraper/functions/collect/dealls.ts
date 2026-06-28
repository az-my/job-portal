import { DEALLS_API, DEALLS_HEADERS } from '../../core/config';

interface DeallsDoc {
  id: string;
  slug: string;
  role: string;
  employmentTypes: string[];
  workplaceType: string;
  publishedAt: string;
  salaryRange: { start: number; end: number } | null;
  salaryType: string;
  country: { name: string; id: number };
  city: { name: string; id: number } | null;
  company: {
    name: string;
    logoUrl: string | null;
    sector: string;
    verified: boolean;
  };
  skills: { name: string; id: string }[];
  urgentlyNeeded: boolean;
  url?: string;
}

interface DeallsResponse {
  data: {
    docs: DeallsDoc[];
    totalDocs: number;
    totalPages: number;
    page: number;
  };
}

async function fetchPage(page: number, limit: number = 18): Promise<DeallsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    sortParam: 'mostRelevant',
    sortBy: 'asc',
    boostTheBoostedJob: 'true',
    published: 'true',
    limit: String(limit),
    status: 'active',
  });

  const res = await fetch(`${DEALLS_API}?${params}`, {
    method: 'GET',
    headers: DEALLS_HEADERS,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dealls API error: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
  }

  return res.json();
}

export async function collectDeallsJobs(maxPages: number = 5): Promise<DeallsDoc[]> {
  const all: DeallsDoc[] = [];
  const first = await fetchPage(1, 18);
  all.push(...first.data.docs);

  const totalPages = Math.min(maxPages, first.data.totalPages);
  for (let p = 2; p <= totalPages; p++) {
    const page = await fetchPage(p, 18);
    all.push(...page.data.docs);
  }

  return all;
}
