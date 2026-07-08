JOBSTREET_GRAPHQL = "https://id.jobstreet.com/graphql"

DEALLS_API = "https://api.sejutacita.id/v1/explore-job/job"

SESSION_ID = "b15aa248-7c65-44d3-8680-fd47f5e8dd2e"
SOL_ID = "42c1c002-9fc0-406e-8fad-e87359f019bd"

JOBSTREET_HEADERS = {
    "accept": "*/*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "content-type": "application/json",
    "priority": "u=1, i",
    "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"iOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "seek-request-brand": "jobstreet",
    "seek-request-country": "ID",
    "x-custom-features": "application/features.seek.all+json",
    "x-seek-site": "chalice",
    "Referer": "https://id.jobstreet.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Cookie": "; ".join([
        f"sol_id={SOL_ID}",
        f"JobseekerSessionId={SESSION_ID}",
        f"JobseekerVisitorId={SESSION_ID}",
    ]),
}

DEALLS_HEADERS = {
    "accept": "*/*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "content-type": "application/json",
    "x-client-app-name": "Deall-Talent-Web",
    "x-client-app-version": "2.49.52",
    "Referer": "https://dealls.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
}

REQUEST_TIMEOUT = 30
