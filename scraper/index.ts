import { runScraper, type SourceFilter } from './orchestrator';

const VALID_SOURCES: SourceFilter[] = ['all', 'jobstreet', 'dealls'];

async function main() {
  const maxPages = parseInt(process.argv[2] || '3', 10);
  const sourceArg = (process.argv[3] || 'all') as SourceFilter;

  if (!VALID_SOURCES.includes(sourceArg)) {
    console.error(`[scraper] Invalid source "${sourceArg}". Use: ${VALID_SOURCES.join(', ')}`);
    process.exit(1);
  }

  console.log(`[scraper] Job Portal Scraper v0.1`);
  console.log(`[scraper] Max pages: ${maxPages}, source: ${sourceArg}`);
  console.log('');

  const results = await runScraper(maxPages, sourceArg);

  console.log('');
  console.log('[scraper] Summary:');
  for (const r of results) {
    console.log(`  ${r.source}: ${r.jobsFound} jobs (${r.jobsInserted} new, ${r.jobsUpdated} updated)`);
  }
}

main().catch(err => {
  console.error('[scraper] Fatal:', err);
  process.exit(1);
});
