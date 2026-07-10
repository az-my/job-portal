const KALIBRR_BASE = "https://www.kalibrr.id/id-ID/c";
const ID_PATTERN = /^\d+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return Response.json({ error: "Invalid Kalibrr job ID" }, { status: 400 });
  }

  const { searchParams } = new URL(_request.url);
  const companyCode = searchParams.get("companyCode");
  const slug = searchParams.get("slug");

  if (!companyCode || !slug) {
    return Response.json({ error: "companyCode and slug query params are required" }, { status: 400 });
  }

  const pageUrl = `${KALIBRR_BASE}/${encodeURIComponent(companyCode)}/jobs/${id}/${encodeURIComponent(slug)}`;

  try {
    const upstream = await fetch(pageUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15_000),
    });

    if (upstream.status === 404) {
      return Response.json({ error: "Kalibrr job not found" }, { status: 404 });
    }
    if (!upstream.ok) {
      return Response.json(
        { error: `Kalibrr detail request failed with HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const html = await upstream.text();

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      return Response.json({ error: "Could not extract job data from Kalibrr page" }, { status: 502 });
    }

    const nextData: unknown = JSON.parse(match[1]);
    const jobPayload = (nextData as Record<string, unknown>)?.props as Record<string, unknown>;
    const pageProps = jobPayload?.pageProps as Record<string, unknown>;
    const job = pageProps?.job as Record<string, unknown>;

    if (!job) {
      return Response.json({ error: "Unexpected Kalibrr response shape" }, { status: 502 });
    }

    return Response.json(job, {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Kalibrr detail request timed out"
        : "Kalibrr detail request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
