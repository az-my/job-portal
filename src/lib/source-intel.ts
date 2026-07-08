// Field notes from probing each job-portal endpoint. Update when an API
// changes behavior — this page is the reference for anyone touching scraper/.

export interface SourceIntel {
  id: string;
  name: string;
  method: 'GET' | 'POST';
  endpoint: string;
  kind: string;
  collector: string;
  auth: string;
  freshness: string;
  pagination: string;
  dateField: string;
  jobUrlPattern: string;
  requestNotes: string[];
  limitations: string[];
  gotchas: string[];
  fieldMap: [string, string][];
}

export const SOURCE_INTEL: SourceIntel[] = [
  {
    id: 'jobstreet',
    name: 'JobStreet Indonesia',
    method: 'POST',
    endpoint: 'https://id.jobstreet.com/graphql',
    kind: 'GraphQL (JobSearchV6)',
    collector: 'scraper/jobstreet.py',
    auth: 'None. Cookies are client-generated tracking UUIDs — any uuid4 works; we generate fresh ones per run.',
    freshness: 'sortMode: "ListedDate" in the query params → newest first across the full pool (~60k jobs). Without it, the default relevance sort returns a curated subset with listings up to a year old.',
    pagination: 'page / pageSize (site uses 22). No cap found; totalCount provided.',
    dateField: 'listingDate.dateTimeUtc — real posting date',
    jobUrlPattern: 'https://id.jobstreet.com/jobs/{id}',
    requestNotes: [
      'The x-custom-features: application/features.seek.all+json header is load-bearing — without it every valid query fails with an opaque "An error occurred".',
      'seek-request-brand, seek-request-country, and x-seek-site: chalice headers are required.',
      'Cookies sol_id / JobseekerSessionId / JobseekerVisitorId must be present but accept any UUID.',
    ],
    limitations: [
      'Unofficial internal schema (shared with SEEK) — can change without notice.',
      'No salary min/max fields exposed in search results, only the free-text salaryLabel (often empty).',
      'No company logo in search results.',
    ],
    gotchas: [
      'Two error modes: schema mistakes return HTTP 400 with real GraphQL validation messages; runtime failures return HTTP 200 with an opaque errors array ("An error occurred") — usually a missing header, not a bad query.',
      'workTypes is a plain [String!]! — querying subfields on it is a validation error.',
      'Values are Indonesian-locale strings (locale: id-ID), e.g. classifications like "Hospitaliti & Pariwisata".',
    ],
    fieldMap: [
      ['title', 'title'],
      ['advertiser.description', 'company'],
      ['locations[].label', 'location'],
      ['workTypes[0]', 'type (Full time → full-time, Contract/Temp → contract, Casual/Vacation → part-time)'],
      ['bulletPoints', 'description'],
      ['salaryLabel', 'salary (free text)'],
      ['listingDate.dateTimeUtc', 'createdAt'],
      ['classifications[].classification.description', 'requirements'],
    ],
  },
  {
    id: 'dealls',
    name: 'Dealls (SejutaCita)',
    method: 'GET',
    endpoint: 'https://api.sejutacita.id/v1/explore-job/job',
    kind: 'REST',
    collector: 'scraper/dealls.py',
    auth: 'None. Only x-client-app-name: Deall-Talent-Web + a Referer.',
    freshness: 'sortParam=publishedAt & sortBy=desc — verified strictly descending across pages. The site default (mostRelevant + boostTheBoostedJob=true) surfaces boosted old jobs and hides new ones deeper in the list.',
    pagination: 'page / limit (site uses 18). totalDocs / totalPages returned, no cap found.',
    dateField: 'publishedAt — real posting date',
    jobUrlPattern: 'https://dealls.com/jobs/{slug}',
    requestNotes: [
      'Cleanest API of the four: proper JSON envelope { data: { docs, totalDocs, totalPages, page } }.',
      'Salary comes structured: salaryRange { start, end } in IDR.',
    ],
    limitations: [
      'Startup-heavy inventory; far smaller pool than JobStreet.',
      'No full job description in list responses — only role, skills, and company info.',
    ],
    gotchas: [
      'Invalid sortParam values return HTTP 400 (strict validation, unlike Glints).',
      'We dropped boostTheBoostedJob=true — it reorders results in favor of paying employers.',
    ],
    fieldMap: [
      ['role', 'title'],
      ['company.name', 'company'],
      ['city.name + country.name', 'location'],
      ['employmentTypes[0]', 'type (fullTime / partTime / remote / contract)'],
      ['salaryRange.start/end', 'salary (formatted RpXjt)'],
      ['publishedAt', 'createdAt'],
      ['skills[].name', 'requirements'],
      ['company.logoUrl', 'logoUrl (full URL provided)'],
    ],
  },
  {
    id: 'kalibrr',
    name: 'Kalibrr Indonesia',
    method: 'GET',
    endpoint: 'https://www.kalibrr.id/kjs/job_board/search',
    kind: 'REST',
    collector: 'scraper/kalibrr.py',
    auth: 'None. No cookies, no tokens.',
    freshness: 'sort=Freshness → activation_date descending.',
    pagination: 'limit / offset — honest server-side pagination. count returned (~1.1k active jobs).',
    dateField: 'activation_date — real posting date (also created_at)',
    jobUrlPattern: 'https://www.kalibrr.id/id-ID/c/{company.code}/jobs/{id}/{slug}',
    requestNotes: [
      'Do NOT use the _next/data/{buildId}/…json routes (the ones visible in browser devtools): the build id rotates on every Kalibrr deploy (instant 404s) and those pages ignore pagination — pages 2/3 return the same 15 jobs.',
      'Fields are snake_case here; the _next/data variant of the same data is camelCase.',
    ],
    limitations: [
      'Smallest pool of the four (~1,100 active jobs).',
      'Salary fields (base_salary / maximum_salary) are usually null — only ~12% of jobs expose them.',
    ],
    gotchas: [
      'description and qualifications are HTML — must be tag-stripped before display.',
      'tenure is a display string ("Full time"), not an enum; internships are often tenure "Full time".',
      'Company logos come as full URLs on company.logo_small.',
    ],
    fieldMap: [
      ['name', 'title'],
      ['company_name / company.name', 'company'],
      ['google_location.address_components.city + country', 'location'],
      ['tenure + is_work_from_home', 'type'],
      ['base_salary / maximum_salary', 'salary (formatted RpXjt)'],
      ['activation_date', 'createdAt'],
      ['qualifications (HTML-stripped)', 'requirements'],
      ['company.logo_small', 'logoUrl'],
    ],
  },
  {
    id: 'glints',
    name: 'Glints Indonesia',
    method: 'POST',
    endpoint: 'https://glints.com/api/v2-alc/graphql?op=searchJobsV3',
    kind: 'GraphQL (searchJobsV3)',
    collector: 'scraper/glints.py',
    auth: 'None for page 1. Page 2+ returns HTTP 403 "please login for more information" (NO_PERMISSION) — deep pagination is login-gated.',
    freshness: 'sortBy: "LATEST" inside the data variables → updatedAt descending (the site\'s "Paling baru"). Note: updatedAt, not createdAt — re-boosted old jobs appear near the top and must be filtered out by createdAt.',
    pagination: 'page / pageSize, but pageSize is silently server-capped at 50 and only page 1 is anonymous → hard ceiling of ~50 newest jobs per run.',
    dateField: 'createdAt (posting) / updatedAt (last bump)',
    jobUrlPattern: 'https://glints.com/id/opportunities/jobs/{id} (redirects to the canonical slug URL)',
    requestNotes: [
      'Needs only content-type, x-glints-country-code: ID, a Referer, and a User-Agent — the cookies/traceparent seen in browser captures are unnecessary.',
      'Company logos are bare filenames; prepend https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/',
    ],
    limitations: [
      'Anonymous ceiling: one request, max 50 jobs, sorted by last update. Roughly 70–80% of those are fresh postings; a daily run skims the newest layer only.',
      'includeExternalJobs: true also returns jobs Glints syndicates from elsewhere.',
    ],
    gotchas: [
      'Input validation is asymmetric: unknown fields in the data object → HTTP 400, but invalid enum VALUES (e.g. sortBy: "newest") are silently ignored and fall back to relevance sort — verify ordering, not just HTTP 200.',
      'The collector tries page 2 anyway and stops gracefully on 403, so if Glints ever lifts the gate we benefit automatically.',
    ],
    fieldMap: [
      ['title', 'title'],
      ['company.name', 'company'],
      ['city.name / location.formattedName + country.name', 'location'],
      ['type + workArrangementOption', 'type (REMOTE wins, then FULL_TIME etc.)'],
      ['salaries[0].minAmount/maxAmount', 'salary (IDR formatted, else raw + currency)'],
      ['createdAt', 'createdAt'],
      ['skills[].skill.name', 'requirements'],
      ['company.logo via images CDN', 'logoUrl'],
    ],
  },
];

export const PIPELINE_NOTES = [
  'Freshness window: jobs older than 7 days (by real posting date) are pre-filtered before merge and cleaned from the DB after every run.',
  'Dedup key is (source, sourceId) — numeric ids collide across boards (JobStreet and Kalibrr both use plain integers).',
  'All sources are fetched in parallel (thread pool); db.json merges stay serial because storage is not thread-safe. Full run ≈ 8s.',
  'Schedule: GitHub Actions daily at 01:00 UTC (08:00 WIB) + manual dispatch with source/max_pages inputs; the run commits db.json back to the repo.',
  'CLI: python scraper/main.py [max_pages] [all|jobstreet|dealls|kalibrr|glints] — the only way to trigger scraping; the frontend is read-only.',
  'Every job stores the untouched API payload in its raw field — inspect it via the eye icon → JSON tab on the dashboard.',
];
