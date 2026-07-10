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


_SALARY_LABEL_RE = re.compile(r"(?i)rp\s*([\d.,]+)\s*(jt|juta)?")


def _parse_salary_label(label):
    """Pull numeric IDR bounds out of a display label like 'Rp 5.000.000 – Rp 8.000.000'."""
    if not label:
        return None, None
    values = []
    for m in _SALARY_LABEL_RE.finditer(label):
        try:
            v = int(m.group(1).replace(".", "").replace(",", ""))
        except ValueError:
            continue
        if m.group(2):
            v *= 1_000_000
        if v >= 100_000:  # ignore stray small numbers
            values.append(v)
    if not values:
        return None, None
    if len(values) == 1:
        return values[0], None
    return min(values), max(values)


def _set_salary_bounds(job, smin, smax):
    if smin:
        job["salaryMin"] = int(smin)
    if smax:
        job["salaryMax"] = int(smax)


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
    details = item.get("_details") or {}
    detail_job = details.get("job") or {}
    detail_company = details.get("companyProfile") or {}

    bullet_points = item.get("bulletPoints")
    if isinstance(bullet_points, list):
        description = "\n".join(bullet_points)
    else:
        description = bullet_points or ""

    # Search results expose a teaser, not the full job-ad description.
    teaser = item.get("teaser") or ""

    full_description = _strip_html(detail_job.get("content2"))
    abstract = detail_job.get("abstract") or ""

    advertiser = item.get("advertiser") or {}
    employer = item.get("employer") or {}
    branding = item.get("branding") or {}
    detail_advertiser = detail_job.get("advertiser") or {}
    detail_products = detail_job.get("products") or {}
    detail_branding = detail_products.get("branding") or {}

    locations = item.get("locations") or []
    location = ", ".join(l.get("label", "") for l in locations if l.get("label"))
    detail_location = (detail_job.get("location") or {}).get("label")

    work_types = item.get("workTypes") or []
    detail_work_types = detail_job.get("workTypes") or []
    if detail_work_types:
        work_types = [
            w.get("label", "") if isinstance(w, dict) else str(w)
            for w in detail_work_types
            if (w.get("label") if isinstance(w, dict) else w)
        ]
    job_type = JOBSTREET_WORK_TYPE_MAP.get((work_types[0] if work_types else "").lower(), "full-time")

    classifications = item.get("classifications") or []
    classification = ", ".join(
        (c.get("classification") or {}).get("description", "")
        for c in classifications
        if (c.get("classification") or {}).get("description")
    )

    listing_date = (item.get("listingDate") or {}).get("dateTimeUtc")
    detail_listing_date = (detail_job.get("listedAt") or {}).get("dateTimeUtc")
    detail_salary = (detail_job.get("salary") or {}).get("label")
    detail_logo = (detail_branding.get("logo") or {}).get("url")

    questions = (detail_products.get("questionnaire") or {}).get("questions") or []
    detail_classifications = detail_job.get("classifications") or []
    requirements = "\n".join(
        [str(q) for q in questions if q]
        or [c.get("label", "") for c in detail_classifications if c.get("label")]
    )

    job = {
        "id": generate_id("job"),
        "title": detail_job.get("title") or item.get("title") or "Untitled",
        "company": detail_company.get("name") or detail_advertiser.get("name") or item.get("companyName") or employer.get("name") or advertiser.get("description") or "Unknown Company",
        "location": detail_location or location,
        "type": job_type,
        "description": full_description or description or abstract or teaser or classification,
        "salary": detail_salary or item.get("salaryLabel") or "",
        "createdAt": detail_listing_date or listing_date or _now_iso(),
        "source": "jobstreet",
        "sourceId": str(item.get("id")),
        "url": f"https://id.jobstreet.com/jobs/{item.get('id')}",
        "logoUrl": detail_logo or (detail_company.get("branding") or {}).get("logo") or branding.get("serpLogoUrl") or "",
        "raw": json.dumps(item, ensure_ascii=False),
    }
    if requirements or classification:
        job["requirements"] = requirements or classification
    _set_salary_bounds(job, *_parse_salary_label(job["salary"]))
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
        "createdAt": doc.get("publishedAt") or _now_iso(),
        "source": "dealls",
        "sourceId": str(doc.get("id")),
        "url": f"https://dealls.com/jobs/{doc.get('slug')}",
        "logoUrl": company.get("logoUrl") or "",
        "raw": json.dumps(doc, ensure_ascii=False),
    }
    if skill_names:
        job["requirements"] = skill_names
    _set_salary_bounds(job, salary_range.get("start"), salary_range.get("end"))
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
        "createdAt": job.get("activation_date") or job.get("created_at") or _now_iso(),
        "source": "kalibrr",
        "sourceId": str(job_id),
        "url": f"https://www.kalibrr.id/id-ID/c/{company_code}/jobs/{job_id}/{slug}",
        "logoUrl": company.get("logo_small") or "",
        "raw": json.dumps(job, ensure_ascii=False),
    }
    if qualifications:
        normalized["requirements"] = qualifications
    _set_salary_bounds(normalized, base, maximum)
    return normalized


GLINTS_TYPE_MAP = {
    "FULL_TIME": "full-time",
    "PART_TIME": "part-time",
    "CONTRACT": "contract",
    "PROJECT_BASED": "contract",
    "INTERNSHIP": "contract",
    "DAILY": "part-time",
}

GLINTS_IMAGE_BASE = "https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo"


def normalize_glints(job):
    company = job.get("company") or {}
    company_name = company.get("name") or "Unknown Company"
    title = job.get("title") or "Untitled"

    city = (job.get("city") or {}).get("name")
    formatted = (job.get("location") or {}).get("formattedName")
    country = (job.get("country") or {}).get("name")
    location = ", ".join(p for p in [city or formatted, country] if p)

    if (job.get("workArrangementOption") or "").upper() == "REMOTE":
        job_type = "remote"
    else:
        job_type = GLINTS_TYPE_MAP.get(job.get("type") or "", "full-time")

    salary = ""
    salary_min = salary_max = None
    for s in job.get("salaries") or []:
        min_amount = s.get("minAmount")
        max_amount = s.get("maxAmount")
        if not (min_amount or max_amount):
            continue
        if (s.get("CurrencyCode") or "IDR") == "IDR":
            salary = _format_salary(int(min_amount) if min_amount else None,
                                    int(max_amount) if max_amount else None)
            salary_min, salary_max = min_amount, max_amount
        else:
            salary = f"{min_amount or ''}-{max_amount or ''} {s.get('CurrencyCode')}".strip("-")
        break

    skills = job.get("skills") or []
    skill_names = ", ".join(
        (s.get("skill") or {}).get("name", "")
        for s in skills
        if (s.get("skill") or {}).get("name")
    )

    category = (job.get("hierarchicalJobCategory") or {}).get("name")
    description = f"{title} at {company_name}"
    if category:
        description += f" ({category})"
    if skill_names:
        description += f". Skills: {skill_names}"

    logo = company.get("logo")

    normalized = {
        "id": generate_id("job"),
        "title": title,
        "company": company_name,
        "location": location,
        "type": job_type,
        "description": description,
        "salary": salary,
        "createdAt": job.get("createdAt") or _now_iso(),
        "source": "glints",
        "sourceId": str(job.get("id")),
        "url": f"https://glints.com/id/opportunities/jobs/{job.get('id')}",
        "logoUrl": f"{GLINTS_IMAGE_BASE}/{logo}" if logo else "",
        "raw": json.dumps(job, ensure_ascii=False),
    }
    if skill_names:
        normalized["requirements"] = skill_names
    _set_salary_bounds(normalized, salary_min, salary_max)
    return normalized


NORMALIZERS = {
    "jobstreet": normalize_jobstreet,
    "dealls": normalize_dealls,
    "kalibrr": normalize_kalibrr,
    "glints": normalize_glints,
}


def normalize_jobs(items, source):
    normalizer = NORMALIZERS[source]
    return [normalizer(item) for item in items]
