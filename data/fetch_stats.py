#!/usr/bin/env python3
"""Pull real admit rate / SAT / ACT for every US bachelor's institution
from the US Dept. of Education College Scorecard. Resumable; saves into ./data."""
import urllib.request, urllib.parse, json, time, os, re

KEY  = "DEMO_KEY"
BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"
D    = os.path.dirname(os.path.abspath(__file__))
OUT, STATE, LOG = D+"/stats_raw.json", D+"/stats_state.json", D+"/fetch_stats.log"

FIELDS = ",".join([
    "school.name",
    "latest.admissions.admission_rate.overall",
    "latest.admissions.sat_scores.average.overall",
    "latest.admissions.act_scores.midpoint.cumulative",
])

def norm(x):
    x = (x or "").lower().replace("&", " and ")
    x = re.sub(r"[.,'’\-:]", " ", x)
    x = re.sub(r"\bthe\b", " ", x)
    return re.sub(r"\s+", " ", x).strip()

def log(m):
    with open(LOG, "a") as f: f.write(m+"\n")
    print(m, flush=True)

stats = json.load(open(OUT)) if os.path.exists(OUT) and os.path.getsize(OUT) > 2 else {}
page  = (json.load(open(STATE))["page"] if os.path.exists(STATE) else 0)
log(f"--- start page {page}, {len(stats)} kept ---")

c429 = 0
while True:
    q = urllib.parse.urlencode({"api_key": KEY, "fields": FIELDS,
        "latest.school.degrees_awarded.predominant": 3, "per_page": 100, "page": page})
    try:
        with urllib.request.urlopen(f"{BASE}?{q}", timeout=60) as r:
            data = json.loads(r.read().decode())
        c429 = 0
    except urllib.error.HTTPError as e:
        if e.code == 429:
            c429 += 1
            if c429 > 20: log(f"429 x{c429} — stopping at page {page}"); break
            log(f"429 at page {page} — wait 600s (try {c429})"); time.sleep(600); continue
        log(f"HTTP {e.code} at page {page} — stop"); break
    except Exception as e:
        log(f"ERR page {page}: {e} — wait 30s"); time.sleep(30); continue

    res = data.get("results", [])
    if not res: log(f"page {page}: empty — DONE"); break
    added = 0
    for s in res:
        name = s.get("school.name")
        if not name: continue
        ad  = s.get("latest.admissions.admission_rate.overall")
        sat = s.get("latest.admissions.sat_scores.average.overall")
        act = s.get("latest.admissions.act_scores.midpoint.cumulative")
        e = {}
        if sat is not None: e["sat"] = int(round(sat))
        if ad  is not None: e["ad"]  = round(ad*100, 1)
        if act is not None: e["act"] = int(round(act))
        if e: stats[norm(name)] = e; added += 1
    log(f"page {page}: +{added}, total {len(stats)}")
    json.dump(stats, open(OUT, "w"))
    page += 1
    json.dump({"page": page}, open(STATE, "w"))
    time.sleep(2)

json.dump(stats, open(OUT, "w"))
log(f"DONE. {len(stats)} schools -> {OUT}")
