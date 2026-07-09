import fs from "fs";
import path from "path";
import { AdminNav } from "@/components/AdminNav";
import { ListTodo } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backlog — Job Aggregator",
  description: "Project backlog rendered from BACKLOG.md.",
};

interface BacklogSection {
  title: string;
  items: string[];
}

function parseBacklog(md: string): BacklogSection[] {
  const sections: BacklogSection[] = [];
  let current: BacklogSection | null = null;

  for (const line of md.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { title: heading[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const item = line.match(/^-\s+(.+)$/);
    if (item && current) {
      current.items.push(item[1].trim());
    }
  }
  return sections;
}

const SECTION_STYLE: Record<string, string> = {
  Now: "text-foreground",
  Next: "text-foreground",
  Later: "text-muted-foreground",
  Done: "text-muted-foreground line-through decoration-border",
};

export default function BacklogPage() {
  let sections: BacklogSection[] = [];
  let error: string | null = null;
  try {
    const md = fs.readFileSync(path.join(process.cwd(), "BACKLOG.md"), "utf-8");
    sections = parseBacklog(md);
  } catch {
    error = "BACKLOG.md not found at repo root.";
  }

  return (
    <div className="px-2 py-2 max-w-4xl">
      <header className="mb-6 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="size-5" />
            <h1 className="text-base font-bold uppercase tracking-widest">Backlog</h1>
          </div>
          <AdminNav />
        </div>
        <p className="mt-2 text-muted-foreground">
          Rendered from <code className="font-mono">BACKLOG.md</code> at the repo root — edit that file to
          change this page. It is the canonical backlog; git history is the audit trail.
        </p>
      </header>

      {error && <div className="border border-border bg-destructive/10 text-destructive px-3 py-2">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="border border-border">
            <h2 className="border-b border-border px-4 py-2 uppercase tracking-widest text-xs font-bold bg-muted/30 flex items-center justify-between">
              {section.title}
              <span className="font-mono text-muted-foreground">{section.items.length}</span>
            </h2>
            <ul className="px-4 py-3 space-y-2">
              {section.items.map((item) => (
                <li key={item} className={`flex gap-2 ${SECTION_STYLE[section.title] ?? ""}`}>
                  <span className="text-muted-foreground select-none">▪</span>
                  <span>{item}</span>
                </li>
              ))}
              {section.items.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
