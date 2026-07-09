import { getJobs, type Job } from "@/lib/db";

export const dynamic = "force-dynamic";

const CSV_COLUMNS: (keyof Job)[] = [
  "id", "title", "company", "location", "type", "salary",
  "source", "sourceId", "url", "logoUrl", "createdAt", "description", "requirements",
];

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function toCsv(jobs: Job[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = jobs.map((job) => CSV_COLUMNS.map((col) => csvEscape(job[col])).join(","));
  return [header, ...rows].join("\r\n") + "\r\n";
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const jobs = await getJobs();
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    // raw payload column excluded: multi-KB per row and already available in the JSON export
    return new Response(toCsv(jobs), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="jobs-${stamp}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({ jobs }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jobs-${stamp}.json"`,
    },
  });
}
