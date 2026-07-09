"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Database, FileSpreadsheet, BookOpen, ListTodo } from "lucide-react";

const PAGES = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/dataset", label: "Dataset", icon: FileSpreadsheet },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center">
      {PAGES.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1.5 border border-border px-3 py-1.5 -ml-px first:ml-0 transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
