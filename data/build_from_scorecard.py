#!/usr/bin/env python3
"""Строит справочник вузов из полного дампа College Scorecard.

Дамп качается БЕЗ ключа и без регистрации:
  https://collegescorecard.ed.gov/data/  →  Most-Recent-Cohorts-Institution.zip
Распаковать в data/raw/ и запустить этот скрипт.

Берём только действующие вузы, где основная степень — бакалавр и выше.
"""
import csv, json, os, re

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, 'raw', 'Most-Recent-Cohorts-Institution.csv')
csv.field_size_limit(10_000_000)

def f(v):
    v = (v or '').strip()
    if v in ('', 'NULL', 'PrivacySuppressed'): return None
    try: return float(v)
    except ValueError: return None

def i(v):
    x = f(v)
    return int(x) if x is not None else None

def domain(url):
    u = (url or '').strip().lower()
    if not u: return None
    u = re.sub(r'^https?://', '', u).split('/')[0].split('?')[0]
    u = re.sub(r'^www\.', '', u)
    return u or None

out = {}
with open(SRC, encoding='utf-8-sig', newline='') as fh:
    for row in csv.DictReader(fh):
        if row.get('CURROPER') != '1': continue            # закрытые не нужны
        if row.get('PREDDEG') not in ('3', '4'): continue   # бакалавриат и выше
        d = domain(row.get('INSTURL'))
        if not d: continue
        rate = f(row.get('ADM_RATE'))
        pub  = row.get('CONTROL') == '1'
        sfx  = 'PUB' if pub else 'PRIV'
        inc  = [i(row.get(f'NPT{k}_{sfx}')) for k in range(1, 6)]
        pell = f(row.get('PCTPELL'))
        rec = {
            'd': d,
            'n': (row.get('INSTNM') or '').strip(),
            'state': (row.get('STABBR') or '').strip() or None,
            'loc': (f"{(row.get('CITY') or '').strip()}, {(row.get('STABBR') or '').strip()}").strip(', ') or None,
            'pub': pub,
            'rate': round(rate * 100, 1) if rate is not None else None,
            'sat': i(row.get('SAT_AVG')),
            'act': i(row.get('ACTCMMID')),
            'coa': i(row.get('COSTT4_A')),
            'np':  i(row.get(f'NPT4_{sfx}')),
            'inc': inc if any(x is not None for x in inc) else None,
            'pell': round(pell * 100) if pell is not None else None,
            'debt': i(row.get('GRAD_DEBT_MDN')),
            'ugds': i(row.get('UGDS')),
            'src': 'scorecard',
        }
        # у некоторых сетей все кампусы делят один домен — оставляем крупнейший
        prev = out.get(d)
        if prev and (prev.get('ugds') or 0) >= (rec.get('ugds') or 0): continue
        out[d] = {k: v for k, v in rec.items() if v is not None}

json.dump(out, open(os.path.join(D, 'scorecard_clean.json'), 'w'), separators=(',', ':'))
print(f'вузов: {len(out)}')
for k in ('rate', 'sat', 'act', 'coa', 'inc'):
    print(f'  {k}: {sum(1 for r in out.values() if r.get(k))}')
print(f'  rate+coa: {sum(1 for r in out.values() if r.get("rate") and r.get("coa"))}')
