import requests, sys
sys.stdout.reconfigure(encoding='utf-8')

endpoints = [
    ("GET", "http://localhost:8000/api/insights/metadata", None),
    ("GET", "http://localhost:8000/api/context-preview?project_id=TEST&region_id=test&platform_id=test&angle_id=test", None),
]

for method, url, body in endpoints:
    try:
        if method == "GET":
            res = requests.get(url, timeout=5)
        else:
            res = requests.post(url, json=body, timeout=10)
        print(f"{method} {url.split('localhost:8000')[1][:60]}  => {res.status_code}")
        if res.status_code >= 400:
            print(f"  BODY: {res.text[:500]}")
    except Exception as e:
        print(f"{method} {url} => ERROR: {e}")
