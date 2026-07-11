"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BookOpen, ListTodo, Briefcase, Moon, Sun, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGES = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
];

function ThemeToggle() {
  const dark = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("themechange", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("themechange", onStoreChange);
      };
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="rounded-full"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
          <span className="text-base font-bold tracking-tight">
            KerjaRadar
            <span className="ml-2 hidden text-sm font-medium text-muted-foreground sm:inline">
              jobs
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {PAGES.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] font-semibold transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
