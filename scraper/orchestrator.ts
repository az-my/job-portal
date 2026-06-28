import { collectJobs, collectJobCounts } from './functions/collect/jobstreet';
import { normalizeJobs } from './functions/transform/normalize';
import { mergeJobs, getStats } from './functions/publish/storage';

export interface RunResult {
  source: string;
  jobsFound: number;
  jobsInserted: number;
  jobsUpdated: number;
  counts?: {
    classification: number;
    location: number;
    worktype: number;
  };
}

export async function runScraper(maxPages: number = 3): Promise<RunResult[]> {
  const results: RunResult[] = [];

  console.log('[scraper] Starting JobStreet scrape...');

  try {
    const [searchResult, counts] = await Promise.all([
      collectJobs(1, 22),
      collectJobCounts(1, 22).catch((e) => {
        console.warn('[scraper] JobCounts query failed:', e.message);
        return null;
      }),
    ]);

    if (!searchResult?.data) {
      console.warn('[scraper] Search returned no data, skipping.');
      return results;
    }

    const allItems = [...searchResult.data];

    const totalPages = Math.min(maxPages, Math.ceil(searchResult.totalCount / 22));
    for (let p = 2; p <= totalPages; p++) {
      const page = await collectJobs(p, 22);
      allItems.push(...(page.data || []));
    }

    const normalized = await normalizeJobs(allItems);
    const { inserted, updated } = mergeJobs(normalized);
    const stats = getStats();

    results.push({
      source: 'jobstreet',
      jobsFound: allItems.length,
      jobsInserted: inserted,
      jobsUpdated: updated,
      counts: counts
        ? {
            classification: counts.classification.length,
            location: counts.location.length,
            worktype: counts.worktype.length,
          }
        : undefined,
    });

    console.log(`[scraper] Done: ${allItems.length} jobs found, ${inserted} new, ${updated} updated`);
    console.log(`[scraper] Total in DB: ${stats.totalJobs} jobs`);

    if (counts) {
      console.log(`[scraper] Categories: ${counts.classification.length}, Locations: ${counts.location.length}, Types: ${counts.worktype.length}`);
    }
  } catch (err) {
    console.error('[scraper] Error:', err instanceof Error ? err.message : err);
  }

  return results;
}
