import { runScraper } from './orchestrator';

async function main() {
  const maxPages = parseInt(process.argv[2] || '3', 10);
  console.log(`[scraper] Job Portal Scraper v0.1`);
  console.log(`[scraper] Max pages: ${maxPages}`);
  console.log('');

  const results = await runScraper(maxPages);

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
