"""Collect job listings from JobStreet Indonesia's GraphQL API."""
import json
import math
import urllib.request

from config import JOBSTREET_GRAPHQL, JOBSTREET_HEADERS, SESSION_ID, SOL_ID, REQUEST_TIMEOUT

COMMON_VARS = {
    "channel": "web",
    "eventCaptureSessionId": SESSION_ID,
    "eventCaptureUserId": SESSION_ID,
    "include": ["seoData", "gptTargeting"],
    "locale": "id-ID",
    "siteKey": "ID",
    "solId": SOL_ID,
    "userSessionId": SESSION_ID,
    "sortMode": "ListedDate",
}

JOB_SEARCH_QUERY = """
  query JobSearchV6($params: JobSearchV6QueryInput!) {
    jobSearchV6(params: $params) {
      totalCount
      data {
        id
        title
        advertiser {
          description
          __typename
        }
        bulletPoints
        salaryLabel
        listingDate {
          dateTimeUtc
          __typename
        }
        locations {
          label
          countryCode
          __typename
        }
        workTypes
        classifications {
          classification {
            description
            __typename
          }
          __typename
        }
      __typename
      }
      __typename
    }
  }
"""


def _graphql_request(query, operation_name, variables):
    body = json.dumps({
        "operationName": operation_name,
        "variables": {"params": {**COMMON_VARS, **variables}},
        "query": query,
    }).encode("utf-8")

    req = urllib.request.Request(JOBSTREET_GRAPHQL, data=body, headers=JOBSTREET_HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        payload = json.loads(res.read().decode("utf-8"))

    if payload.get("errors"):
        messages = ", ".join(e.get("message", "?") for e in payload["errors"])
        raise RuntimeError(f"JobStreet GraphQL error: {messages}")

    return payload["data"]


def collect_page(page=1, page_size=22):
    data = _graphql_request(JOB_SEARCH_QUERY, "JobSearchV6", {"page": page, "pageSize": page_size})
    return data["jobSearchV6"]


def collect_jobs(max_pages=5, page_size=22):
    first = collect_page(1, page_size)
    items = list(first.get("data") or [])
    if not items:
        return []

    total_pages = min(max_pages, math.ceil(first["totalCount"] / page_size))
    for page in range(2, total_pages + 1):
        result = collect_page(page, page_size)
        items.extend(result.get("data") or [])

    return items
