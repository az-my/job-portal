import type { Job } from '../../core/types';
import { generateId } from '../../core/utils';

export function normalizeJob(item: Record<string, any>): Job {
  const desc = Array.isArray(item.bulletPoints)
    ? item.bulletPoints.join('\n')
    : item.bulletPoints || '';

  return {
    id: generateId('job'),
    title: item.title || 'Untitled',
    company: item.advertiser?.description || 'Unknown Company',
    location: '',
    type: 'full-time',
    description: desc,
    salary: item.salaryLabel || '',
    postedBy: 'scraper',
    createdAt: new Date().toISOString(),
    source: 'jobstreet',
    sourceId: String(item.id),
    url: `https://id.jobstreet.com/jobs/${item.id}`,
    logoUrl: '',
  };
}

export async function normalizeJobs(items: Record<string, any>[]): Promise<Job[]> {
  return items.map(normalizeJob);
}
