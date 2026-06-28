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

export function cleanupJobs(daysOld: number = 7): { removed: number; removedManual: number } {
  const db = readDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  let removed = 0;
  let removedManual = 0;

  const before = db.jobs.length;
  db.jobs = db.jobs.filter(j => {
    if (!j.source) { removedManual++; return false; }
    const d = new Date(j.createdAt);
    if (isNaN(d.getTime()) || d < cutoff) { removed++; return false; }
    return true;
  });

  if (db.jobs.length !== before) {
    writeDb(db);
  }
  return { removed, removedManual };
}

export function getAllJobs(): Job[] {
  return readDb().jobs;
}

export function getStats() {
  const db = readDb();
  const sourceCounts: Record<string, number> = {};
  for (const j of db.jobs) {
    sourceCounts[j.source || 'manual'] = (sourceCounts[j.source || 'manual'] || 0) + 1;
  }
  return {
    totalJobs: db.jobs.length,
    sourceCounts,
  };
}
