import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'remote' | 'contract';
  description: string;
  salary: string;
  createdAt: string;
  requirements?: string;
  source?: string;
  sourceId?: string;
  url?: string;
  logoUrl?: string;
  raw?: string;
}

export interface DbSchema {
  jobs: Job[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_FILE = path.join(PROJECT_ROOT, 'data', 'db.json');

export function getDb(): DbSchema {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch {
    return { jobs: [] };
  }
}
