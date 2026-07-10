const GLINTS_GRAPHQL = "https://glints.com/api/v2-alc/graphql?op=searchJobsV3";

const SEARCH_QUERY = `
query searchJobsV3($data: JobSearchConditionInput!) {
  searchJobsV3(data: $data) {
    jobsInPage {
      id
      title
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
      company {
        ...CompanyFields
        __typename
      }
      citySubDivision {
        id
        name
        __typename
      }
      city {
        ...CityFields
        __typename
      }
      country {
        ...CountryFields
        __typename
      }
      salaries {
        ...SalaryFields
        __typename
      }
      location {
        ...LocationFields
        __typename
      }
      minYearsOfExperience
      maxYearsOfExperience
      source
      jobSource
      hierarchicalJobCategory {
        id
        level
        name
        children { name level id __typename }
        parents { id level name __typename }
        __typename
      }
      skills {
        skill { id name __typename }
        mustHave
        __typename
      }
      traceInfo
      __typename
    }
    expInfo
    hasMore
    __typename
  }
}

fragment CompanyFields on Company {
  id
  name
  brandName
  logo
  status
  isVIP
  IndustryId
  industry { id name __typename }
  verificationTier { type userName __typename }
  __typename
}

fragment CityFields on City {
  id
  name
  __typename
}

fragment CountryFields on Country {
  code
  name
  __typename
}

fragment SalaryFields on JobSalary {
  id
  salaryType
  salaryMode
  maxAmount
  minAmount
  CurrencyCode
  __typename
}

fragment LocationFields on HierarchicalLocation {
  id
  name
  administrativeLevelName
  formattedName
  level
  slug
  latitude
  longitude
  parents {
    id
    name
    administrativeLevelName
    formattedName
    level
    slug
    CountryCode: countryCode
    parents { level formattedName slug __typename }
    __typename
  }
  __typename
}
`.trim();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10)));

  try {
    const upstream = await fetch(GLINTS_GRAPHQL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-glints-country-code": "ID",
        Referer: "https://glints.com/id/opportunities/jobs/explore?country=ID&locationName=All+Cities%2FProvinces&sortBy=LATEST",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        operationName: "searchJobsV3",
        variables: {
          data: {
            CountryCode: "ID",
            includeExternalJobs: true,
            pageSize,
            page,
            sortBy: "LATEST",
          },
        },
        query: SEARCH_QUERY,
      }),
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      if (upstream.status === 403) {
        return Response.json(
          { error: "Glints anonymous pagination limit reached (page 1 only)" },
          { status: 403 }
        );
      }
      return Response.json(
        { error: `Glints API HTTP ${upstream.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const payload: unknown = await upstream.json();
    const result = (payload as Record<string, unknown>)?.data as Record<string, unknown>;
    const searchResult = result?.searchJobsV3 as Record<string, unknown>;

    if (!searchResult) {
      const errorBody = (payload as Record<string, unknown>)?.errors as Array<{ message: string }> | undefined;
      const message = errorBody?.map((e) => e.message).join(", ") || "Unexpected Glints response shape";
      return Response.json({ error: message }, { status: 502 });
    }

    return Response.json(searchResult, {
      headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Glints request timed out"
        : "Glints request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
