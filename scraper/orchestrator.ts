import { collectJobs, collectJobCounts } from './functions/collect/jobstreet';
import { collectDeallsJobs } from './functions/collect/dealls';
import { normalizeJobs } from './functions/transform/normalize';
import { mergeJobs, getStats, cleanupJobs } from './functions/publish/storage';

export interface RunResult {
  source: string;
  jobsFound: number;
  jobsInserted: number;
  jobsUpdated: number;
}

export type SourceFilter = 'all' | 'jobstreet' | 'dealls';

function filterRecent(items: Record<string, any>[], source: string): Record<string, any>[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  return items.filter(item => {
    const dateStr = source === 'dealls' ? item.publishedAt : null;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}

async function runJobStreet(maxPages: number): Promise<RunResult | null> {
  console.log('[scraper] Starting JobStreet scrape...');
  const [searchResult] = await Promise.all([
    collectJobs(1, 22),
    collectJobCounts(1, 22).catch((e) => {
      console.warn('[scraper] JobCounts query failed:', e.message);
      return null;
    }),
  ]);

  if (!searchResult?.data) {
    console.warn('[scraper] JobStreet search returned no data, skipping.');
    return null;
  }

  const allItems = [...searchResult.data];
  const totalPages = Math.min(maxPages, Math.ceil(searchResult.totalCount / 22));
  for (let p = 2; p <= totalPages; p++) {
    const page = await collectJobs(p, 22);
    allItems.push(...(page.data || []));
  }

  const normalized = await normalizeJobs(allItems, 'jobstreet');
  const { inserted, updated } = mergeJobs(normalized);

  console.log(`[scraper] JobStreet done: ${allItems.length} jobs found, ${inserted} new, ${updated} updated`);
  return { source: 'jobstreet', jobsFound: allItems.length, jobsInserted: inserted, jobsUpdated: updated };
}

async function runDealls(maxPages: number): Promise<RunResult | null> {
  console.log('[scraper] Starting Dealls scrape...');
  const raw = await collectDeallsJobs(maxPages);
  const recent = filterRecent(raw, 'dealls');
  const skipped = raw.length - recent.length;
  if (skipped > 0) console.log(`[scraper] Dealls: skipped ${skipped} jobs older than 7 days`);

  if (recent.length === 0) {
    console.warn('[scraper] Dealls returned no recent data, skipping.');
    return null;
  }

  const normalized = await normalizeJobs(recent, 'dealls');
  const { inserted, updated } = mergeJobs(normalized);

  console.log(`[scraper] Dealls done: ${recent.length} jobs found, ${inserted} new, ${updated} updated`);
  return { source: 'dealls', jobsFound: recent.length, jobsInserted: inserted, jobsUpdated: updated };
}

export async function runScraper(maxPages: number = 3, source: SourceFilter = 'all'): Promise<RunResult[]> {
  const results: RunResult[] = [];

  if (source === 'all' || source === 'jobstreet') {
    try {
      const r = await runJobStreet(maxPages);
      if (r) results.push(r);
    } catch (err) {
      console.error('[scraper] JobStreet error:', err instanceof Error ? err.message : err);
    }
  }

  if (source === 'all' || source === 'dealls') {
    try {
      const r = await runDealls(maxPages);
      if (r) results.push(r);
    } catch (err) {
      console.error('[scraper] Dealls error:', err instanceof Error ? err.message : err);
    }
  }

  // --- Cleanup: remove manual-source & old jobs ---
  console.log('[scraper] Running cleanup...');
  const { removed, removedManual } = cleanupJobs(7);
  if (removed > 0) console.log(`[scraper] Cleanup: removed ${removed} old jobs`);
  if (removedManual > 0) console.log(`[scraper] Cleanup: removed ${removedManual} manual-source jobs`);

  // --- Summary ---
  const stats = getStats();
  console.log(`[scraper] Total in DB: ${stats.totalJobs} jobs`);
  for (const r of results) {
    console.log(`[scraper] Done: ${r.jobsFound} jobs found from ${r.source}`);
  }

  return results;
}
