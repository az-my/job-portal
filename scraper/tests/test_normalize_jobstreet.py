import os
import sys
import unittest


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from normalize import normalize_jobstreet  # noqa: E402


class NormalizeJobStreetTests(unittest.TestCase):
    def test_null_company_branding_is_allowed(self):
        job = normalize_jobstreet({
            "id": "123",
            "title": "Customer Support Officer",
            "teaser": "Support customers",
            "companyName": "Example Company",
            "listingDate": {"dateTimeUtc": "2026-07-10T00:00:00Z"},
            "locations": [{"label": "Jakarta"}],
            "_details": {
                "job": {"title": "Customer Support Officer"},
                "companyProfile": {"name": "Example Company", "branding": None},
            },
        })

        self.assertEqual("Example Company", job["company"])
        self.assertEqual("", job["logoUrl"])


if __name__ == "__main__":
    unittest.main()
