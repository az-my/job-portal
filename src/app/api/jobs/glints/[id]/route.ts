const GLINTS_GRAPHQL = "https://glints.com/api/v2-alc/graphql?op=searchJobsV3";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_QUERY = `
query searchJobsV3($data: JobSearchConditionInput!) {
  searchJobsV3(data: $data) {
    jobsInPage {
      id
      title
      descriptionJsonString
      workArrangementOption
      status
      createdAt
      updatedAt
      isHot
      isApplied
      shouldShowSalary
      educationLevel
      type
      fraudReportFlag
      bannerPic
      benefits { benefit description logo title __typename }
      city { id name __typename }
      country { code name __typename }
      salaries { id salaryType salaryMode maxAmount minAmount CurrencyCode __typename }
      location { id name formattedName level __typename }
      minYearsOfExperience
      maxYearsOfExperience
      source
      jobSource
      hierarchicalJobCategory { id level name __typename }
      skills { skill { id name __typename } mustHave __typename }
      company {
        id name brandName logo status isVIP IndustryId
        industry { id name __typename }
        descriptionJsonString
        website
        size
        verificationTier { type userName __typename }
        __typename
      }
      __typename
    }
    hasMore
    __typename
  }
}
`.trim();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: "Invalid Glints job ID (expected UUID)" }, { status: 400 });
  }

  try {
    const upstream = await fetch(GLINTS_GRAPHQL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-glints-country-code": "ID",
        referer: "https://glints.com/id/opportunities/jobs/explore?country=ID",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        operationName: "searchJobsV3",
        variables: {
          data: {
            CountryCode: "ID",
            includeExternalJobs: true,
            pageSize: 50,
            page: 1,
            sortBy: "LATEST",
          },
        },
        query: DETAIL_QUERY,
      }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `Glints API request failed with HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const payload: unknown = await upstream.json();
    const result = (payload as Record<string, unknown>)?.data as Record<string, unknown>;
    const searchResult = result?.searchJobsV3 as Record< string, unknown>;
    const jobs = searchResult?.jobsInPage as Array<Record<string, unknown>> | undefined;

    if (!Array.isArray(jobs)) {
      const errorBody = (payload as Record<string, unknown>)?.errors as Array<{ message: string }> | undefined;
      const message = errorBody?.map((e) => e.message).join(", ") || "Unexpected Glints response shape";
      return Response.json({ error: message }, { status: 502 });
    }

    const job = jobs.find((j) => String(j.id) === id);
    if (!job) {
      return Response.json({ error: "Glints job not found in latest listings" }, { status: 404 });
    }

    return Response.json(job, {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Glints detail request timed out"
        : "Glints detail request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
