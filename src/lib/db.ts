import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Job, DbSchema } from '../../scraper/core/types';

export type { Job, DbSchema };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_DIR = path.join(PROJECT_ROOT, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultDb: DbSchema = {
  users: [],
  jobs: [],
  applications: [],
};

export function initDb(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
  }
}

export function getDb(): DbSchema {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data) as DbSchema;
  } catch {
    return defaultDb;
  }
}

export function saveDb(db: DbSchema): void {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
