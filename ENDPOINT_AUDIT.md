# Job Portal Endpoint Audit

Live probe: **2026-07-10 (Asia/Jakarta)**. These are unofficial upstream APIs and
their contracts can change without notice. Counts and sample-dependent nullability
are observations, not guarantees.

## Summary

| Source | Endpoint | Default/live result | Pagination metadata |
|---|---|---|---|
| JobStreet | `POST https://id.jobstreet.com/graphql` | `JobSearchV6`, 22 jobs with the collector request | `totalCount: 59,561`; request uses `page/pageSize` |
| Dealls | `GET https://api.sejutacita.id/v1/explore-job/job` | No query string succeeds and returns 10 jobs | `totalDocs`, `totalPages`, `page` |
| Kalibrr | `GET https://www.kalibrr.id/kjs/job_board/search` | No query string fails: HTTP 400, missing `limit` | `count: 1,107`; request uses `limit/offset` |
| Glints | `POST https://glints.com/api/v2-alc/graphql?op=searchJobsV3` | Collector gets 50 jobs; anonymous page 2 is HTTP 403 | `hasMore`, plus unrequested `totalJobs` and `numberOfJobsCreatedInLast14Days` fields |

## JobStreet

The endpoint requires a GraphQL document, the SEEK request headers, and tracking
cookies. The cookies contain generated UUIDs and are not authentication. The
collector explicitly sorts by `ListedDate`; this is not the API's unqualified
default.

Response envelope:

```text
data.jobSearchV6
  totalCount: number
  data: Job[]
  __typename: "SearchV6Result"
```

Requested job fields include identity/title, teaser and bullet points, advertiser
and employer metadata, branding logo, salary/currency labels, listing date,
location hierarchy, work types/arrangement, tags, role ID, and classifications.
The public search type still does not expose structured salary bounds or the full
job-ad description. The live first page returned 22 items and approximately 59.5k
total results.

Schema introspection is deliberately disabled. An introspection request returns
HTTP 400 with `GRAPHQL_VALIDATION_FAILED` / `INTROSPECTION_DISABLED`. Normal
responses use `Cache-Control: no-store` and include an `x-request-id` header.
Discovering more fields therefore requires captured first-party queries or careful
validation probes, not standard introspection.

### JobStreet detail enrichment

The separate `jobDetails(id, tracking)` GraphQL operation was probed anonymously
on 2026-07-10 with generated session/tracking values. It returned HTTP 200 without
an authorization token or authenticated cookies. This makes anonymous enrichment
possible without coupling the collector to a user's account.

Useful fields observed:

- Full job content: `job.abstract`, `job.content(platform: WEB)`, and
  `job.content2(zone: "asia-4")`. The two content fields returned the complete HTML
  description in the probe.
- Lifecycle: `status`, `isExpired`, `expiresAt.dateTimeUtc`, `listedAt.dateTimeUtc`,
  `isLinkOut`, and verification state.
- Public compensation: `salary.label` and `salary.currencyLabel`. This remains a
  display label rather than structured min/max amounts; visible IDR bounds can be
  parsed, but hidden salary values are not exposed by this operation.
- Employer and location: advertiser identity/verification/registration date,
  localized location and classification labels, company search URL, profile, tags,
  reviews, industry, size, website, and perks when present.
- Rich media/product data: full logo, cover image, bullets, video, and employer
  screening-question text.

Authentication changes only optional personalized fields such as applicant
insights. The core description and branding response does not require it. Do not
store captured bearer tokens, `appSession` cookies, registered candidate IDs, or
analytics cookies in source control.

Cost: detail enrichment is one additional GraphQL request per job. Five pages of
22 search results means approximately 110 extra requests, so this should be
rate-limited, bounded to newly discovered/fresh jobs, cached by source ID, and
allowed to fail without failing the base search scrape.

## Dealls

This is the richest REST list response. A request with no query parameters is
valid. The scraper overrides that behavior with published/active filters and an
explicit descending `publishedAt` sort.

Response envelope:

```text
{
  data: { docs: Job[], totalDocs, totalPages, page },
  code: 200
}
```

Observed job metadata:

- Identity and lifecycle: `id`, `slug`, `role`, `status`, `publishedAt`,
  `createdAt`, `updatedAt`, `updatedAtByEmployer`, `latestUpdatedAt`, `deletedAt`.
- Work: `employmentTypes[]`, `workplaceType`, country/city, job-role category and
  subcategory IDs/slugs.
- Compensation: `salaryType`, `salaryRange`, `higherSalary`.
- Demand: `stats.viewCount`, `stats.applicantCount`, `stats.nonCuratedCount`,
  `applicantPrioritySlots`, `thereAreStillFewApplicants`, `urgentlyNeeded`.
- Candidate constraints: minimum GPA, majors, skill IDs, universities, education
  levels, `eligibleToApply`, and skills with IDs and names.
- Company: ID, slug, name, logo, sector, rank, verification, creation/trial dates,
  funding stage/amount, benefits, and working policies.
- Distribution: `externalPlatformApplyUrl`, `boosted`, `_score`, and
  `lastActivelyHiringAt`.
- User-specific flags default for anonymous traffic: `saved`, `applied`, and
  `waitListed`.

The payload also contains recruiter/author identifiers and an email address. Keep
these only in restricted raw captures if they are genuinely needed; they should
not be promoted to the public normalized model.

HTTP metadata observed: JSON UTF-8, permissive CORS (`*`), ETag, HSTS, CSP,
`X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.

### Dealls detail endpoint (on demand only)

```text
GET https://api.sejutacita.id/v1/job-portal/job/slug/{slug}
```

The endpoint works anonymously without `trId`, `guestId`, or `guest`; those
query parameters are browser analytics context and did not change the response
in live comparison. The response envelope is:

```text
{
  code: number,
  data: { result: JobDetail },
  messageId: string
}
```

Four observed detail responses shared the same 79 top-level `JobDetail` fields.
Compared with the list response, the detail operation adds full HTML
`responsibilities` and `requirements`, role/category objects, screening
questions, CV/portfolio requirements, salary visibility, company metadata,
application/lifecycle settings, and other employer workflow fields.

Integration policy: do **not** enrich every scraped Dealls listing. Store the
list record and slug during collection, then request this endpoint only when a
user explicitly opens or requests that job's detail. The application implements
this through `GET /api/jobs/dealls/{slug}`, with one-hour upstream and shared
response caching so repeated views do not repeatedly call Dealls.

Privacy: anonymous detail responses can expose `hiringTeam[].email` and
`invitedEmails`. Keep these in restricted raw captures only and exclude them
from public API responses, exports, UI models, and public database views.

## Kalibrr

`limit` is mandatory. With no query parameters the API returns RFC 7807-style
`application/problem+json`:

```json
{
  "detail": "Missing query parameter 'limit'",
  "status": 400,
  "title": "Bad Request",
  "type": "about:blank"
}
```

The successful response contains `jobs[]`, `count`, `search_text`,
`correction_text_search`, `from_alternative`, and `from_correction`. The collector
adds `sort=Freshness`, `limit`, and `offset`; the live count was 1,107.

Observed job metadata:

- Dates and visibility: activation, creation, application end, visibility,
  featured/top-brand flags, and priority score.
- Role requirements: function, tenure, education level, work experience,
  fresh-graduate acceptance, openings, qualifications HTML, description HTML,
  exams, and structured skills.
- Location/work mode: detailed Google address components, WFH and hybrid flags,
  and distance from the current user.
- Salary: base/maximum, currency, interval, and the separate `salary_shown` flag.
- Employer: two company objects containing ID/code/name, industry, descriptions,
  verification/visibility, logos, and company URL.
- Hiring signals: recruiter last-seen timestamp, response rate, perks, photos, and
  bookmark state.

No-query errors include HSTS and `nosniff`; the endpoint is served through
Cloudflare.

## Glints

Glints allows GraphQL introspection, unlike JobStreet. The collector currently
requests a deliberately small projection, but the schema exposes much more.

`JobSearchResults` fields:

```text
expInfo, hasMore, jobCardUI, jobsInPage,
numberOfJobsCreatedInLast14Days, totalJobs
```

The `Job` type exposes over 60 fields. High-value uncollected groups include:

- Requirements: education, min/max experience, min/max age, gender, foreign
  applications, screening questions, cover-letter/resume/profile requirements.
- Content: description, interview process, attachments, labels, benefits, banner,
  category hierarchy, and job source.
- Hiring quality: actively hiring, hot-job, response-rate/time, high-response flag,
  expiry/closed/start/end dates, and external apply URL.
- Compensation: salary visibility, structured salary (including payment
  frequency), and salary estimates.
- Location: hierarchical location IDs and names, country code, level, slug,
  latitude/longitude, parent/child hierarchy, and company address/POI.
- Employer: company ID, brand/display name, industry, size, address, website,
  tagline, status, verification tier, VIP/hiring flags, photos, social sites, and
  video.

Anonymous page 1 returned 50 jobs and `hasMore: true`; page 2 remains login-gated.
The response advertises `WWW-Authenticate: JWT realm=glints`, uses
`Cache-Control: no-cache`, and includes HSTS, frame, referrer, and content-type
security headers.

## Local Next.js Routes

The application has two route handlers:

- `GET /query/api?q=...`: missing/blank `q` returns HTTP 400 with
  `{ "error": "Missing ?q=" }`. A configured Gemini + Supabase path returns
  `{ q, mode: "sql", sql, count, rows }`; otherwise it returns
  `{ q, mode: "fallback", llmError, count, jobs }`.
- `GET /dataset/export?format=csv|json`: returns the normalized dataset as an
  attachment. Missing or unknown `format` returns JSON; only the exact value `csv`
  selects CSV.

Per the bundled Next.js 16.2.9 documentation, route handlers are not cached by
default and unsupported methods receive HTTP 405.

## Collection Priorities

1. Add Glints result-level totals and selected job fields that improve filtering:
   experience, education, expiry, salary visibility, and hiring signals.
2. Preserve Dealls and Kalibrr metadata in `raw`, but explicitly define a privacy
   allowlist before exposing author/recruiter or precise-coordinate fields.
3. Add contract probes that validate envelope keys, ordering, page size/caps, and
   nullability without storing sample payloads in git.
4. Record each probe timestamp because counts, client-version headers, and schema
   fields are volatile.
