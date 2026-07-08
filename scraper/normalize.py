"""Transform raw source payloads into the unified Job schema."""
import html
import json
import random
import re
import string
from datetime import datetime, timezone


def generate_id(prefix):
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return f"{prefix}-{suffix}"


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _format_salary(start, end):
    def fmt(n):
        if n >= 1_000_000:
            millions = n / 1_000_000
            return f"Rp{millions:.0f}jt" if n % 1_000_000 == 0 else f"Rp{millions:.1f}jt"
        if n >= 1_000:
            return f"Rp{n / 1_000:.0f}rb"
        return f"Rp{n}"

    if start and end:
        return f"{fmt(start)} - {fmt(end)}"
    if start:
        return f"≥ {fmt(start)}"
    if end:
        return f"≤ {fmt(end)}"
    return ""


EMPLOYMENT_TYPE_MAP = {
    "fullTime": "full-time",
    "partTime": "part-time",
    "remote": "remote",
    "contract": "contract",
}


JOBSTREET_WORK_TYPE_MAP = {
    "full time": "full-time",
    "part time": "part-time",
    "contract/temp": "contract",
    "casual/vacation": "part-time",
}


def normalize_jobstreet(item):
    bullet_points = item.get("bulletPoints")
    if isinstance(bullet_points, list):
        description = "\n".join(bullet_points)
    else:
        description = bullet_points or ""

    advertiser = item.get("advertiser") or {}

    locations = item.get("locations") or []
    location = ", ".join(l.get("label", "") for l in locations if l.get("label"))

    work_types = item.get("workTypes") or []
    job_type = JOBSTREET_WORK_TYPE_MAP.get((work_types[0] if work_types else "").lower(), "full-time")

    classifications = item.get("classifications") or []
    classification = ", ".join(
        (c.get("classification") or {}).get("description", "")
        for c in classifications
        if (c.get("classification") or {}).get("description")
    )

    listing_date = (item.get("listingDate") or {}).get("dateTimeUtc")

    job = {
        "id": generate_id("job"),
        "title": item.get("title") or "Untitled",
        "company": advertiser.get("description") or "Unknown Company",
        "location": location,
        "type": job_type,
        "description": description or classification,
        "salary": item.get("salaryLabel") or "",
        "postedBy": "scraper",
        "createdAt": listing_date or _now_iso(),
        "source": "jobstreet",
        "sourceId": str(item.get("id")),
        "url": f"https://id.jobstreet.com/jobs/{item.get('id')}",
        "logoUrl": "",
        "raw": json.dumps(item, ensure_ascii=False),
    }
    if classification:
        job["requirements"] = classification
    return job


def normalize_dealls(doc):
    skills = doc.get("skills") or []
    skill_names = ", ".join(s.get("name", "") for s in skills if s.get("name"))

    city = doc.get("city") or {}
    country = doc.get("country") or {}
    location = ", ".join(p for p in [city.get("name"), country.get("name")] if p)

    company = doc.get("company") or {}
    company_name = company.get("name") or "Unknown Company"
    role = doc.get("role") or "Untitled"

    employment_types = doc.get("employmentTypes") or []
    job_type = EMPLOYMENT_TYPE_MAP.get(employment_types[0] if employment_types else "fullTime", "full-time")

    salary_range = doc.get("salaryRange") or {}
    salary = _format_salary(salary_range.get("start"), salary_range.get("end")) if salary_range else ""

    description = f"{role} at {company_name}"
    if skill_names:
        description += f". Skills: {skill_names}"

    job = {
        "id": generate_id("job"),
        "title": role,
        "company": company_name,
        "location": location,
        "type": job_type,
        "description": description,
        "salary": salary,
        "postedBy": "scraper",
        "createdAt": doc.get("publishedAt") or _now_iso(),
        "source": "dealls",
        "sourceId": str(doc.get("id")),
        "url": f"https://dealls.com/jobs/{doc.get('slug')}",
        "logoUrl": company.get("logoUrl") or "",
        "raw": json.dumps(doc, ensure_ascii=False),
    }
    if skill_names:
        job["requirements"] = skill_names
    return job


def _strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_kalibrr(job):
    company = job.get("company") or {}
    company_name = job.get("company_name") or company.get("name") or "Unknown Company"
    title = job.get("name") or "Untitled"

    address = (job.get("google_location") or {}).get("address_components") or {}
    location = ", ".join(p for p in [address.get("city"), address.get("country")] if p)

    tenure = (job.get("tenure") or "").lower()
    if job.get("is_work_from_home"):
        job_type = "remote"
    elif "part" in tenure:
        job_type = "part-time"
    elif "contract" in tenure or "freelance" in tenure or "project" in tenure or "intern" in tenure:
        job_type = "contract"
    else:
        job_type = "full-time"

    base = job.get("base_salary")
    maximum = job.get("maximum_salary")
    salary = _format_salary(
        int(base) if base else None,
        int(maximum) if maximum else None,
    )

    description = _strip_html(job.get("description"))
    qualifications = _strip_html(job.get("qualifications"))

    job_id = job.get("id")
    company_code = company.get("code") or ""
    slug = job.get("slug") or ""

    normalized = {
        "id": generate_id("job"),
        "title": title,
        "company": company_name,
        "location": location,
        "type": job_type,
        "description": description or f"{title} at {company_name}",
        "salary": salary,
        "postedBy": "scraper",
        "createdAt": job.get("activation_date") or job.get("created_at") or _now_iso(),
        "source": "kalibrr",
        "sourceId": str(job_id),
        "url": f"https://www.kalibrr.id/id-ID/c/{company_code}/jobs/{job_id}/{slug}",
        "logoUrl": company.get("logo_small") or "",
        "raw": json.dumps(job, ensure_ascii=False),
    }
    if qualifications:
        normalized["requirements"] = qualifications
    return normalized


NORMALIZERS = {
    "jobstreet": normalize_jobstreet,
    "dealls": normalize_dealls,
    "kalibrr": normalize_kalibrr,
}


def normalize_jobs(items, source):
    normalizer = NORMALIZERS[source]
    return [normalizer(item) for item in items]
