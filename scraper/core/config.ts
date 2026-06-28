import type { ScraperSource } from './types';

export const SCRAPER_SOURCES: ScraperSource[] = [
  { name: 'jobstreet', baseUrl: 'https://id.jobstreet.com' },
  { name: 'dealls', baseUrl: 'https://dealls.com' },
];

export const JOBSTREET_GRAPHQL = 'https://id.jobstreet.com/graphql';

export const DEALLS_API = 'https://api.sejutacita.id/v1/explore-job/job';

export const DEFAULT_HEADERS: Record<string, string> = {
  accept: '*/*',
  'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'content-type': 'application/json',
  priority: 'u=1, i',
  'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"iOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'seek-request-brand': 'jobstreet',
  'seek-request-country': 'ID',
  'x-custom-features': 'application/features.seek.all+json',
  'x-seek-site': 'chalice',
};

export const DEALLS_HEADERS: Record<string, string> = {
  accept: '*/*',
  'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'content-type': 'application/json',
  'x-client-app-name': 'Deall-Talent-Web',
  'x-client-app-version': '2.49.52',
  Referer: 'https://dealls.com/',
};

export const DEFAULT_TIMEOUT = 30_000;

export const SESSION_ID = 'b15aa248-7c65-44d3-8680-fd47f5e8dd2e';
export const SOL_ID = '42c1c002-9fc0-406e-8fad-e87359f019bd';
