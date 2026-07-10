"""Collect job listings from JobStreet Indonesia's GraphQL API."""
import json
import math
import os
import uuid
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import JOBSTREET_GRAPHQL, JOBSTREET_HEADERS, SESSION_ID, SOL_ID, REQUEST_TIMEOUT

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(PROJECT_ROOT, "data", "db.json")

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
        teaser
        advertiser {
          id
          description
          __typename
        }
        branding {
          serpLogoUrl
          __typename
        }
        companyName
        currencyLabel
        employer {
          id
          name
          companyId
          companyUrl
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
          seoHierarchy {
            contextualName
            __typename
          }
          __typename
        }
        roleId
        tags {
          label
          type
          __typename
        }
        workArrangements {
          displayText
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

JOB_DETAILS_QUERY = """
  query JobDetailsEnrichment(
    $jobId: ID!
    $zone: Zone!
    $locale: Locale!
    $languageCode: LanguageCodeIso!
    $visitorId: UUID!
  ) {
    jobDetails(
      id: $jobId
      tracking: {
        channel: "WEB"
        jobDetailsViewedCorrelationId: "anonymous-enrichment"
        sessionId: "anonymous-enrichment"
      }
    ) {
      job {
        sourceZone
        id
        title
        abstract
        content2(zone: $zone)
        status
        isExpired
        isLinkOut
        isVerified
        expiresAt { dateTimeUtc __typename }
        listedAt { dateTimeUtc __typename }
        salary { currencyLabel(zone: $zone) label __typename }
        workTypes { label(locale: $locale) __typename }
        advertiser {
          id
          name(locale: $locale)
          isVerified
          registrationDate { dateTimeUtc __typename }
          __typename
        }
        location { label(locale: $locale, type: LONG) __typename }
        classifications { label(languageCode: $languageCode) __typename }
        products {
          bullets
          branding {
            id
            cover { url __typename }
            thumbnailCover: cover(isThumbnail: true) { url __typename }
            logo { url __typename }
            __typename
          }
          questionnaire { questions __typename }
          video { url position __typename }
          __typename
        }
        __typename
      }
      workArrangements(visitorId: $visitorId, channel: "JDV", platform: WEB) {
        arrangements { type label(locale: $locale) __typename }
        label(locale: $locale)
        __typename
      }
      seoInfo {
        normalisedRoleTitle
        workType
        classification
        subClassification
        where(zone: $zone)
        broaderLocationName(locale: $locale)
        normalisedOrganisationName
        __typename
      }
      companyProfile(zone: $zone) {
        id
        name
        companyNameSlug
        shouldDisplayReviews
        branding { logo __typename }
        overview {
          description { paragraphs __typename }
          industry
          size { description __typename }
          website { url __typename }
          __typename
        }
        reviewsSummary {
          overallRating {
            numberOfReviews { value __typename }
            value
            __typename
          }
          __typename
        }
        perksAndBenefits { title __typename }
        __typename
      }
      companySearchUrl(zone: $zone, languageCode: $languageCode)
      companyTags { key(languageCode: $languageCode) value __typename }
      __typename
    }
  }
"""


def _graphql_request(query, operation_name, variables, wrap_params=True, return_payload=False):
    body = json.dumps({
        "operationName": operation_name,
        "variables": {"params": {**COMMON_VARS, **variables}} if wrap_params else variables,
        "query": query,
    }).encode("utf-8")

    req = urllib.request.Request(JOBSTREET_GRAPHQL, data=body, headers=JOBSTREET_HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        payload = json.loads(res.read().decode("utf-8"))

    if payload.get("errors"):
        messages = ", ".join(e.get("message", "?") for e in payload["errors"])
        raise RuntimeError(f"JobStreet GraphQL error: {messages}")

    return payload if return_payload else payload["data"]


def collect_page(page=1, page_size=22):
    data = _graphql_request(JOB_SEARCH_QUERY, "JobSearchV6", {"page": page, "pageSize": page_size})
    return data["jobSearchV6"]


def collect_details(job_id):
    """Fetch public job details without depending on candidate authentication."""
    data = _graphql_request(
        JOB_DETAILS_QUERY,
        "JobDetailsEnrichment",
        {
            "jobId": str(job_id),
            "zone": "asia-4",
            "locale": "id-ID",
            "languageCode": "id",
            "visitorId": str(uuid.uuid4()),
        },
        wrap_params=False,
    )
    return data.get("jobDetails")


def _load_cached_details():
    """Reuse details already stored inside the raw payload of local JobStreet rows."""
    try:
        with open(DB_FILE, "r", encoding="utf-8") as file:
            jobs = (json.load(file) or {}).get("jobs") or []
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}

    cached = {}
    for job in jobs:
        if job.get("source") != "jobstreet" or not job.get("sourceId") or not job.get("raw"):
            continue
        try:
            raw = json.loads(job["raw"])
        except (TypeError, json.JSONDecodeError):
            continue
        details = raw.get("_details") if isinstance(raw, dict) else None
        if details:
            cached[str(job["sourceId"])] = details
    return cached


def _enrich_jobs(items, workers=4):
    """Attach details to search items; individual failures preserve base results."""
    if not items:
        return items

    cached = _load_cached_details()
    pending = []
    for item in items:
        details = cached.get(str(item.get("id")))
        if details:
            item["_details"] = details
        else:
            pending.append(item)

    if not pending:
        return items

    workers = max(1, min(int(workers), 5, len(pending)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(collect_details, item.get("id")): item for item in pending}
        for future in as_completed(futures):
            item = futures[future]
            try:
                details = future.result()
            except Exception as err:
                print(f"[scraper] JobStreet detail {item.get('id')} failed: {err}")
                continue
            if details:
                item["_details"] = details
    return items


def collect_jobs(max_pages=5, page_size=22, enrich_details=True, detail_workers=4):
    first = collect_page(1, page_size)
    if not first.get("data"):
        return []

    items = []
    seen_ids = set()

    def add(batch):
        # pages shift as new jobs are posted mid-scrape; drop re-served ids
        for item in batch or []:
            item_id = item.get("id")
            if item_id is None or item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            items.append(item)

    add(first["data"])
    total_pages = min(max_pages, math.ceil(first["totalCount"] / page_size))
    for page in range(2, total_pages + 1):
        result = collect_page(page, page_size)
        add(result.get("data"))

    if enrich_details:
        enriched = _enrich_jobs(items, detail_workers)
        detail_count = sum(bool(item.get("_details")) for item in enriched)
        print(f"[scraper] JobStreet: enriched {detail_count}/{len(items)} job details")

    return items
