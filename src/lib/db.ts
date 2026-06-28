import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { User, Job, Application, DbSchema } from '../../scraper/core/types';

export type { User, Job, Application, DbSchema };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_DIR = path.join(PROJECT_ROOT, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultDb: DbSchema = {
  users: [
    {
      id: 'user-1',
      email: 'dedisuhaimiacc@gmail.com',
      name: 'Dedi Suhaimi',
      role: 'admin',
      createdAt: '2026-06-28T13:30:10.000Z',
      bio: 'Lead platform developer and system administrator.',
      skills: ['Next.js', 'TypeScript', 'React', 'Node.js', 'Tailwind CSS'],
      resumeUrl: '',
    },
    {
      id: 'user-2',
      email: 'john.employer@example.com',
      name: 'John Employer',
      role: 'employer',
      createdAt: '2026-06-28T13:31:00.000Z',
      bio: 'Hiring manager at TechCorp looking for talented developers.',
      skills: [],
      resumeUrl: '',
    },
    {
      id: 'user-3',
      email: 'sarah.candidate@example.com',
      name: 'Sarah Candidate',
      role: 'candidate',
      createdAt: '2026-06-28T13:32:00.000Z',
      bio: 'Frontend developer with 3 years of experience. Loves React.',
      skills: ['HTML', 'CSS', 'JavaScript', 'Tailwind CSS', 'React'],
      resumeUrl: 'https://example.com/resumes/sarah.pdf',
    },
  ],
  jobs: [
    {
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      company: 'TechCorp',
      location: 'Remote (US)',
      type: 'full-time',
      description: 'We are looking for a Senior Frontend Engineer to build high-performance web applications using React and Tailwind CSS...',
      salary: '$120,000 - $150,000',
      postedBy: 'user-2',
      createdAt: '2026-06-28T10:00:00.000Z',
      requirements: '5+ years React experience, Proficiency in Tailwind CSS, TypeScript',
    },
    {
      id: 'job-2',
      title: 'React Developer',
      company: 'DesignHub',
      location: 'New York, NY',
      type: 'contract',
      description: 'Join our creative team to build beautiful marketing sites and client portals...',
      salary: '$80 - $100 / hr',
      postedBy: 'user-2',
      createdAt: '2026-06-28T11:00:00.000Z',
      requirements: 'Strong CSS/HTML foundation, Tailwind CSS, 3+ years React',
    },
  ],
  applications: [
    {
      id: 'app-1',
      jobId: 'job-1',
      userId: 'user-3',
      status: 'applied',
      resumeUrl: 'https://example.com/resumes/sarah.pdf',
      coverLetter: 'I would love to join TechCorp as a Senior Frontend Engineer...',
      appliedAt: '2026-06-28T12:00:00.000Z',
    },
  ],
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
  } catch (err) {
    console.error('Failed to read db file, returning default:', err);
    return defaultDb;
  }
}

export function saveDb(db: DbSchema): void {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
