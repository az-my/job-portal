"use client";

import React, { useState, useMemo, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { User, Job, Application } from "@/lib/db";
import {
  addUser, addJob, applyJob, updateApplicationStatus,
  scrapeJobStreetAction, getUsers, getJobs,
} from "@/app/actions";
import {
  Briefcase, Users, FileText, Shield, Plus, X, Download,
} from "lucide-react";

type View = "jobs" | "users" | "applications" | "admin";

interface DashboardProps {
  initialUsers: User[];
  initialJobs: Job[];
  initialApplications: Application[];
}

const VIEW_LABELS: Record<View, string> = {
  jobs: "Jobs Board",
  users: "Users",
  applications: "Applications",
  admin: "Admin",
};

export default function Dashboard({ initialUsers, initialJobs, initialApplications }: DashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [activeView, setActiveView] = useState<View>("jobs");
  const [activeUserId, setActiveUserId] = useState<string>(initialUsers[0]?.id || "");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ message: string; error?: boolean } | null>(null);

  const activeUser = users.find((u) => u.id === activeUserId);

  const notify = (message: string, error?: boolean) => {
    setNotification({ message, error });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRefresh = async () => {
    const [updatedJobs, updatedUsers] = await Promise.all([getJobs(), getUsers()]);
    setJobs(updatedJobs);
    setUsers(updatedUsers);
  };

  const handleScrape = () => {
    startTransition(async () => {
      try {
        const res = await scrapeJobStreetAction(10);
        if (res.success) {
          await handleRefresh();
          notify(`Imported ${res.count} jobs from JobStreet`);
        } else {
          notify("error" in res ? String(res.error) : "Scrape failed", true);
        }
      } catch {
        notify("Scrape failed", true);
      }
    });
  };

  const handleAddJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await addJob({
      title: fd.get("title") as string,
      company: fd.get("company") as string,
      location: fd.get("location") as string,
      type: (fd.get("type") as Job["type"]) || "full-time",
      description: fd.get("description") as string,
      salary: fd.get("salary") as string,
      postedBy: activeUserId,
    });
    if (res.success) {
      await handleRefresh();
      notify("Job posted");
      e.currentTarget.reset();
    } else {
      notify("error" in res ? String(res.error) : "Failed", true);
    }
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await addUser({
      email: fd.get("email") as string,
      name: fd.get("name") as string,
      role: (fd.get("role") as User["role"]) || "candidate",
    });
    if (res.success) {
      await handleRefresh();
      notify("User created");
      e.currentTarget.reset();
    } else {
      notify("error" in res ? String(res.error) : "Failed", true);
    }
  };

  const handleApply = async (jobId: string) => {
    const res = await applyJob({ jobId, userId: activeUserId });
    if (res.success) {
      await handleRefresh();
      notify("Applied!");
    } else {
      notify("error" in res ? String(res.error) : "Failed", true);
    }
  };

  const handleUpdateStatus = async (applicationId: string, status: Application["status"]) => {
    const res = await updateApplicationStatus(applicationId, status);
    if (res.success) {
      await handleRefresh();
      notify(`Status updated to ${status}`);
    } else {
      notify("error" in res ? String(res.error) : "Failed", true);
    }
  };

  const views: { key: View; icon: React.ReactNode; label: string }[] = [
    { key: "jobs", icon: <Briefcase className="size-4" />, label: "Jobs" },
    { key: "users", icon: <Users className="size-4" />, label: "Users" },
    { key: "applications", icon: <FileText className="size-4" />, label: "Applications" },
  ];
  if (activeUser?.role === "admin") {
    views.push({ key: "admin", icon: <Shield className="size-4" />, label: "Admin" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5" />
            <span className="font-semibold text-sm">Job Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={activeUserId}
              onChange={(e) => setActiveUserId(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav className="flex gap-0 px-4">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                activeView === v.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      {notification && (
        <div
          className={`mx-4 mt-2 rounded-md border px-3 py-2 text-xs ${
            notification.error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}
        >
          {notification.message}
        </div>
      )}

      <main className="flex-1 p-4">
        {activeView === "jobs" && (
          <JobsView
            jobs={jobs}
            applications={applications}
            activeUser={activeUser}
            onApply={handleApply}
            onAddJob={handleAddJob}
          />
        )}
        {activeView === "users" && (
          <UsersView users={users} onAddUser={handleAddUser} onImpersonate={setActiveUserId} activeUserId={activeUserId} />
        )}
        {activeView === "applications" && (
          <ApplicationsView
            applications={applications}
            jobs={jobs}
            users={users}
            activeUser={activeUser}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
        {activeView === "admin" && activeUser?.role === "admin" && (
          <AdminView
            jobs={jobs}
            users={users}
            applications={applications}
            onScrape={handleScrape}
            isPending={isPending}
          />
        )}
      </main>
    </div>
  );
}

/* ───── Jobs View ───── */

function JobsView({
  jobs,
  applications,
  activeUser,
  onApply,
  onAddJob,
}: {
  jobs: Job[];
  applications: Application[];
  activeUser?: User;
  onApply: (jobId: string) => void;
  onAddJob: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);

  const columns: ColumnDef<Job>[] = useMemo(
    () => [
      { accessorKey: "title", header: "Title", enableSorting: true },
      { accessorKey: "company", header: "Company", enableSorting: true },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "salary",
        header: "Salary",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.getValue("salary") || "—"}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {row.getValue("type")}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Posted",
        cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleDateString(),
      },
      ...(activeUser
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: Job } }) => {
                const hasApplied = applications.some(
                  (a) => a.jobId === row.original.id && a.userId === activeUser.id
                );
                if (activeUser.role === "candidate") {
                  return hasApplied ? (
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">Applied</span>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => onApply(row.original.id)}>
                      Apply
                    </Button>
                  );
                }
                const count = applications.filter((a) => a.jobId === row.original.id).length;
                return (
                  <span className="text-xs text-muted-foreground tabular-nums">{count} application{count !== 1 ? "s" : ""}</span>
                );
              },
            },
          ]
        : []),
    ],
    [activeUser, applications, onApply]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{jobs.length} jobs</h2>
        {(activeUser?.role === "employer" || activeUser?.role === "admin") && (
          <Button size="xs" variant="outline" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="size-3" /> : <Plus className="size-3" />}
            {showForm ? "Cancel" : "Post Job"}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={onAddJob} className="rounded-md border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input name="title" placeholder="Job title" required className="h-7 text-xs" />
            <Input name="company" placeholder="Company" required className="h-7 text-xs" />
            <Input name="location" placeholder="Location" className="h-7 text-xs" />
            <select name="type" className="h-7 rounded-md border border-input bg-background px-2 text-xs">
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="remote">Remote</option>
              <option value="contract">Contract</option>
            </select>
            <Input name="salary" placeholder="Salary" className="h-7 text-xs" />
          </div>
          <textarea
            name="description"
            placeholder="Job description"
            className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-xs resize-none"
          />
          <Button type="submit" size="xs">Publish</Button>
        </form>
      )}

      <DataTable columns={columns} data={jobs} searchKey="title" searchPlaceholder="Search jobs..." pageSize={15} />
    </div>
  );
}

/* ───── Users View ───── */

function UsersView({
  users,
  onAddUser,
  onImpersonate,
  activeUserId,
}: {
  users: User[];
  onAddUser: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onImpersonate: (id: string) => void;
  activeUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);

  const columns: ColumnDef<User>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name", enableSorting: true },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {row.getValue("role")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }: { row: { original: User } }) =>
          row.original.id !== activeUserId ? (
            <Button size="xs" variant="outline" onClick={() => onImpersonate(row.original.id)}>
              Impersonate
            </Button>
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Active</span>
          ),
      },
    ],
    [activeUserId, onImpersonate]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{users.length} users</h2>
        <Button size="xs" variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="size-3" /> : <Plus className="size-3" />}
          {showForm ? "Cancel" : "Add User"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={onAddUser} className="rounded-md border p-3 space-y-2">
          <Input name="name" placeholder="Full name" required className="h-7 text-xs" />
          <Input name="email" type="email" placeholder="Email" required className="h-7 text-xs" />
          <select name="role" className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
            <option value="candidate">Candidate</option>
            <option value="employer">Employer</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" size="xs">Create</Button>
        </form>
      )}

      <DataTable columns={columns} data={users} searchKey="name" searchPlaceholder="Search users..." pageSize={10} />
    </div>
  );
}

/* ───── Applications View ───── */

function ApplicationsView({
  applications,
  jobs,
  users,
  activeUser,
  onUpdateStatus,
}: {
  applications: Application[];
  jobs: Job[];
  users: User[];
  activeUser?: User;
  onUpdateStatus: (id: string, status: Application["status"]) => void;
}) {
  const enriched = useMemo(
    () =>
      applications.map((app) => {
        const job = jobs.find((j) => j.id === app.jobId);
        const user = users.find((u) => u.id === app.userId);
        return { ...app, jobTitle: job?.title || "Unknown", userName: user?.name || "Unknown" };
      }),
    [applications, jobs, users]
  );

  const showAll = activeUser?.role === "admin";
  const filtered = showAll
    ? enriched
    : enriched.filter((a) => {
        const job = jobs.find((j) => j.id === a.jobId);
        return job?.postedBy === activeUser?.id || a.userId === activeUser?.id;
      });

  const columns: ColumnDef<typeof enriched[0]>[] = useMemo(
    () => [
      { accessorKey: "jobTitle", header: "Job", enableSorting: true },
      { accessorKey: "userName", header: "Applicant", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          const colors: Record<string, string> = {
            applied: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
            interviewing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
            offered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
            rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
          };
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors[status] || ""}`}>
              {status}
            </span>
          );
        },
      },
      { accessorKey: "appliedAt", header: "Applied", cell: ({ row }) => new Date(row.getValue("appliedAt")).toLocaleDateString() },
      ...(activeUser?.role !== "candidate"
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: typeof enriched[0] } }) => (
                <div className="flex gap-1">
                  {(["interviewing", "offered", "rejected"] as const).map((s) => (
                    <Button
                      key={s}
                      size="xs"
                      variant="outline"
                      onClick={() => onUpdateStatus(row.original.id, s)}
                      disabled={row.original.status === s}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              ),
            },
          ]
        : []),
    ],
    [activeUser, onUpdateStatus]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{filtered.length} applications</h2>
      <DataTable columns={columns} data={filtered} searchKey="jobTitle" searchPlaceholder="Search applications..." pageSize={10} />
    </div>
  );
}

/* ───── Admin View ───── */

function AdminView({
  jobs,
  users,
  applications,
  onScrape,
  isPending,
}: {
  jobs: Job[];
  users: User[];
  applications: Application[];
  onScrape: () => void;
  isPending: boolean;
}) {
  const scraped = jobs.filter((j) => j.source === "jobstreet");
  const manual = jobs.filter((j) => !j.source);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Admin Panel</h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-2xl font-bold tabular-nums">{jobs.length}</p>
          <p className="text-xs text-muted-foreground">Total Jobs</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-2xl font-bold tabular-nums">{scraped.length}</p>
          <p className="text-xs text-muted-foreground">Scraped (JobStreet)</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-2xl font-bold tabular-nums">{manual.length}</p>
          <p className="text-xs text-muted-foreground">Manual</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-2xl font-bold tabular-nums">{users.length}</p>
          <p className="text-xs text-muted-foreground">Users</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-2xl font-bold tabular-nums">{applications.length}</p>
          <p className="text-xs text-muted-foreground">Applications</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="xs" onClick={onScrape} disabled={isPending}>
          {isPending ? "Scraping..." : "Scrape JobStreet"}
        </Button>
      </div>
    </div>
  );
}
