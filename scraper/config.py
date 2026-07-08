import uuid

JOBSTREET_GRAPHQL = "https://id.jobstreet.com/graphql"

DEALLS_API = "https://api.sejutacita.id/v1/explore-job/job"

# Client-generated tracking IDs; JobStreet accepts any UUID, so fresh ones
# per run avoid depending on a captured browser session that could expire.
SESSION_ID = str(uuid.uuid4())
SOL_ID = str(uuid.uuid4())

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

KALIBRR_API = "https://www.kalibrr.id/kjs/job_board/search"

KALIBRR_HEADERS = {
    "accept": "application/json",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Referer": "https://www.kalibrr.id/id-ID/home",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
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
