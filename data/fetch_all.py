#!/usr/bin/env python3
"""Один проход по College Scorecard: всё, что нужно отчёту, по КАЖДОМУ
четырёхлетнему вузу США — приём, SAT/ACT, стоимость, нетто-цена по доходу.

~2000 вузов = ~20 запросов, это влезает в лимит DEMO_KEY (30/час).
Свой ключ (мгновенно, бесплатно: https://api.data.gov/signup/) снимает лимит:
    DATA_GOV_KEY=... python3 data/fetch_all.py
"""
import urllib.request, urllib.parse, urllib.error, json, os, sys, time, re

KEY  = os.environ.get("DATA_GOV_KEY", "DEMO_KEY")
BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"
D    = os.path.dirname(os.path.abspath(__file__))
OUT  = D + "/scorecard_all.json"

FIELDS = ",".join([
    "id", "school.name", "school.city", "school.state", "school.school_url",
    "school.ownership",                                   # 1 гос, 2/3 частные
    "latest.admissions.admission_rate.overall",
    "latest.admissions.sat_scores.average.overall",
    "latest.admissions.act_scores.midpoint.cumulative",
    "latest.cost.attendance.academic_year",
    "latest.cost.avg_net_price.public", "latest.cost.avg_net_price.private",
    "latest.aid.median_debt.completers.overall",
    "latest.student.demographics.student_faculty_ratio",
    "latest.aid.pell_grant_rate",
] + [f"latest.cost.net_price.{o}.by.income.level.{b}"
     for o in ("public", "private")
     for b in ("0-30000", "30001-48000", "48001-75000", "75001-110000", "110001-plus")])

def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:                              # лимит — ждём и пробуем ещё
                wait = 60 * (i + 1)
                print(f"  429, sleeping {wait}s", flush=True); time.sleep(wait); continue
            raise
        except Exception as e:
            print(f"  {e}, retry", flush=True); time.sleep(5)
    raise SystemExit("giving up")

rows, page = [], 0
while True:
    q = urllib.parse.urlencode({
        "api_key": KEY, "fields": FIELDS, "per_page": 100, "page": page,
        "latest.school.degrees_awarded.predominant": "3,4",   # бакалавриат и выше
        "school.operating": 1,
    })
    d = get(f"{BASE}?{q}")
    batch = d.get("results", [])
    rows += batch
    total = d["metadata"]["total"]
    print(f"page {page}: +{len(batch)} → {len(rows)} / {total}", flush=True)
    if not batch or len(rows) >= total: break
    page += 1

json.dump(rows, open(OUT, "w"), separators=(",", ":"))
print("saved", OUT, len(rows), "schools")
have_rate = sum(1 for r in rows if r.get("latest.admissions.admission_rate.overall"))
have_sat  = sum(1 for r in rows if r.get("latest.admissions.sat_scores.average.overall"))
have_cost = sum(1 for r in rows if r.get("latest.cost.attendance.academic_year"))
print(f"admit rate: {have_rate}   SAT: {have_sat}   COA: {have_cost}")
