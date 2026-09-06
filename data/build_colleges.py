#!/usr/bin/env python3
"""Собирает data/colleges.js — единый справочник вузов для отчёта и платформы.

Источники, в порядке доверия:
  1. college_data_150.csv    — заполнено вручную и проверено
  2. platform.html SCHOOLS   — 41 вуз с GPA, штатом и дедлайнами
  3. data/scorecard_clean.json — полный дамп College Scorecard, 2083 вуза
  4. data/finaid.js FIN        — выверенные вручную нетто-цены (перекрывает дамп)

Поле src говорит, откуда взята строка: отчёт помечает оценочные данные.
"""
import csv, json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def path(*p): return os.path.join(ROOT, *p)

def num(x):
    x = (x or '').strip().replace(',', '')
    if not x: return None
    try: return float(x) if '.' in x else int(x)
    except ValueError: return None

out = {}

# ── 3. College Scorecard: базовый слой, все четырёхлетние вузы ─────────
SC = json.load(open(path('data', 'scorecard_clean.json'), encoding='utf-8'))
for d, v in SC.items():
    if v.get('rate') is None: continue          # без процента приёма шансы не считаются
    out[d] = dict(v)

# Старый IPEDS-файл добирает вузы, которых нет в дампе.
raw = open(path('data', 'schoolstats.js'), encoding='utf-8').read()
STATS = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
for d, v in STATS.items():
    if v.get('ad') is None or d in out: continue
    out[d] = {'d': d, 'rate': v['ad'], 'sat': v.get('sat'), 'act': v.get('act'), 'src': 'ipeds'}

# ── 2. платформа: GPA, штат, тип и даты раундов ───────────────────────
plat = open(path('platform.html'), encoding='utf-8').read()
i = plat.index('const SCHOOLS = [') + len('const SCHOOLS = [')
depth, j = 1, i
while depth:
    if plat[j] == '[': depth += 1
    elif plat[j] == ']': depth -= 1
    j += 1
for m in re.finditer(r'\{([^{}]*)\}', plat[i:j - 1]):
    f = dict(re.findall(r'(\w+)\s*:\s*"([^"]*)"', m.group(1)))
    n = dict(re.findall(r'(\w+)\s*:\s*([\d.]+)', m.group(1)))
    d = f.get('domain')
    if not d: continue
    r = out.setdefault(d, {'d': d})
    # Цифры из platform.html набраны руками и без источника: у NYU там 16%
    # против 9.2% в федеральной отчётности. Поэтому процент приёма и баллы
    # берём ТОЛЬКО из Scorecard, а у платформы — то, чего в Scorecard нет:
    # дедлайны, средний GPA, город и человеческое название.
    keep = {'n': f.get('name'), 'state': f.get('state'), 'loc': f.get('loc'),
            'gpa': n.get('gpa'), 'ed': f.get('ed'), 'ea': f.get('ea'), 'rd': f.get('rd')}
    for key in ('rate', 'sat', 'act'):
        if r.get(key) is None:            # только если федеральных данных нет вовсе
            keep[key] = n.get(key)
    r.update({k: v for k, v in keep.items() if v})
    if r.get('src') != 'scorecard':
        r['src'] = 'platform'

# ── 1. ручная выверка: перекрывает всё остальное ──────────────────────
BANDS = ['net_under_30k', 'net_30_48k', 'net_48_75k', 'net_75_110k',
         'net_110_150k', 'net_150_200k', 'net_200k_plus']
for row in csv.DictReader(open(path('college_data_150.csv'), encoding='utf-8')):
    d = (row['domain'] or '').strip()
    if not d or num(row['accept_rate_pct']) is None: continue
    r = out.setdefault(d, {'d': d})
    r.update({k: v for k, v in {
        'n': row['name'].strip(), 'state': row['state'].strip(), 'loc': None,
        'rate': num(row['accept_rate_pct']), 'sat': num(row['avg_sat']),
        'act': num(row['avg_act']), 'gpa': num(row['avg_gpa']),
        'ed': row['ED_date'].strip() or None, 'ea': (row['EA_date'] or row['REA_date']).strip() or None,
        'rd': row['RD_date'].strip() or None,
        'coa': num(row['coa_sticker'])}.items() if v is not None})
    inc = [num(row[b]) for b in BANDS]
    if any(x is not None for x in inc): r['inc7'] = inc
    r['src'] = 'verified'

# ── имена: без них строку не показать ─────────────────────────────────
uni = open(path('funnel.html'), encoding='utf-8').read()
k = uni.index('const universities = [')
for name, dom in re.findall(r"name: '([^']*)',\s*domain: '([^']*)'", uni[k:k + 200000]):
    r = out.get(dom)
    if r and not r.get('n'): r['n'] = name

for f in ('missing_data_schools.csv', 'missing_top100.csv'):
    fp = path(f)
    if not os.path.exists(fp): continue
    for row in csv.DictReader(open(fp, encoding='utf-8')):
        r = out.get((row.get('domain') or '').strip())
        if r and not r.get('n'): r['n'] = (row.get('name') or '').strip()

out = {d: r for d, r in out.items() if r.get('n')}
for r in out.values():
    for key in ('sat', 'act', 'gpa', 'rate', 'coa'):
        if key in r and r[key] is not None: r[key] = round(float(r[key]), 2)

js = ('// СГЕНЕРИРОВАНО data/build_colleges.py — руками не править.\n'
      '// Источники: college_data_150.csv (проверено вручную) > platform.html SCHOOLS >\n'
      '// data/schoolstats.js (IPEDS) ; стоимость — data/finaid.js (College Scorecard).\n'
      '// src: verified | platform | ipeds — отчёт помечает оценочные строки.\n'
      'const COLLEGES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'if (typeof window !== "undefined") window.COLLEGES = COLLEGES;\n')
open(path('data', 'colleges.js'), 'w', encoding='utf-8').write(js)

by = {}
for r in out.values(): by[r['src']] = by.get(r['src'], 0) + 1
print('colleges:', len(out), by)
print('без SAT и ACT:', sum(1 for r in out.values() if not r.get('sat') and not r.get('act')))
