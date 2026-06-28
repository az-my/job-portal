import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DbSchema, Job } from '../../core/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DB_DIR = path.join(PROJECT_ROOT, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

let cachedDb: DbSchema | null = null;

function readDb(): DbSchema {
  if (cachedDb) return cachedDb;
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    cachedDb = JSON.parse(data);
  } catch {
    cachedDb = null;
  }
  return cachedDb || { users: [], jobs: [], applications: [] };
}

function writeDb(db: DbSchema): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  cachedDb = db;
}

export function mergeJobs(newJobs: Job[]): { inserted: number; updated: number } {
  const db = readDb();
  let inserted = 0;
  let updated = 0;

  for (const job of newJobs) {
    const existingIndex = job.sourceId
      ? db.jobs.findIndex(j => j.sourceId === job.sourceId)
      : -1;

    if (existingIndex >= 0) {
      db.jobs[existingIndex] = { ...db.jobs[existingIndex], ...job };
      updated++;
    } else {
      db.jobs.push(job);
      inserted++;
    }
  }

  writeDb(db);
  return { inserted, updated };
}

export function getAllJobs(): Job[] {
  return readDb().jobs;
}

export function getStats() {
  const db = readDb();
  return {
    totalJobs: db.jobs.length,
    totalUsers: db.users.length,
    totalApplications: db.applications.length,
    scrapedJobs: db.jobs.filter(j => j.source === 'jobstreet').length,
  };
}
