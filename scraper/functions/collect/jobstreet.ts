import { JOBSTREET_GRAPHQL, DEFAULT_HEADERS, SESSION_ID, SOL_ID } from '../../core/config';
import type { JobCounts } from '../../core/types';

const COMMON_VARS = {
  channel: 'web',
  eventCaptureSessionId: SESSION_ID,
  eventCaptureUserId: SESSION_ID,
  include: ['seoData', 'gptTargeting'],
  locale: 'id-ID',
  siteKey: 'ID',
  solId: SOL_ID,
  userSessionId: SESSION_ID,
};

async function graphqlRequest<T>(query: string, operationName: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(JOBSTREET_GRAPHQL, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      cookie: [
        `sol_id=${SOL_ID}`,
        `JobseekerSessionId=${SESSION_ID}`,
        `JobseekerVisitorId=${SESSION_ID}`,
      ].join('; '),
      Referer: 'https://id.jobstreet.com/',
    },
    body: JSON.stringify({
      operationName,
      variables: { params: { ...COMMON_VARS, ...variables } },
      query,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JobStreet API error: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
  }

  return json.data;
}

const JOB_COUNTS_QUERY = `
  query JobCountsV6($params: JobSearchV6QueryInput!) {
    jobCountsV6(params: $params) {
      classification { count facet __typename }
      location { count facet __typename }
      worktype { count facet __typename }
      __typename
    }
  }
`;

export async function collectJobCounts(page: number = 1, pageSize: number = 22): Promise<JobCounts> {
  const data = await graphqlRequest<{ jobCountsV6: JobCounts }>(
    JOB_COUNTS_QUERY,
    'JobCountsV6',
    { page, pageSize }
  );
  return data.jobCountsV6;
}

const JOB_SEARCH_QUERY = `
  query JobSearchV6($params: JobSearchV6QueryInput!) {
    jobSearchV6(params: $params) {
      totalCount
      data {
        id
        title
        advertiser {
          description
          __typename
        }
        bulletPoints
        salaryLabel
        listingDate { __typename }
      __typename
      }
      __typename
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobSearchItem = Record<string, any>;

interface JobSearchResponse {
  jobSearchV6: {
    totalCount: number;
    data: JobSearchItem[];
  };
}

export async function collectJobs(page: number = 1, pageSize: number = 22): Promise<{
  totalCount: number;
  data: JobSearchItem[];
}> {
  const res = await graphqlRequest<JobSearchResponse>(
    JOB_SEARCH_QUERY,
    'JobSearchV6',
    { page, pageSize }
  );
  return res.jobSearchV6;
}

export async function collectAllJobs(maxPages: number = 5): Promise<JobSearchItem[]> {
  const all: JobSearchItem[] = [];
  const first = await collectJobs(1, 22);
  all.push(...first.data);
  const totalPages = Math.min(maxPages, Math.ceil(first.totalCount / 22));
  for (let p = 2; p <= totalPages; p++) {
    const page = await collectJobs(p, 22);
    all.push(...page.data);
  }
  return all;
}
