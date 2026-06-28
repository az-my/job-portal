import type { Job } from '../../core/types';
import { generateId } from '../../core/utils';

function formatSalary(start: number | null, end: number | null): string {
  if (!start && !end) return '';
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
    if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
    return `Rp${n}`;
  };
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return `≥ ${fmt(start)}`;
  if (end) return `≤ ${fmt(end)}`;
  return '';
}

function mapEmploymentType(t: string): Job['type'] {
  switch (t) {
    case 'fullTime': return 'full-time';
    case 'partTime': return 'part-time';
    case 'remote': return 'remote';
    case 'contract': return 'contract';
    default: return 'full-time';
  }
}

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
    raw: JSON.stringify(item),
  };
}

export function normalizeDeallsJob(doc: Record<string, any>): Job {
  const skills = Array.isArray(doc.skills)
    ? doc.skills.map((s: any) => s.name).join(', ')
    : '';
  const location = [doc.city?.name, doc.country?.name].filter(Boolean).join(', ');

  return {
    id: generateId('job'),
    title: doc.role || 'Untitled',
    company: doc.company?.name || 'Unknown Company',
    location,
    type: mapEmploymentType(doc.employmentTypes?.[0] || 'fullTime'),
    description: `${doc.role || ''} at ${doc.company?.name || 'Unknown Company'}${skills ? `. Skills: ${skills}` : ''}`,
    salary: doc.salaryRange ? formatSalary(doc.salaryRange.start, doc.salaryRange.end) : '',
    postedBy: 'scraper',
    createdAt: doc.publishedAt || new Date().toISOString(),
    source: 'dealls',
    sourceId: String(doc.id),
    url: `https://dealls.com/jobs/${doc.slug}`,
    logoUrl: doc.company?.logoUrl || '',
    requirements: skills || undefined,
    raw: JSON.stringify(doc),
  };
}

export async function normalizeJobs(items: Record<string, any>[], source: string = 'jobstreet'): Promise<Job[]> {
  if (source === 'dealls') {
    return items.map(normalizeDeallsJob);
  }
  return items.map(normalizeJob);
}
