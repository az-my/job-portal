"""Collect job listings from Kitalulus via sitemap crawl + JSON-LD extraction."""
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import KITALULUS_BASE, KITALULUS_HEADERS, KITALULUS_SITEMAP_INDEX, REQUEST_TIMEOUT

KITALULUS_GRAPHQL = "https://gql.kitalulus.com/graphql"
VACANCY_QUERY = """query VacancyBySlug($slug: String) {
  vacancyBySlug(slug: $slug) { id slug positionName typeStr locationSiteStr }
}"""


def _fetch(url, timeout=REQUEST_TIMEOUT):
    req = urllib.request.Request(url, headers=KITALULUS_HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8")


def _get_sitemap_urls(max_pages=3):
    """Fetch sitemap index, collect job-detail sitemap URLs (up to max_pages)."""
    body = _fetch(KITALULUS_SITEMAP_INDEX)
    urls = re.findall(r"<loc>(https://www\.kitalulus\.com/sitemap/sitemap-jobs/job-detail-\d+\.xml)</loc>", body)
    return urls[:max_pages]


def _parse_job_urls(sitemap_url):
    """Parse a job sitemap XML and return list of detail page URLs."""
    body = _fetch(sitemap_url)
    return re.findall(r"<loc>(.*?)</loc>", body)


def _extract_jsonld(html):
    """Extract and parse the first JSON-LD JobPosting block from HTML."""
    m = re.search(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(1).strip())
        if data.get("@type") == "JobPosting":
            return data
    except json.JSONDecodeError:
        return None
    return None


def _fetch_vacancy_metadata(slug):
    """Fetch fields omitted by the public JobPosting JSON-LD."""
    body = json.dumps({
        "operationName": "VacancyBySlug",
        "variables": {"slug": slug},
        "query": VACANCY_QUERY,
    }).encode("utf-8")
    headers = {
        **KITALULUS_HEADERS,
        "Content-Type": "application/json",
        "Origin": KITALULUS_BASE,
        "Referer": f"{KITALULUS_BASE}/lowongan/detail/{slug}",
    }
    req = urllib.request.Request(KITALULUS_GRAPHQL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        payload = json.loads(res.read().decode("utf-8"))
    if payload.get("errors"):
        return None
    return (payload.get("data") or {}).get("vacancyBySlug")


def _fetch_detail_job(detail_url):
    """Fetch a job detail page and extract JSON-LD."""
    detail_url = detail_url.replace("https://kitalulus.com/", "https://www.kitalulus.com/")
    if not detail_url.startswith("https://www.kitalulus.com/"):
        detail_url = f"{KITALULUS_BASE}/lowongan/detail/{detail_url}"
    try:
        html = _fetch(detail_url)
        ld = _extract_jsonld(html)
        if ld:
            ld["_detail_url"] = detail_url
            slug = detail_url.rstrip("/").split("/")[-1]
            try:
                metadata = _fetch_vacancy_metadata(slug)
            except Exception:
                metadata = None
            if metadata:
                ld["_vacancy"] = metadata
        return ld
    except Exception:
        return None


def collect_jobs(max_pages=3, max_workers=10):
    sitemap_urls = _get_sitemap_urls(max_pages)
    if not sitemap_urls:
        return []

    all_job_urls = []
    with ThreadPoolExecutor(max_workers=max_pages) as pool:
        futures = {pool.submit(_parse_job_urls, url): url for url in sitemap_urls}
        for future in as_completed(futures):
            try:
                all_job_urls.extend(future.result())
            except Exception:
                pass

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_detail_job, url): url for url in all_job_urls}
        for future in as_completed(futures):
            try:
                job = future.result()
                if job:
                    results.append(job)
            except Exception:
                pass

    return results
