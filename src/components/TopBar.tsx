"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Sparkles, Database, FileSpreadsheet, BookOpen, ListTodo, Briefcase } from "lucide-react";

const PAGES = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/query", label: "Query", icon: Sparkles },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/dataset", label: "Dataset", icon: FileSpreadsheet },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="glass sticky top-0 z-50 border-x-0 border-t-0 rounded-none">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid size-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40 transition-shadow group-hover:shadow-[0_0_18px_-2px_var(--primary)]">
            <Radar className="size-4.5 text-primary" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            <span className="text-gradient">KerjaRadar</span>
            <span className="ml-2 hidden text-xs font-normal tracking-wide text-muted-foreground sm:inline">
              job aggregator console
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {PAGES.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-primary" : ""}`} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
