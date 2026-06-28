import json
import os
import sys
import urllib.request
import urllib.error
import random
import string

# Helper to generate random suffixes for IDs
def generate_id(prefix):
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return f"{prefix}-{suffix}"

# Helper to format Rupiah
def format_rupiah(val):
    if not val:
        return ""
    # Format integer as currency: Rp xx.xxx.xxx
    s = str(val)
    r = []
    for i, c in enumerate(reversed(s)):
        if i > 0 and i % 3 == 0:
            r.append('.')
        r.append(c)
    return "Rp " + "".join(reversed(r))

def scrape_jobs(page=1, limit=18):
    url = f"https://api.sejutacita.id/v1/explore-job/job?page={page}&sortParam=mostRelevant&sortBy=asc&boostTheBoostedJob=true&published=true&limit={limit}&status=active"
    
    headers = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "content-type": "application/json",
        "x-client-app-name": "Deall-Talent-Web",
        "x-client-app-version": "2.49.52",
        "Referer": "https://dealls.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    print(f"[Python Scraper] Fetching page {page} with limit {limit}...")
    req = urllib.request.Request(url, headers=headers, method="GET")

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
    except urllib.error.HTTPError as e:
        print(f"[Python Scraper] HTTP Error: {e.code} {e.reason}", file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"[Python Scraper] URL Error: {e.reason}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[Python Scraper] Error fetching data: {e}", file=sys.stderr)
        return False

    docs = res_json.get("data", {}).get("docs", [])
    if not isinstance(docs, list) or len(docs) == 0:
        print("[Python Scraper] No jobs returned from API.")
        return True

    # Path to db.json
    db_dir = os.path.join(os.getcwd(), "data")
    db_file = os.path.join(db_dir, "db.json")

    # Load existing database
    if os.path.exists(db_file):
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                db = json.load(f)
        except Exception as e:
            print(f"[Python Scraper] Warning: Failed to read db.json ({e}). Creating new.")
            db = {"users": [], "jobs": [], "applications": []}
    else:
        db = {"users": [], "jobs": [], "applications": []}

    # Ensure required keys exist
    for key in ["users", "jobs", "applications"]:
        if key not in db:
            db[key] = []

    imported_count = 0
    for doc in docs:
        company_data = doc.get("company") or {}
        company_name = company_data.get("name") or "Anonymous Employer"
        author_data = doc.get("author") or {}
        
        # Clean company name for email slug
        clean_comp_name = "".join(c for c in company_name.lower() if c.isalnum())
        author_email = author_data.get("email") or f"hr@{clean_comp_name or 'generic'}.com"
        author_name = author_data.get("name") or f"{company_name} HR"

        # Check / Create Employer Profile User
        employer = next((u for u in db["users"] if u["email"].lower() == author_email.lower()), None)
        if not employer:
            employer = {
                "id": generate_id("user"),
                "email": author_email,
                "name": author_name,
                "role": "employer",
                "createdAt": doc.get("createdAt") or "2026-06-28T00:00:00.000Z",
                "bio": f"{company_name} in the {company_data.get('sector') or 'Tech'} sector. Partner employer.",
                "skills": []
            }
            db["users"].append(employer)

        # Format Job Info
        job_id = f"dealls-{doc.get('id') or generate_id('job')}"
        existing_job = next((j for j in db["jobs"] if j["id"] == job_id), None)

        title = doc.get("role") or "Job Role"
        
        city = doc.get("city") or {}
        country = doc.get("country") or {}
        location = f"{city.get('name')}, {country.get('name') or 'Indonesia'}" if city.get("name") else "Remote"

        # Map employment type
        emp_types = doc.get("employmentTypes") or []
        job_type = "full-time"
        if len(emp_types) > 0:
            et = emp_types[0]
            if et == "fullTime":
                job_type = "full-time"
            elif et == "partTime":
                job_type = "part-time"
            elif et == "contract":
                job_type = "contract"
            elif et == "remote":
                job_type = "remote"
        elif doc.get("workplaceType") == "remote":
            job_type = "remote"

        # Format Salary
        salary_range = doc.get("salaryRange") or {}
        salary = "Competitive Salary"
        if salary_range.get("start"):
            start = salary_range["start"]
            end = salary_range.get("end")
            if end:
                salary = f"{format_rupiah(start)} - {format_rupiah(end)} / month"
            else:
                salary = f"{format_rupiah(start)} / month"

        # Format requirements
        skills = doc.get("skills") or []
        skill_names = [s.get("name") for s in skills if s.get("name")]
        requirements = ", ".join(skill_names)

        # Synthesize description
        sector = company_data.get("sector")
        sector_str = f" operating in the {sector} sector" if sector else ""
        skills_str = f"\n\nKey skills preferred: {', '.join(skill_names[:5])}." if skill_names else ""
        description = (
            f"We are seeking a talented {title} to join {company_name}{sector_str} at our {location} location. "
            f"This is a {job_type} position. The ideal candidate will work closely with other team members to "
            f"deliver high-quality work, manage project delivery goals, and contribute to company growth.{skills_str}"
        )

        job_data = {
            "id": job_id,
            "title": title,
            "company": company_name,
            "location": location,
            "type": job_type,
            "description": description,
            "salary": salary,
            "postedBy": employer["id"],
            "createdAt": doc.get("publishedAt") or doc.get("createdAt") or "2026-06-28T00:00:00.000Z",
            "requirements": requirements
        }

        if existing_job:
            existing_job.update(job_data)
        else:
            db["jobs"].insert(0, job_data)
            imported_count += 1

    # Save database back to db.json
    if not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    try:
        with open(db_file, "w", encoding="utf-8") as f:
            json.dump(db, f, indent=2, ensure_ascii=False)
        print(f"[Python Scraper] SUCCESS: Imported {imported_count} new jobs and synchronized database.")
        return True
    except Exception as e:
        print(f"[Python Scraper] Error saving database file: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    page_num = 1
    limit_num = 18

    # Parse arguments simple style
    args = sys.argv[1:]
    for i in range(len(args)):
        if args[i] == "--page" and i + 1 < len(args):
            page_num = int(args[i + 1])
        if args[i] == "--limit" and i + 1 < len(args):
            limit_num = int(args[i + 1])

    success = scrape_jobs(page=page_num, limit=limit_num)
    sys.exit(0 if success else 1)
