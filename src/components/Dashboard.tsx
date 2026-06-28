"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Briefcase,
  User as UserIcon,
  Plus,
  Search,
  Mail,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowRight,
  Shield,
  FileText,
  AlertTriangle
} from "lucide-react";
import { User, Job, Application } from "@/lib/db";
import { addUser, addJob, applyJob, updateApplicationStatus, getUsers, getJobs } from "@/app/actions";

interface DashboardProps {
  initialUsers: User[];
  initialJobs: Job[];
  initialApplications: Application[];
}

export default function Dashboard({
  initialUsers,
  initialJobs,
  initialApplications
}: DashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [applications, setApplications] = useState<Application[]>(initialApplications);

  // Active simulated user
  const [activeUserId, setActiveUserId] = useState<string>("user-1"); // Dedi Suhaimi (Admin)
  const activeUser = users.find(u => u.id === activeUserId) || users[0];

  // UI Tabs: 'jobs' | 'dashboard' | 'users'
  const [activeTab, setActiveTab] = useState<"jobs" | "dashboard" | "users">("jobs");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");

  // Form states
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<User["role"]>("candidate");
  const [newUserBio, setNewUserBio] = useState("");
  const [newUserSkills, setNewUserSkills] = useState("");

  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobCompany, setNewJobCompany] = useState("");
  const [newJobLocation, setNewJobLocation] = useState("");
  const [newJobType, setNewJobType] = useState<Job["type"]>("full-time");
  const [newJobSalary, setNewJobSalary] = useState("");
  const [newJobDescription, setNewJobDescription] = useState("");
  const [newJobRequirements, setNewJobRequirements] = useState("");

  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyCoverLetter, setApplyCoverLetter] = useState("");
  const [applyResumeUrl, setApplyResumeUrl] = useState("");

  // Feedback notifications
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleSetNotification = (info: string | null, error: string | null = null) => {
    setInfoMessage(info);
    setErrorMessage(error);
    if (info || error) {
      setTimeout(() => {
        setInfoMessage(null);
        setErrorMessage(null);
      }, 5000);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) {
      handleSetNotification(null, "Name and Email are required.");
      return;
    }

    startTransition(async () => {
      const res = await addUser({
        email: newUserEmail,
        name: newUserName,
        role: newUserRole,
        bio: newUserBio,
        skills: newUserSkills.split(",").map(s => s.trim()).filter(Boolean)
      });

      if (res.success && res.user) {
        setUsers(prev => [...prev, res.user!]);
        handleSetNotification(`User ${res.user.name} successfully created!`);
        setShowAddUser(false);
        setNewUserEmail("");
        setNewUserName("");
        setNewUserRole("candidate");
        setNewUserBio("");
        setNewUserSkills("");
      } else {
        handleSetNotification(null, res.error || "Failed to create user.");
      }
    });
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle || !newJobCompany || !newJobLocation || !newJobSalary || !newJobDescription) {
      handleSetNotification(null, "Please fill in all required job fields.");
      return;
    }

    startTransition(async () => {
      const res = await addJob({
        title: newJobTitle,
        company: newJobCompany,
        location: newJobLocation,
        type: newJobType,
        description: newJobDescription,
        salary: newJobSalary,
        requirements: newJobRequirements,
        postedBy: activeUser.id
      });

      if (res.success && res.job) {
        setJobs(prev => [res.job!, ...prev]);
        handleSetNotification(`Job posting "${res.job.title}" created successfully!`);
        setShowAddJob(false);
        setNewJobTitle("");
        setNewJobCompany("");
        setNewJobLocation("");
        setNewJobType("full-time");
        setNewJobSalary("");
        setNewJobDescription("");
        setNewJobRequirements("");
      } else {
        handleSetNotification(null, "Failed to create job posting.");
      }
    });
  };

  const handleApplyJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJobId) return;

    startTransition(async () => {
      const res = await applyJob({
        jobId: applyingJobId,
        userId: activeUser.id,
        coverLetter: applyCoverLetter,
        resumeUrl: applyResumeUrl
      });

      if (res.success && res.application) {
        setApplications(prev => [...prev, res.application!]);
        handleSetNotification("Application submitted successfully!");
        setApplyingJobId(null);
        setApplyCoverLetter("");
        setApplyResumeUrl("");
      } else {
        handleSetNotification(null, res.error || "Failed to submit application.");
      }
    });
  };

  const handleStatusChange = async (appId: string, status: Application["status"]) => {
    startTransition(async () => {
      const res = await updateApplicationStatus(appId, status);
      if (res.success) {
        setApplications(prev =>
          prev.map(app => (app.id === appId ? { ...app, status } : app))
        );
        handleSetNotification(`Application status updated to ${status}.`);
      } else {
        handleSetNotification(null, res.error || "Failed to update application status.");
      }
    });
  };

  // Filter and search jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.requirements && job.requirements.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = jobTypeFilter === "all" || job.type === jobTypeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col min-h-screen bg-zinc-100 text-zinc-900 font-mono antialiased dark:bg-zinc-950 dark:text-zinc-50">
      {/* Top Banner / Solid Header */}
      <header className="border-b-4 border-black bg-yellow-400 p-4 text-black dark:bg-yellow-500">
        <div className="mx-auto flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Solid Grid Job Portal</h1>
            <p className="text-xs font-bold uppercase tracking-wider">High Density / High Contrast Workspaces</p>
          </div>

          {/* Persona Switcher */}
          <div className="flex items-center gap-2 border-2 border-black bg-white p-2 text-sm dark:bg-zinc-900 dark:text-white dark:border-white">
            <span className="font-bold uppercase text-xs">Simulated User:</span>
            <select
              value={activeUserId}
              onChange={e => {
                setActiveUserId(e.target.value);
                // Reset job application form if switching user
                setApplyingJobId(null);
              }}
              className="bg-transparent font-bold outline-none cursor-pointer"
            >
              {users.map(u => (
                <option key={u.id} value={u.id} className="text-black dark:text-white">
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Info / Error Alerts */}
      {infoMessage && (
        <div className="border-b-2 border-black bg-green-500 p-2 text-center text-xs font-black uppercase text-white">
          {infoMessage}
        </div>
      )}
      {errorMessage && (
        <div className="border-b-2 border-black bg-red-600 p-2 text-center text-xs font-black uppercase text-white flex items-center justify-center gap-2">
          <AlertTriangle className="size-4" /> {errorMessage}
        </div>
      )}

      {/* Main Grid Wrapper */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar - Profile & Quick Statistics */}
        <section className="lg:col-span-1 border-4 border-black bg-white p-4 flex flex-col gap-4 rounded-none dark:bg-zinc-900 dark:border-zinc-800">
          <div className="border-b-2 border-dashed border-zinc-300 pb-4 dark:border-zinc-700">
            <h2 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
              <UserIcon className="size-5" /> Profile info
            </h2>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-bold uppercase text-zinc-500">Name:</span>
                <span className="font-bold">{activeUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold uppercase text-zinc-500">Email:</span>
                <span className="font-bold select-all">{activeUser.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-zinc-500">Role:</span>
                <span className="bg-zinc-900 text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] dark:bg-zinc-100 dark:text-black">
                  {activeUser.role}
                </span>
              </div>
              {activeUser.bio && (
                <div className="mt-2 text-zinc-600 dark:text-zinc-400 border border-zinc-200 p-1.5 dark:border-zinc-800">
                  {activeUser.bio}
                </div>
              )}
              {activeUser.skills && activeUser.skills.length > 0 && (
                <div className="mt-2">
                  <span className="font-bold uppercase text-zinc-500 block mb-1">Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {activeUser.skills.map(s => (
                      <span key={s} className="border border-black bg-zinc-100 px-1 py-0.5 text-[9px] font-bold dark:bg-zinc-800 dark:border-zinc-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats box */}
          <div className="border-2 border-black p-3 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
            <h3 className="text-xs font-black uppercase mb-2">Portal Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="border border-zinc-300 p-1.5 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="font-black text-lg">{jobs.length}</div>
                <div className="text-[9px] uppercase font-bold text-zinc-500">Jobs</div>
              </div>
              <div className="border border-zinc-300 p-1.5 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="font-black text-lg">{users.length}</div>
                <div className="text-[9px] uppercase font-bold text-zinc-500">Users</div>
              </div>
              <div className="col-span-2 border border-zinc-300 p-1.5 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="font-black text-lg">{applications.length}</div>
                <div className="text-[9px] uppercase font-bold text-zinc-500">Applications</div>
              </div>
            </div>
          </div>

          {/* Actions & Links depending on User Role */}
          <div className="mt-auto pt-4 space-y-2 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700">
            {activeUser.role === "employer" && (
              <Button
                onClick={() => {
                  setActiveTab("dashboard");
                  setShowAddJob(true);
                }}
                className="w-full border-2 border-black bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs rounded-none"
              >
                <Plus className="size-4 mr-1" /> Post a Job
              </Button>
            )}
            {activeUser.role === "admin" && (
              <>
                <Button
                  onClick={() => {
                    setActiveTab("dashboard");
                    setShowAddJob(true);
                  }}
                  className="w-full border-2 border-black bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs rounded-none"
                >
                  <Plus className="size-4 mr-1" /> Post a Job
                </Button>
                <Button
                  onClick={() => {
                    setActiveTab("users");
                    setShowAddUser(true);
                  }}
                  className="w-full border-2 border-black bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-xs rounded-none"
                >
                  <Plus className="size-4 mr-1" /> Create User
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Dashboard Tabs & Primary Content */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          {/* Tab switches */}
          <div className="flex border-4 border-black bg-white p-1 rounded-none dark:bg-zinc-900 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("jobs")}
              className={`flex-1 py-2 text-center text-xs font-black uppercase transition-all rounded-none ${
                activeTab === "jobs"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Jobs board
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-1 py-2 text-center text-xs font-black uppercase transition-all rounded-none ${
                activeTab === "dashboard"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              My Dashboard
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 py-2 text-center text-xs font-black uppercase transition-all rounded-none ${
                activeTab === "users"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Users ({users.length})
            </button>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 border-4 border-black bg-white p-4 rounded-none dark:bg-zinc-900 dark:border-zinc-800">
            {/* 1. JOBS BOARD TAB */}
            {activeTab === "jobs" && (
              <div className="space-y-4">
                {/* Search & Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border-2 border-black p-2 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-800">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-500" />
                    <Input
                      type="text"
                      placeholder="Search jobs, companies, skills..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 border border-zinc-400 bg-white font-bold rounded-none dark:bg-zinc-900 dark:border-zinc-700 h-9"
                    />
                  </div>
                  <div>
                    <select
                      value={jobTypeFilter}
                      onChange={e => setJobTypeFilter(e.target.value)}
                      className="w-full h-9 border border-zinc-400 px-2 font-bold uppercase text-xs bg-white dark:bg-zinc-900 dark:border-zinc-700 dark:text-white rounded-none outline-none"
                    >
                      <option value="all">All Types</option>
                      <option value="full-time">Full-Time</option>
                      <option value="part-time">Part-Time</option>
                      <option value="remote">Remote</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                </div>

                {/* Jobs list */}
                <div className="space-y-3">
                  {filteredJobs.length === 0 ? (
                    <div className="border-2 border-dashed border-zinc-400 p-8 text-center uppercase font-bold text-zinc-500 dark:border-zinc-700">
                      No jobs matched your filters.
                    </div>
                  ) : (
                    filteredJobs.map(job => {
                      const hasApplied = applications.some(
                        app => app.jobId === job.id && app.userId === activeUser.id
                      );
                      const myApp = applications.find(
                        app => app.jobId === job.id && app.userId === activeUser.id
                      );

                      return (
                        <div
                          key={job.id}
                          className="border-2 border-black p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30 transition-all rounded-none"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-2">
                            <div>
                              <h3 className="text-base font-black uppercase tracking-tight">{job.title}</h3>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold mt-1 text-zinc-600 dark:text-zinc-400">
                                <span className="bg-yellow-300 text-black px-1.5 py-0.5 text-[9px] uppercase border border-black dark:bg-yellow-500">
                                  {job.company}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" /> {job.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="size-3" /> {job.salary}
                                </span>
                                <span className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black px-1.5 py-0.5 text-[9px] uppercase">
                                  {job.type}
                                </span>
                              </div>
                            </div>

                            {/* Job actions */}
                            {activeUser.role === "candidate" && (
                              <div>
                                {hasApplied ? (
                                  <span className="inline-flex items-center gap-1 bg-zinc-200 border border-zinc-400 text-zinc-800 px-3 py-1.5 text-xs font-black uppercase dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                                    Applied ({myApp?.status.toUpperCase()})
                                  </span>
                                ) : (
                                  <Button
                                    onClick={() => setApplyingJobId(job.id)}
                                    className="border-2 border-black bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-xs rounded-none h-9 px-3"
                                  >
                                    Apply
                                  </Button>
                                )}
                              </div>
                            )}

                            {activeUser.role !== "candidate" && (
                              <div className="text-xs font-black uppercase bg-zinc-200 border border-zinc-400 px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700">
                                {applications.filter(a => a.jobId === job.id).length} Applications
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-zinc-700 dark:text-zinc-300 mb-2 leading-relaxed">
                            {job.description}
                          </p>

                          {job.requirements && (
                            <div className="border-t border-zinc-200 pt-2 mt-2 dark:border-zinc-800">
                              <span className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Requirements:</span>
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                {job.requirements}
                              </p>
                            </div>
                          )}

                          {/* Inline application form */}
                          {applyingJobId === job.id && (
                            <form
                              onSubmit={handleApplyJob}
                              className="mt-3 border-2 border-dashed border-black p-3 bg-yellow-50/50 dark:bg-zinc-950 dark:border-zinc-700 space-y-3"
                            >
                              <h4 className="text-xs font-black uppercase text-black dark:text-white">Apply to {job.company}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Resume Link</Label>
                                  <Input
                                    type="url"
                                    placeholder="https://example.com/your-resume.pdf"
                                    value={applyResumeUrl}
                                    onChange={e => setApplyResumeUrl(e.target.value)}
                                    className="border-zinc-400 bg-white text-xs rounded-none font-bold dark:bg-zinc-900"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Cover Letter</Label>
                                  <Input
                                    type="text"
                                    placeholder="Short message introducing yourself..."
                                    value={applyCoverLetter}
                                    onChange={e => setApplyCoverLetter(e.target.value)}
                                    className="border-zinc-400 bg-white text-xs rounded-none font-bold dark:bg-zinc-900"
                                    required
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  type="button"
                                  onClick={() => setApplyingJobId(null)}
                                  className="border border-zinc-400 bg-white hover:bg-zinc-100 text-black font-black uppercase text-[10px] h-7 rounded-none px-3"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={isPending}
                                  className="border-2 border-black bg-green-500 hover:bg-green-600 text-black font-black uppercase text-[10px] h-7 rounded-none px-3"
                                >
                                  {isPending ? "Submitting..." : "Submit Application"}
                                </Button>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. MY DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <div className="space-y-4">
                {/* Posting jobs form if Open */}
                {showAddJob && (
                  <form
                    onSubmit={handleAddJob}
                    className="border-4 border-black p-4 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
                      <h3 className="text-sm font-black uppercase">Post a New Job Opening</h3>
                      <button
                        type="button"
                        onClick={() => setShowAddJob(false)}
                        className="text-xs font-bold border border-zinc-400 px-1 bg-white hover:bg-zinc-200 text-black"
                      >
                        CLOSE
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Job Title *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Next.js Web Developer"
                          value={newJobTitle}
                          onChange={e => setNewJobTitle(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Company Name *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Antigravity Labs"
                          value={newJobCompany}
                          onChange={e => setNewJobCompany(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Location *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Remote (Anywhere) or Kuala Lumpur"
                          value={newJobLocation}
                          onChange={e => setNewJobLocation(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Job Type *</Label>
                        <select
                          value={newJobType}
                          onChange={e => setNewJobType(e.target.value as Job["type"])}
                          className="w-full h-8 border border-zinc-400 px-2.5 font-bold uppercase text-xs bg-white dark:bg-zinc-900 dark:text-white rounded-none outline-none"
                        >
                          <option value="full-time">Full-Time</option>
                          <option value="part-time">Part-Time</option>
                          <option value="remote">Remote</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Salary *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. $100k - $120k / year"
                          value={newJobSalary}
                          onChange={e => setNewJobSalary(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Key Requirements</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Next.js, React, Tailwind CSS, TypeScript"
                          value={newJobRequirements}
                          onChange={e => setNewJobRequirements(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs font-black uppercase">Job Description *</Label>
                        <textarea
                          placeholder="Provide a detailed job description..."
                          value={newJobDescription}
                          onChange={e => setNewJobDescription(e.target.value)}
                          className="w-full min-h-24 border border-zinc-400 p-2 font-bold bg-white text-xs rounded-none dark:bg-zinc-900 dark:border-zinc-700 outline-none text-zinc-900 dark:text-zinc-50"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        type="button"
                        onClick={() => setShowAddJob(false)}
                        className="border border-zinc-400 bg-white hover:bg-zinc-100 text-black font-black uppercase text-xs rounded-none h-8 px-4"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="border-2 border-black bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs rounded-none h-8 px-4"
                      >
                        {isPending ? "Posting..." : "Create Job Post"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Candidate Dashboard */}
                {activeUser.role === "candidate" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase border-b-2 border-black pb-1">My Submitted Applications</h3>
                    {applications.filter(app => app.userId === activeUser.id).length === 0 ? (
                      <div className="border-2 border-dashed border-zinc-400 p-6 text-center text-xs uppercase font-bold text-zinc-500 dark:border-zinc-700">
                        You have not applied for any jobs yet. Visit the Jobs Board tab.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {applications
                          .filter(app => app.userId === activeUser.id)
                          .map(app => {
                            const job = jobs.find(j => j.id === app.jobId);
                            if (!job) return null;

                            return (
                              <div
                                key={app.id}
                                className="border-2 border-black p-3 bg-zinc-50 dark:bg-zinc-800/40 dark:border-zinc-800 flex justify-between items-center text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="font-bold text-sm uppercase">{job.title}</div>
                                  <div className="font-semibold text-zinc-500 uppercase">{job.company}</div>
                                  <div className="text-[10px] text-zinc-400">Applied: {new Date(app.appliedAt).toLocaleDateString()}</div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                                      app.status === "applied"
                                        ? "bg-blue-200 text-blue-800"
                                        : app.status === "interviewing"
                                        ? "bg-yellow-300 text-yellow-900"
                                        : app.status === "offered"
                                        ? "bg-green-300 text-green-900"
                                        : "bg-red-200 text-red-800"
                                    }`}
                                  >
                                    {app.status}
                                  </span>
                                  {app.resumeUrl && (
                                    <a
                                      href={app.resumeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-bold underline text-blue-600 dark:text-blue-400 flex items-center gap-0.5"
                                    >
                                      <FileText className="size-3" /> Resume Link
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Employer Dashboard */}
                {activeUser.role === "employer" && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-3">
                        <h3 className="text-sm font-black uppercase">Applications For My Jobs</h3>
                        {!showAddJob && (
                          <Button
                            onClick={() => setShowAddJob(true)}
                            className="h-7 border border-black bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase text-[10px] rounded-none px-2"
                          >
                            <Plus className="size-3 mr-0.5" /> Post Job
                          </Button>
                        )}
                      </div>

                      {jobs.filter(j => j.postedBy === activeUser.id).length === 0 ? (
                        <div className="border-2 border-dashed border-zinc-400 p-6 text-center text-xs uppercase font-bold text-zinc-500 dark:border-zinc-700">
                          You haven't posted any jobs yet. Click "Post Job" to get started.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {jobs
                            .filter(j => j.postedBy === activeUser.id)
                            .map(job => {
                              const jobApps = applications.filter(a => a.jobId === job.id);

                              return (
                                <div key={job.id} className="border-2 border-black p-3 dark:border-zinc-800">
                                  <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-2 dark:border-zinc-800">
                                    <div>
                                      <span className="text-sm font-black uppercase">{job.title}</span>
                                      <span className="text-xs font-bold text-zinc-400 ml-2">({job.type})</span>
                                    </div>
                                    <span className="text-xs font-bold bg-zinc-100 px-2 py-0.5 border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700">
                                      {jobApps.length} Application(s)
                                    </span>
                                  </div>

                                  {jobApps.length === 0 ? (
                                    <p className="text-xs italic text-zinc-500 uppercase">No candidates have applied yet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {jobApps.map(app => {
                                        const applicant = users.find(u => u.id === app.userId);
                                        if (!applicant) return null;

                                        return (
                                          <div
                                            key={app.id}
                                            className="border border-black p-2 bg-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs dark:bg-zinc-800/30 dark:border-zinc-700"
                                          >
                                            <div className="space-y-1">
                                              <div className="font-bold uppercase text-black dark:text-white">
                                                {applicant.name} ({applicant.email})
                                              </div>
                                              {app.coverLetter && (
                                                <div className="text-zinc-600 dark:text-zinc-400 bg-white border border-zinc-200 p-1.5 font-sans dark:bg-zinc-900 dark:border-zinc-800">
                                                  {app.coverLetter}
                                                </div>
                                              )}
                                              {app.resumeUrl && (
                                                <a
                                                  href={app.resumeUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-0.5 text-blue-600 underline font-bold"
                                                >
                                                  <FileText className="size-3" /> View Resume
                                                </a>
                                              )}
                                            </div>

                                            {/* Status controller */}
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-[10px] uppercase text-zinc-400">Status:</span>
                                              <select
                                                value={app.status}
                                                onChange={e => handleStatusChange(app.id, e.target.value as Application["status"])}
                                                className="border border-zinc-400 px-1 font-bold text-xs uppercase bg-white text-black rounded-none outline-none dark:bg-zinc-900 dark:text-white"
                                              >
                                                <option value="applied">Applied</option>
                                                <option value="interviewing">Interviewing</option>
                                                <option value="offered">Offered</option>
                                                <option value="rejected">Rejected</option>
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin Dashboard */}
                {activeUser.role === "admin" && (
                  <div className="space-y-6">
                    {/* Admin settings */}
                    <div>
                      <h3 className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-3">Admin Console</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* List of all job applications in the portal */}
                        <div className="border-2 border-black p-3 bg-zinc-50 dark:bg-zinc-800/40 dark:border-zinc-800">
                          <h4 className="text-xs font-black uppercase mb-2 border-b border-zinc-300 pb-1">All Global Applications</h4>
                          {applications.length === 0 ? (
                            <p className="text-xs italic uppercase">No applications submitted yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                              {applications.map(app => {
                                const job = jobs.find(j => j.id === app.jobId);
                                const applicant = users.find(u => u.id === app.userId);
                                return (
                                  <div key={app.id} className="border border-zinc-300 p-2 bg-white text-xs dark:bg-zinc-900 dark:border-zinc-800">
                                    <div className="flex justify-between">
                                      <span className="font-bold">{applicant?.name}</span>
                                      <span className="font-black uppercase text-[9px] text-zinc-500">{app.status}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-600 dark:text-zinc-400">
                                      Applied for: <span className="font-bold">{job?.title} ({job?.company})</span>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                      <select
                                        value={app.status}
                                        onChange={e => handleStatusChange(app.id, e.target.value as Application["status"])}
                                        className="text-[9px] border border-zinc-300 font-bold uppercase outline-none bg-transparent"
                                      >
                                        <option value="applied">Applied</option>
                                        <option value="interviewing">Interviewing</option>
                                        <option value="offered">Offered</option>
                                        <option value="rejected">Rejected</option>
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Quick actions box */}
                        <div className="border-2 border-black p-3 bg-zinc-50 dark:bg-zinc-800/40 dark:border-zinc-800 space-y-3">
                          <h4 className="text-xs font-black uppercase border-b border-zinc-300 pb-1">System Operations</h4>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                            As an admin, you have access to modify statuses across the entire system.
                          </p>
                          <div className="space-y-2">
                            <Button
                              onClick={() => {
                                setActiveTab("users");
                                setShowAddUser(true);
                              }}
                              className="w-full border border-black bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-xs rounded-none"
                            >
                              Add New User
                            </Button>
                            <Button
                              onClick={() => {
                                setActiveTab("dashboard");
                                setShowAddJob(true);
                              }}
                              className="w-full border border-black bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs rounded-none"
                            >
                              Post a New Job
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. USERS TAB */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {/* Creating user form if Open */}
                {showAddUser && (
                  <form
                    onSubmit={handleAddUser}
                    className="border-4 border-black p-4 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
                      <h3 className="text-sm font-black uppercase">Create New User Profile</h3>
                      <button
                        type="button"
                        onClick={() => setShowAddUser(false)}
                        className="text-xs font-bold border border-zinc-400 px-1 bg-white hover:bg-zinc-200 text-black"
                      >
                        CLOSE
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Email Address *</Label>
                        <Input
                          type="email"
                          placeholder="e.g. dedisuhaimiacc@gmail.com"
                          value={newUserEmail}
                          onChange={e => setNewUserEmail(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Full Name *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Dedi Suhaimi"
                          value={newUserName}
                          onChange={e => setNewUserName(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Role *</Label>
                        <select
                          value={newUserRole}
                          onChange={e => setNewUserRole(e.target.value as User["role"])}
                          className="w-full h-8 border border-zinc-400 px-2.5 font-bold uppercase text-xs bg-white dark:bg-zinc-900 dark:text-white rounded-none outline-none"
                        >
                          <option value="candidate">Candidate</option>
                          <option value="employer">Employer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-black uppercase">Skills (comma-separated)</Label>
                        <Input
                          type="text"
                          placeholder="e.g. React, Next.js, CSS"
                          value={newUserSkills}
                          onChange={e => setNewUserSkills(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs font-black uppercase">Profile Bio / Description</Label>
                        <Input
                          type="text"
                          placeholder="Brief description about this user..."
                          value={newUserBio}
                          onChange={e => setNewUserBio(e.target.value)}
                          className="border-zinc-400 font-bold bg-white text-xs rounded-none dark:bg-zinc-900"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        type="button"
                        onClick={() => setShowAddUser(false)}
                        className="border border-zinc-400 bg-white hover:bg-zinc-100 text-black font-black uppercase text-xs rounded-none h-8 px-4"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="border-2 border-black bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-xs rounded-none h-8 px-4"
                      >
                        {isPending ? "Creating..." : "Create Profile"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Users List Grid */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-zinc-300 pb-1 mb-2">
                    <span className="text-xs font-black uppercase">Registered User Accounts</span>
                    {!showAddUser && (
                      <Button
                        onClick={() => setShowAddUser(true)}
                        className="h-7 border border-black bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-[10px] rounded-none px-2"
                      >
                        <Plus className="size-3 mr-0.5" /> Add User
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {users.map(u => (
                      <div
                        key={u.id}
                        className={`border-2 border-black p-3 rounded-none flex flex-col justify-between ${
                          u.id === activeUser.id
                            ? "bg-yellow-50/50 border-yellow-500 dark:bg-zinc-800/80 dark:border-yellow-500"
                            : "bg-zinc-50 dark:bg-zinc-800/20 dark:border-zinc-800"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-black uppercase">{u.name}</span>
                            <span className="bg-black text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider dark:bg-white dark:text-black">
                              {u.role}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold block text-zinc-500 mb-2 select-all">{u.email}</span>
                          {u.bio && (
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-snug mb-2 font-sans">
                              {u.bio}
                            </p>
                          )}
                          {u.skills && u.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {u.skills.map(s => (
                                <span
                                  key={s}
                                  className="border border-zinc-300 bg-white px-1 py-0.5 text-[9px] font-bold dark:bg-zinc-900 dark:border-zinc-700"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {u.id !== activeUser.id && (
                          <div className="mt-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <button
                              onClick={() => setActiveUserId(u.id)}
                              className="text-[10px] font-black uppercase underline hover:text-yellow-600 flex items-center gap-1"
                            >
                              Impersonate User <ArrowRight className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-zinc-900 p-4 text-center text-xs font-bold text-zinc-400 dark:bg-black dark:text-zinc-600 uppercase">
        Solid Grid Portal - Built for High Contrast Productivity.
      </footer>
    </div>
  );
}
