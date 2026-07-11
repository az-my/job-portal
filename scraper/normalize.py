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


def _name(value):
    """Return a useful display value from the small label objects used by portals."""
    if isinstance(value, dict):
        return str(value.get("name") or value.get("label") or value.get("title") or value.get("description") or "").strip()
    return str(value or "").strip()


def _names(values):
    if not isinstance(values, list):
        values = [values] if values else []
    return [name for name in (_name(value) for value in values) if name]


def _put(job, key, value):
    """Keep unknown source fields absent rather than emitting misleading empty values."""
    if value is not None and value != "" and value != [] and value != {}:
        job[key] = value


def _salary_period(value):
    """Canonicalize source pay intervals without inventing a cadence."""
    text = _name(value).strip().lower().replace("_", " ")
    aliases = {
        "hour": "hourly", "hourly": "hourly", "per hour": "hourly",
        "day": "daily", "daily": "daily", "per day": "daily",
        "week": "weekly", "weekly": "weekly", "per week": "weekly",
        "month": "monthly", "monthly": "monthly", "per month": "monthly",
        "year": "yearly", "annual": "yearly", "annually": "yearly",
        "yearly": "yearly", "per year": "yearly",
    }
    return aliases.get(text, "")


def _salary_period_from_label(label):
    match = re.search(r"(?i)\b(per\s+)?(hour|day|week|month|year)(ly)?\b", str(label or ""))
    return _salary_period(match.group(0)) if match else ""


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
    category = classification or ", ".join(_names(detail_classifications))
    _put(job, "category", category)
    detail_arrangements = (details.get("workArrangements") or {}).get("arrangements") or []
    arrangement_map = {"ONSITE": "On-site", "HYBRID": "Hybrid", "REMOTE": "Remote"}
    arrangement_values = [
        arrangement_map.get(str(entry.get("type") or "").upper()) or _name(entry)
        for entry in detail_arrangements if isinstance(entry, dict)
    ]
    search_arrangement = (item.get("workArrangements") or {}).get("displayText")
    localized_map = {"hibrid": "Hybrid", "jarak jauh": "Remote", "kantor": "On-site", "di kantor": "On-site"}
    fallback_arrangement = localized_map.get(str(search_arrangement or "").lower(), search_arrangement)
    _put(job, "workArrangement", " · ".join(dict.fromkeys(filter(None, arrangement_values))) or fallback_arrangement)
    _put(job, "expiresAt", (detail_job.get("expiresAt") or {}).get("dateTimeUtc"))
    overview = detail_company.get("overview") or {}
    _put(job, "industry", _name(overview.get("industry")))
    _put(job, "companySize", _name(overview.get("size")))
    activity = _names(item.get("tags"))
    _put(job, "activity", activity)
    _put(job, "verified", detail_job.get("isVerified"))
    _put(job, "salaryPeriod", _salary_period_from_label(detail_salary or item.get("salaryLabel")))
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
    _put(job, "skills", _names(skills))
    _put(job, "category", _name(doc.get("jobRoleCategory")) or (doc.get("jobRoleCategorySlug") or "").replace("-", " ").title())
    workplace = _name(doc.get("workplaceType"))
    _put(job, "workArrangement", workplace.replace("_", " ").title() if workplace else "")
    _put(job, "education", _name(doc.get("educationLevel") or doc.get("minimumEducation")))
    _put(job, "experience", _name(doc.get("experienceLevel") or doc.get("minimumExperience")))
    _put(job, "expiresAt", doc.get("expiredAt") or doc.get("expiresAt") or doc.get("deadline"))
    _put(job, "benefits", _names(doc.get("benefits") or doc.get("perks")))
    _put(job, "industry", _name(company.get("sector") or company.get("industry")))
    size = company.get("size") or {}
    if isinstance(size, dict) and size.get("start"):
        size = f"{size['start']}–{size.get('end') or '+'}"
    _put(job, "companySize", _name(size))
    _put(job, "applicantCount", doc.get("applicantCount") or doc.get("totalApplicants"))
    signals = [label for condition, label in ((doc.get("urgentlyNeeded"), "Urgent"), (doc.get("thereAreStillFewApplicants"), "Few applicants"), (doc.get("boosted"), "Promoted")) if condition]
    _put(job, "activity", signals)
    _put(job, "verified", company.get("verified"))
    _put(job, "urgent", doc.get("urgentlyNeeded"))
    stats = doc.get("stats") or {}
    _put(job, "viewCount", stats.get("viewCount"))
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
    if "part" in tenure:
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
    _put(normalized, "category", _name(job.get("function") or job.get("category") or job.get("job_category")))
    kalibrr_skills = [
        _name((item or {}).get("sds_skill"))
        for item in (job.get("job_sds_skills") or [])
        if isinstance(item, dict)
    ]
    _put(normalized, "skills", [skill for skill in kalibrr_skills if skill] or _names(job.get("skills")))
    has_arrangement_flags = "is_work_from_home" in job or "is_hybrid" in job
    arrangement = "Remote" if job.get("is_work_from_home") is True else "Hybrid" if job.get("is_hybrid") is True else "On-site" if has_arrangement_flags and job.get("is_work_from_home") is False and job.get("is_hybrid") is False else _name(job.get("work_arrangement"))
    _put(normalized, "workArrangement", arrangement)
    _put(normalized, "education", _name(job.get("education") or job.get("education_requirement")))
    _put(normalized, "experience", _name(job.get("experience") or job.get("experience_requirement")))
    _put(normalized, "expiresAt", job.get("application_end_date") or job.get("application_deadline") or job.get("expiration_date"))
    perks = job.get("perks") or {}
    perk_values = perks.get("types") if isinstance(perks, dict) else perks
    _put(normalized, "benefits", [str(value).replace("_", " ").title() for value in (perk_values or [])] or _names(job.get("benefits")))
    company_info = job.get("companyInfo") or job.get("company_info") or company
    _put(normalized, "industry", _name(company_info.get("industry")))
    _put(normalized, "companySize", _name(company_info.get("size") or company_info.get("company_size")))
    _put(normalized, "vacancies", job.get("number_of_openings") or job.get("vacancies") or job.get("number_of_vacancies"))
    _put(normalized, "applicantCount", job.get("applicant_count") or job.get("applications_count"))
    activity = _names(job.get("activity"))
    recruiter_active = job.get("es_recruiter_last_seen") or job.get("recruiter_last_active")
    if recruiter_active:
        activity.append(f"Recruiter active {recruiter_active}")
    _put(normalized, "activity", activity)
    _put(normalized, "verified", company.get("verified_business"))
    _put(normalized, "salaryPeriod", _salary_period(job.get("salary_interval")))
    return normalized


PINTARNYA_TYPE_MAP = {
    "full-time": "full-time",
    "part-time": "part-time",
    "contract": "contract",
    "daily": "part-time",
    "intern": "contract",
    "other": "full-time",
}


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
    _put(normalized, "category", category)
    _put(normalized, "skills", _names([(s.get("skill") or {}) for s in skills]))
    arrangement = _name(job.get("workArrangementOption"))
    _put(normalized, "workArrangement", arrangement.replace("_", " ").title() if arrangement else "")
    education = _name(job.get("educationLevel"))
    _put(normalized, "education", education.replace("_", " ").title() if education else "")
    experience = _name(job.get("experience"))
    minimum_experience = job.get("minYearsOfExperience")
    maximum_experience = job.get("maxYearsOfExperience")
    if not experience and minimum_experience is not None:
        experience = (f"{minimum_experience}–{maximum_experience} years"
                      if maximum_experience is not None and maximum_experience != minimum_experience
                      else f"{minimum_experience} years")
    _put(normalized, "experience", experience)
    _put(normalized, "expiresAt", job.get("expiresAt") or job.get("expiryDate"))
    _put(normalized, "benefits", _names(job.get("benefits")))
    _put(normalized, "industry", _name(company.get("industry")))
    _put(normalized, "companySize", _name(company.get("size")).replace("_", " ").title())
    _put(normalized, "vacancies", job.get("vacancies") or job.get("numberOfVacancies"))
    _put(normalized, "applicantCount", job.get("applicantCount"))
    first_salary = next(iter(job.get("salaries") or []), {})
    _put(normalized, "salaryPeriod", _salary_period(first_salary.get("salaryMode")))
    return normalized


def normalize_pintarnya(item):
    employer = item.get("employer") or {}
    company_name = employer.get("name") or "Unknown Company"

    title = item.get("title") or "Untitled"

    province = item.get("province") or {}
    city = item.get("city") or {}
    location = ", ".join(p for p in [city.get("name"), province.get("name")] if p)

    employments = item.get("type_of_employments") or []
    emp_name = employments[0].get("name", "") if employments else ""
    job_type = PINTARNYA_TYPE_MAP.get(emp_name.lower(), "full-time")

    salary_min = item.get("min_salary")
    salary_max = item.get("max_salary")
    salary = _format_salary(int(salary_min) if salary_min else None,
                            int(salary_max) if salary_max else None)

    skills = item.get("skills") or []
    skill_names = ", ".join(
        (s.get("name") or "") for s in skills if s.get("name")
    )

    description_lines = []
    desc = item.get("description")
    if desc:
        description_lines.append(desc)
    if skill_names:
        description_lines.append(f"Skills: {skill_names}")

    slug = item.get("slug") or ""
    logo = employer.get("logo_url") or ""

    normalized = {
        "id": generate_id("job"),
        "title": title,
        "company": company_name,
        "location": location,
        "type": job_type,
        "description": ". ".join(description_lines) or f"{title} at {company_name}",
        "salary": salary,
        "createdAt": item.get("published_at") or _now_iso(),
        "source": "pintarnya",
        "sourceId": str(item.get("id")),
        "url": f"https://pintarnya.com/lowongan/{slug}" if slug else "",
        "logoUrl": logo or "",
        "raw": json.dumps(item, ensure_ascii=False),
    }
    if skill_names:
        normalized["requirements"] = skill_names
    _set_salary_bounds(normalized, salary_min, salary_max)
    _put(normalized, "category", _name(item.get("job_category") or item.get("category")))
    _put(normalized, "skills", _names(skills))
    _put(normalized, "workArrangement", _name(item.get("type_of_work") or item.get("work_type")))
    _put(normalized, "education", _name(item.get("education_level") or item.get("minimum_education_level")))
    _put(normalized, "experience", _name(item.get("experience") or item.get("experience_level")))
    _put(normalized, "expiresAt", item.get("expired_at") or item.get("application_deadline"))
    _put(normalized, "benefits", _names(item.get("benefits") or item.get("facilities")))
    _put(normalized, "industry", _name(employer.get("industry")))
    _put(normalized, "companySize", _name(employer.get("company_size") or employer.get("size")))
    _put(normalized, "vacancies", item.get("number_of_openings") or item.get("vacancies"))
    _put(normalized, "applicantCount", item.get("applicant_count"))
    _put(normalized, "verified", item.get("is_verified"))
    _put(normalized, "urgent", item.get("is_urgently_needed"))
    return normalized


def normalize_kitalulus(item):
    vacancy = item.get("_vacancy") or {}
    title = item.get("title") or "Untitled"
    company = (item.get("hiringOrganization") or {}).get("name") or "Unknown Company"

    address = (item.get("jobLocation") or {}).get("address") or {}
    loc_parts = [address.get("addressLocality"), address.get("addressRegion"), address.get("addressCountry")]
    location = ", ".join(p for p in loc_parts if p)

    emp_type_raw = (vacancy.get("typeStr") or item.get("employmentType") or "").upper()
    if "FULL" in emp_type_raw or "PERMANENT" in emp_type_raw:
        job_type = "full-time"
    elif "PART" in emp_type_raw:
        job_type = "part-time"
    elif "CONTRACT" in emp_type_raw or "TEMPORARY" in emp_type_raw or "FREELANCE" in emp_type_raw:
        job_type = "contract"
    else:
        job_type = "full-time"

    salary_data = item.get("baseSalary") or {}
    salary_value = salary_data.get("value") or {}
    salary_min = salary_value.get("minValue")
    salary_max = salary_value.get("maxValue")
    salary = _format_salary(int(salary_min) if salary_min else None,
                            int(salary_max) if salary_max else None)

    description = _strip_html(item.get("description") or "")

    exp_req = item.get("experienceRequirements") or {}
    edu_req = item.get("educationRequirements") or {}
    req_parts = []
    if description:
        req_parts.append(description)
    if edu_req.get("credentialCategory"):
        req_parts.append(f"Education: {edu_req['credentialCategory']}")
    if exp_req.get("monthsOfExperience"):
        req_parts.append(f"Experience: {exp_req['monthsOfExperience']} months")

    logo = (item.get("hiringOrganization") or {}).get("logo") or ""
    org_name = (item.get("identifier") or {}).get("name") or ""

    slug_match = re.search(r"/lowongan/detail/([^/?#]+)", item.get("_detail_url", ""))
    slug = slug_match.group(1) if slug_match else ""

    normalized = {
        "id": generate_id("job"),
        "title": title,
        "company": company,
        "location": location,
        "type": job_type,
        "description": description or f"{title} at {company}",
        "salary": salary,
        "createdAt": item.get("datePosted") or _now_iso(),
        "source": "kitalulus",
        "sourceId": slug,
        "url": f"https://www.kitalulus.com/lowongan/detail/{slug}" if slug else "",
        "logoUrl": logo or "",
        "raw": json.dumps(item, ensure_ascii=False),
    }
    if req_parts:
        normalized["requirements"] = "\n".join(req_parts)
    _set_salary_bounds(normalized, salary_min, salary_max)
    _put(normalized, "category", _name(item.get("occupationalCategory")))
    _put(normalized, "skills", _names(item.get("skills")))
    location_site = _name(vacancy.get("locationSiteStr"))
    arrangement_map = {
        "kerja dari kantor (wfo)": "On-site",
        "campuran (hybrid)": "Hybrid",
        "kerja dari manapun (remote)": "Remote",
        "kerja di lapangan (fieldwork)": "Fieldwork",
    }
    _put(normalized, "workArrangement", arrangement_map.get(location_site.lower()) or location_site or _name(item.get("jobLocationType")) or ("Remote" if item.get("applicantLocationRequirements") else ""))
    _put(normalized, "education", _name(edu_req.get("credentialCategory") or edu_req))
    months = exp_req.get("monthsOfExperience") if isinstance(exp_req, dict) else None
    _put(normalized, "experience", f"{months} months" if months is not None else _name(exp_req))
    _put(normalized, "expiresAt", item.get("validThrough"))
    _put(normalized, "benefits", _names(item.get("jobBenefits") or item.get("benefits")))
    organization = item.get("hiringOrganization") or {}
    _put(normalized, "industry", _name(organization.get("industry")))
    _put(normalized, "companySize", _name(organization.get("numberOfEmployees") or organization.get("size")))
    _put(normalized, "vacancies", item.get("totalJobOpenings") or item.get("vacancies"))
    _put(normalized, "salaryPeriod", _salary_period(salary_value.get("unitText")))
    return normalized


NORMALIZERS = {
    "jobstreet": normalize_jobstreet,
    "dealls": normalize_dealls,
    "kalibrr": normalize_kalibrr,
    "glints": normalize_glints,
    "pintarnya": normalize_pintarnya,
    "kitalulus": normalize_kitalulus,
}


def normalize_jobs(items, source):
    normalizer = NORMALIZERS[source]
    return [normalizer(item) for item in items]
