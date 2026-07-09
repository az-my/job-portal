// Provenance hues: every scraped source carries its own color through the
// console (badges, pulse tiles, charts). Keys match Job.source values.

export const SOURCE_COLOR: Record<string, string> = {
  jobstreet: "var(--source-jobstreet)",
  dealls: "var(--source-dealls)",
  kalibrr: "var(--source-kalibrr)",
  glints: "var(--source-glints)",
};

export const SOURCE_LABEL: Record<string, string> = {
  jobstreet: "JobStreet",
  dealls: "Dealls",
  kalibrr: "Kalibrr",
  glints: "Glints",
};

export function sourceColor(source?: string): string {
  return SOURCE_COLOR[source ?? ""] ?? "var(--muted-foreground)";
}

export function sourceLabel(source?: string): string {
  return SOURCE_LABEL[source ?? ""] ?? (source || "manual");
}
