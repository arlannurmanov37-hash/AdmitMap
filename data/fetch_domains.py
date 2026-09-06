#!/usr/bin/env python3
"""Re-pull stats keyed by DOMAIN. Names collide (Bloomsburg U of Pennsylvania vs
University of Pennsylvania); domains cannot. Resumable; writes ./data/stats_by_domain.json"""
import urllib.request, urllib.parse, json, time, os, re

KEY="DEMO_KEY"; BASE="https://api.data.gov/ed/collegescorecard/v1/schools"
D=os.path.dirname(os.path.abspath(__file__))
OUT,STATE,LOG=D+"/stats_by_domain.json",D+"/dom_state.json",D+"/fetch_domains.log"
FIELDS=",".join(["school.name","school.school_url",
 "latest.admissions.admission_rate.overall",
 "latest.admissions.sat_scores.average.overall",
 "latest.admissions.act_scores.midpoint.cumulative"])

def dom(u):
    if not u: return None
    u=u.strip().lower()
    u=re.sub(r'^https?://','',u); u=re.sub(r'^www\.','',u)
    u=u.split('/')[0].split('?')[0].strip()
    return u or None

def log(m):
    with open(LOG,"a") as f: f.write(m+"\n")
    print(m,flush=True)

data_out=json.load(open(OUT)) if os.path.exists(OUT) and os.path.getsize(OUT)>2 else {}
page=(json.load(open(STATE))["page"] if os.path.exists(STATE) else 0)
log(f"--- start page {page}, {len(data_out)} kept ---")
c429=0
while True:
    q=urllib.parse.urlencode({"api_key":KEY,"fields":FIELDS,
        "latest.school.degrees_awarded.predominant":3,"per_page":100,"page":page})
    try:
        with urllib.request.urlopen(f"{BASE}?{q}",timeout=60) as r:
            d=json.loads(r.read().decode())
        c429=0
    except urllib.error.HTTPError as e:
        if e.code==429:
            c429+=1
            if c429>24: log(f"429 x{c429} — stop at {page}"); break
            log(f"429 at page {page} — wait 600s (try {c429})"); time.sleep(600); continue
        log(f"HTTP {e.code} at {page} — stop"); break
    except Exception as e:
        log(f"ERR {page}: {e}"); time.sleep(30); continue
    res=d.get("results",[])
    if not res: log(f"page {page}: empty — DONE"); break
    add=0
    for s in res:
        dm=dom(s.get("school.school_url"))
        if not dm: continue
        ad=s.get("latest.admissions.admission_rate.overall")
        sat=s.get("latest.admissions.sat_scores.average.overall")
        act=s.get("latest.admissions.act_scores.midpoint.cumulative")
        e={}
        if sat is not None: e["sat"]=int(round(sat))
        if ad is not None: e["ad"]=round(ad*100,1)
        if act is not None: e["act"]=int(round(act))
        if e: data_out[dm]=e; add+=1
    log(f"page {page}: +{add}, total {len(data_out)}")
    json.dump(data_out,open(OUT,"w")); page+=1
    json.dump({"page":page},open(STATE,"w")); time.sleep(2)
json.dump(data_out,open(OUT,"w"))
log(f"DONE. {len(data_out)} domains -> {OUT}")
