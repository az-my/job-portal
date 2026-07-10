const DEALLS_DETAIL_URL = "https://api.sejutacita.id/v1/job-portal/job/slug";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PRIVATE_FIELDS = new Set([
  "author",
  "editor",
  "email",
  "hiringTeam",
  "invitedEmails",
  "previewedCandidates",
  "blastCount",
  "pausedEmailIsSent",
  "closedEmailIsSent",
  "sendRejectionEmailNeeded",
  "reminderToProcessFirstCandidatesIsSent",
]);

function publicDetail(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicDetail);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !PRIVATE_FIELDS.has(key))
      .map(([key, nested]) => [key, publicDetail(nested)])
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (slug.length > 160 || !SLUG_PATTERN.test(slug)) {
    return Response.json({ error: "Invalid Dealls job slug" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${DEALLS_DETAIL_URL}/${encodeURIComponent(slug)}`, {
      headers: {
        accept: "application/json",
        "x-client-app-name": "Deall-Talent-Web",
        "x-client-app-version": "2.49.54",
        Referer: "https://dealls.com/",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 404) {
      return Response.json({ error: "Dealls job not found" }, { status: 404 });
    }
    if (!upstream.ok) {
      return Response.json(
        { error: `Dealls detail request failed with HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const payload: unknown = await upstream.json();
    return Response.json(publicDetail(payload), {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Dealls detail request timed out"
      : "Dealls detail request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
