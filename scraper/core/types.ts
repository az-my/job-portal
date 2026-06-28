export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employer' | 'candidate';
  createdAt: string;
  bio?: string;
  skills?: string[];
  resumeUrl?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'remote' | 'contract';
  description: string;
  salary: string;
  postedBy: string;
  createdAt: string;
  requirements?: string;
  source?: string;
  sourceId?: string;
  url?: string;
  logoUrl?: string;
  raw?: string;
}

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  status: 'applied' | 'interviewing' | 'offered' | 'rejected';
  resumeUrl?: string;
  coverLetter?: string;
  appliedAt: string;
}

export interface DbSchema {
  users: User[];
  jobs: Job[];
  applications: Application[];
}

export interface ScraperSource {
  name: string;
  baseUrl: string;
}

export interface JobCounts {
  classification: CountItem[];
  location: CountItem[];
  worktype: CountItem[];
}

export interface CountItem {
  count: number;
  facet: string;
}
