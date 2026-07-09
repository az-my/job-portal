import fs from "fs";
import path from "path";
import { PageHeader } from "@/components/PageHeader";
import { ListTodo } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backlog — KerjaRadar",
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

const HEADING_STYLE: Record<string, string> = {
  Now: "text-primary",
  Next: "text-foreground",
  Later: "text-muted-foreground",
  Done: "text-muted-foreground",
};

const BULLET_STYLE: Record<string, string> = {
  Now: "text-primary",
  Next: "text-primary/70",
  Later: "text-muted-foreground",
  Done: "text-muted-foreground",
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
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ListTodo className="size-5 text-primary" /> Backlog
          </span>
        }
        description={
          <>
            Rendered from <code className="font-mono">BACKLOG.md</code> at the repo root — edit that file to
            change this page. It is the canonical backlog; git history is the audit trail.
          </>
        }
      />

      {error && (
        <div className="glass rounded-xl bg-destructive/10 text-destructive px-4 py-3 mb-4">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="glass glow-hover rounded-xl overflow-hidden">
            <h2
              className={`font-display text-sm font-semibold px-5 pt-4 pb-3 flex items-center justify-between ${
                HEADING_STYLE[section.title] ?? "text-muted-foreground"
              }`}
            >
              {section.title}
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {section.items.length}
              </span>
            </h2>
            <ul className="px-5 pb-4 space-y-2">
              {section.items.map((item) => (
                <li key={item} className={`flex gap-2 ${SECTION_STYLE[section.title] ?? ""}`}>
                  <span className={`select-none ${BULLET_STYLE[section.title] ?? "text-muted-foreground"}`}>▪</span>
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
