"""Collect job listings from the Glints GraphQL API.

Anonymous access is limited: page 1 only (page 2+ returns HTTP 403
NO_PERMISSION) and pageSize is server-capped at 50. sortBy=LATEST orders
by updatedAt descending, so one request yields the ~50 most recently
posted/bumped jobs; the orchestrator's 7-day createdAt filter drops
bumped old postings.
"""
import json
import urllib.error
import urllib.request

from config import GLINTS_GRAPHQL, GLINTS_HEADERS, REQUEST_TIMEOUT

JOB_SEARCH_QUERY = """query searchJobsV3($data: JobSearchConditionInput!) {
  searchJobsV3(data: $data) {
    jobsInPage {
      id
      title
      status
      createdAt
      updatedAt
      type
      workArrangementOption
      company { name logo __typename }
      city { name __typename }
      country { code name __typename }
      salaries { salaryType salaryMode maxAmount minAmount CurrencyCode __typename }
      location { formattedName __typename }
      hierarchicalJobCategory { name __typename }
      skills { skill { name __typename } mustHave __typename }
      __typename
    }
    hasMore
    __typename
  }
}"""


def _fetch_page(page, page_size=50, return_payload=False):
    body = json.dumps({
        "operationName": "searchJobsV3",
        "variables": {"data": {
            "CountryCode": "ID",
            "includeExternalJobs": True,
            "pageSize": page_size,
            "page": page,
            "sortBy": "LATEST",
        }},
        "query": JOB_SEARCH_QUERY,
    }).encode("utf-8")

    req = urllib.request.Request(GLINTS_GRAPHQL, data=body, headers=GLINTS_HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
            raw = res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        snippet = err.read(500).decode("utf-8", errors="replace")
        if err.code == 403:
            # anonymous pagination limit ("please login for more information")
            return None
        raise RuntimeError(f"Glints API HTTP {err.code} {err.reason} — {snippet}") from err

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as err:
        raise RuntimeError(f"Glints API returned invalid JSON: {raw[:200]}") from err

    if payload.get("errors"):
        messages = ", ".join(e.get("message", "?") for e in payload["errors"])
        raise RuntimeError(f"Glints GraphQL error: {messages}")

    result = (payload.get("data") or {}).get("searchJobsV3")
    if not isinstance(result, dict) or not isinstance(result.get("jobsInPage"), list):
        raise RuntimeError(f"Glints API unexpected response shape: {str(payload)[:200]}")

    return payload if return_payload else result


def collect_jobs(max_pages=5, page_size=50):
    jobs = []
    seen_ids = set()

    for page in range(1, max_pages + 1):
        result = _fetch_page(page, page_size)
        if result is None:
            if page > 1:
                print(f"[scraper] Glints: page {page}+ requires login, stopping at {len(jobs)} jobs")
            break

        for job in result["jobsInPage"]:
            job_id = job.get("id")
            if not job_id or job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            jobs.append(job)

        if not result.get("hasMore"):
            break

    return jobs
