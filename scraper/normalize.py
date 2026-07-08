"""Transform raw source payloads into the unified Job schema."""
import json
import random
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


def normalize_jobstreet(item):
    bullet_points = item.get("bulletPoints")
    if isinstance(bullet_points, list):
        description = "\n".join(bullet_points)
    else:
        description = bullet_points or ""

    advertiser = item.get("advertiser") or {}

    return {
        "id": generate_id("job"),
        "title": item.get("title") or "Untitled",
        "company": advertiser.get("description") or "Unknown Company",
        "location": "",
        "type": "full-time",
        "description": description,
        "salary": item.get("salaryLabel") or "",
        "postedBy": "scraper",
        "createdAt": _now_iso(),
        "source": "jobstreet",
        "sourceId": str(item.get("id")),
        "url": f"https://id.jobstreet.com/jobs/{item.get('id')}",
        "logoUrl": "",
        "raw": json.dumps(item, ensure_ascii=False),
    }


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


def normalize_jobs(items, source):
    if source == "dealls":
        return [normalize_dealls(d) for d in items]
    return [normalize_jobstreet(i) for i in items]
