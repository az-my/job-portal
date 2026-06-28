"use server";

import { revalidatePath } from "next/cache";
import { getDb, saveDb, User, Job, Application } from "@/lib/db";

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

export async function getUsers() {
  const db = getDb();
  return db.users;
}

export async function addUser(data: {
  email: string;
  name: string;
  role: 'admin' | 'employer' | 'candidate';
  bio?: string;
  skills?: string[];
  resumeUrl?: string;
}) {
  const db = getDb();
  
  // Check if user already exists
  const existingUser = db.users.find(u => u.email.toLowerCase() === data.email.toLowerCase());
  if (existingUser) {
    return { success: false, error: "A user with this email already exists." };
  }

  const newUser: User = {
    id: generateId("user"),
    email: data.email,
    name: data.name,
    role: data.role,
    createdAt: new Date().toISOString(),
    bio: data.bio || "",
    skills: data.skills || [],
    resumeUrl: data.resumeUrl || ""
  };

  db.users.push(newUser);
  saveDb(db);
  
  revalidatePath("/");
  return { success: true, user: newUser };
}

export async function getJobs() {
  const db = getDb();
  return db.jobs;
}

export async function addJob(data: {
  title: string;
  company: string;
  location: string;
  type: Job['type'];
  description: string;
  salary: string;
  postedBy: string;
  requirements?: string;
}) {
  const db = getDb();
  
  const newJob: Job = {
    id: generateId("job"),
    title: data.title,
    company: data.company,
    location: data.location,
    type: data.type,
    description: data.description,
    salary: data.salary,
    postedBy: data.postedBy,
    createdAt: new Date().toISOString(),
    requirements: data.requirements || ""
  };

  db.jobs.push(newJob);
  saveDb(db);
  
  revalidatePath("/");
  return { success: true, job: newJob };
}

export async function getApplications() {
  const db = getDb();
  return db.applications;
}

export async function applyJob(data: {
  jobId: string;
  userId: string;
  coverLetter?: string;
  resumeUrl?: string;
}) {
  const db = getDb();
  
  // Check if already applied
  const alreadyApplied = db.applications.some(
    app => app.jobId === data.jobId && app.userId === data.userId
  );
  if (alreadyApplied) {
    return { success: false, error: "You have already applied for this job." };
  }

  const newApplication: Application = {
    id: generateId("app"),
    jobId: data.jobId,
    userId: data.userId,
    status: 'applied',
    resumeUrl: data.resumeUrl || "",
    coverLetter: data.coverLetter || "",
    appliedAt: new Date().toISOString()
  };

  db.applications.push(newApplication);
  saveDb(db);
  
  revalidatePath("/");
  return { success: true, application: newApplication };
}

export async function updateApplicationStatus(applicationId: string, status: Application['status']) {
  const db = getDb();
  const appIndex = db.applications.findIndex(app => app.id === applicationId);
  
  if (appIndex === -1) {
    return { success: false, error: "Application not found." };
  }

  db.applications[appIndex].status = status;
  saveDb(db);
  
  revalidatePath("/");
  return { success: true };
}
