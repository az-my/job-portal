import os
import sys
import unittest


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from normalize import (  # noqa: E402
    normalize_dealls,
    normalize_glints,
    normalize_jobstreet,
    normalize_kalibrr,
    normalize_kitalulus,
    normalize_pintarnya,
)


class NormalizeEnrichedFieldsTests(unittest.TestCase):
    def test_jobstreet_detail_metadata(self):
        result = normalize_jobstreet({
            "id": 1,
            "classifications": [{"classification": {"description": "Technology"}}],
            "tags": [{"label": "Early applicant"}],
            "_details": {"job": {
                "expiresAt": {"dateTimeUtc": "2026-08-01T00:00:00Z"},
                "isVerified": True, "salary": {"label": "Rp 5.000.000 per month"},
            }, "workArrangements": {"arrangements": [{"type": "HYBRID", "label": "Hibrid"}]}, "companyProfile": {"overview": {
                "industry": "Software", "size": {"description": "51-100 employees"},
            }}},
        })
        self.assertEqual("Technology", result["category"])
        self.assertEqual("Hybrid", result["workArrangement"])
        self.assertEqual("Software", result["industry"])
        self.assertEqual(["Early applicant"], result["activity"])
        self.assertTrue(result["verified"])
        self.assertEqual("monthly", result["salaryPeriod"])

    def test_dealls_metadata(self):
        result = normalize_dealls({
            "id": 2, "skills": [{"name": "Python"}], "workplaceType": "hybrid",
            "jobRoleCategorySlug": "software-engineering", "benefits": [{"name": "Insurance"}],
            "company": {"name": "Acme", "sector": "Technology", "size": {"start": 51, "end": 100}, "verified": True},
            "totalApplicants": 12, "urgentlyNeeded": True, "stats": {"viewCount": 81},
        })
        self.assertEqual(["Python"], result["skills"])
        self.assertEqual("Hybrid", result["workArrangement"])
        self.assertEqual(["Insurance"], result["benefits"])
        self.assertEqual(12, result["applicantCount"])
        self.assertTrue(result["verified"])
        self.assertTrue(result["urgent"])
        self.assertEqual(81, result["viewCount"])

    def test_kalibrr_metadata(self):
        result = normalize_kalibrr({
            "id": 3, "name": "Engineer", "is_work_from_home": True,
            "education_requirement": "Bachelor's degree", "number_of_vacancies": 3,
            "salary_interval": "month",
            "company": {"name": "Acme", "industry": "Technology", "company_size": "51-100", "verified_business": True},
        })
        self.assertEqual("Remote", result["workArrangement"])
        self.assertEqual("Bachelor's degree", result["education"])
        self.assertEqual(3, result["vacancies"])
        self.assertTrue(result["verified"])
        self.assertEqual("monthly", result["salaryPeriod"])

    def test_kalibrr_explicit_false_flags_mean_onsite(self):
        result = normalize_kalibrr({
            "id": 30, "name": "Engineer", "tenure": "Full time",
            "is_work_from_home": False, "is_hybrid": False,
            "company": {"name": "Acme"},
        })
        self.assertEqual("full-time", result["type"])
        self.assertEqual("On-site", result["workArrangement"])

    def test_glints_metadata(self):
        result = normalize_glints({
            "id": 4, "title": "Engineer", "workArrangementOption": "HYBRID",
            "hierarchicalJobCategory": {"name": "Engineering"},
            "skills": [{"skill": {"name": "Python"}}], "educationLevel": "BACHELOR_DEGREE",
            "benefits": [{"title": "Medical insurance"}],
            "salaries": [{"salaryMode": "MONTH", "minAmount": 1, "maxAmount": 2}],
            "company": {"name": "Acme", "industry": {"name": "Technology"}, "size": "51_100"},
        })
        self.assertEqual(["Python"], result["skills"])
        self.assertEqual("Hybrid", result["workArrangement"])
        self.assertEqual("Technology", result["industry"])
        self.assertEqual(["Medical insurance"], result["benefits"])
        self.assertEqual("monthly", result["salaryPeriod"])

    def test_pintarnya_metadata(self):
        result = normalize_pintarnya({
            "id": 5, "title": "Cashier", "skills": [{"name": "Customer service"}],
            "education_level": {"name": "High school"}, "type_of_work": {"name": "Onsite"},
            "number_of_openings": 4, "is_verified": True, "is_urgently_needed": False,
            "employer": {"name": "Store", "industry": {"name": "Retail"}},
        })
        self.assertEqual(["Customer service"], result["skills"])
        self.assertEqual("High school", result["education"])
        self.assertEqual(4, result["vacancies"])
        self.assertTrue(result["verified"])
        self.assertFalse(result["urgent"])

    def test_kitalulus_schema_org_metadata(self):
        result = normalize_kitalulus({
            "title": "Sales", "occupationalCategory": "Sales",
            "_vacancy": {"typeStr": "Full-Time", "locationSiteStr": "Campuran (Hybrid)"},
            "educationRequirements": {"credentialCategory": "SMA"},
            "experienceRequirements": {"monthsOfExperience": 12},
            "validThrough": "2026-09-01", "totalJobOpenings": 2,
            "baseSalary": {"value": {"minValue": 1, "maxValue": 2, "unitText": "MONTH"}},
            "hiringOrganization": {"name": "Acme", "industry": "Retail"},
        })
        self.assertEqual("Sales", result["category"])
        self.assertEqual("SMA", result["education"])
        self.assertEqual("12 months", result["experience"])
        self.assertEqual("2026-09-01", result["expiresAt"])
        self.assertEqual("Hybrid", result["workArrangement"])
        self.assertEqual("monthly", result["salaryPeriod"])


if __name__ == "__main__":
    unittest.main()
