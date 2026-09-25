#!/usr/bin/env python3
"""data/earnings.js — медианный заработок выпускников по специальности.

Источник: College Scorecard, Most-Recent-Cohorts-Field-of-Study (10.06.2026).
Цифра — EARN_MDN_4YR: медиана годового заработка выпускников бакалавриата
(CREDLEV=3) на четвёртый полный год после выпуска, в долларах 2024 года.
Только получавшие федеральную помощь, работающие и не продолжающие учёбу.

В школе: если специальности соответствуют несколько кодов CIP (CS = 11.07
и 11.01), берём программу с большим числом выпускников в расчёте.
По США: медиана по всем программам этой специальности, взвешенная по
EARN_COUNT_WNE_4YR, — крупные программы весят больше, как в жизни.
PrivacySuppressed («PS») — не ноль, а «не публикуется»: такие пары
пропускаем, ничем не подменяем.

Скачать: https://collegescorecard.ed.gov/data/ → Most Recent Field of Study
в data/fos/ (в git не хранится).
"""
import csv, json, os, re, statistics, sys

SCR = os.path.dirname(os.path.abspath(__file__))
REPO = '/Users/arlannurmanov/AdmitMap'
FOS = os.path.join(SCR, 'fos', 'Most-Recent-Cohorts-Field-of-Study.csv')
INST = os.path.join(REPO, 'data', 'raw', 'Most-Recent-Cohorts-Institution.csv')
csv.field_size_limit(10_000_000)

MAJORS = {
  'Computer Science':['1107','1101'], 'Electrical Engineering':['1410','1447'],
  'Mechanical Engineering':['1419'], 'Civil Engineering':['1408'],
  'Chemical Engineering':['1407'], 'Biomedical Engineering':['1405'],
  'Aerospace Engineering':['1402'], 'Software Engineering':['1409','1108'],
  'Data Science':['3070','3071'], 'Biology':['2601'], 'Chemistry':['4005'],
  'Physics':['4008'], 'Neuroscience':['2615'], 'Environmental Science':['0301','0302'],
  'Biochemistry':['2602'], 'Mathematics':['2701'], 'Applied Mathematics':['2703'],
  'Statistics':['2705','2706'], 'Business Administration':['5202','5201'],
  'Finance':['5208'], 'Accounting':['5203'], 'Marketing':['5214'],
  'Economics':['4506','5206'], 'Entrepreneurship':['5207'], 'Psychology':['4201'],
  'Political Science':['4510'], 'Sociology':['4511'], 'Anthropology':['4502'],
  'International Relations':['4509'], 'Public Policy':['4405'], 'English':['2301'],
  'History':['5401'], 'Philosophy':['3801'], 'Classics':['1612'],
  'Linguistics':['1601'], 'Fine Arts':['5007'], 'Graphic Design':['5004','1003'],
  'Architecture':['0402'], 'Music':['5009'], 'Theatre':['5005'],
  'Film & Media':['5006'], 'Creative Writing':['2305'], 'Nursing':['5138'],
  'Public Health':['5122'], 'Pre-Med':['2601','2602'], 'Pre-Law':['4510'],
  'Kinesiology':['3105'], 'Education':['1301'], 'Communications':['0901'],
  'Journalism':['0904'], 'Media Studies':['0901'],
}
WANT = {c for codes in MAJORS.values() for c in codes}

def domain(url):
    u = (url or '').strip().lower()
    if not u: return None
    u = re.sub(r'^https?://', '', u).split('/')[0].split('?')[0]
    return re.sub(r'^www\.', '', u) or None

def num(v):
    v = (v or '').strip()
    return int(float(v)) if re.fullmatch(r'\d+(\.\d+)?', v) else None

ours = set(re.findall(r'"([a-z0-9.-]+\.[a-z]{2,})":\{', open(os.path.join(REPO,'data','colleges.js')).read()))
# Филиалы делят домен с головным кампусом (purdue.edu — и Main, и Fort Wayne).
# Берём головной, иначе к школе прилипают заработки филиала.
best = {}
with open(INST, encoding='utf-8-sig', newline='') as fh:
    for row in csv.DictReader(fh):
        d = domain(row.get('INSTURL'))
        # web.mit.edu, www2.xxx.edu — у нас домен без поддомена
        while d and d not in ours and d.count('.') > 1: d = d.split('.', 1)[1]
        if d not in ours: continue
        ugds = num(row.get('UGDS')) or 0
        rank = (1 if row.get('MAIN') == '1' else 0, ugds)
        if d not in best or rank > best[d][0]: best[d] = (rank, row['UNITID'])
unit2dom = {u: d for d, (_, u) in best.items()}
print('schools matched:', len(unit2dom), 'of', len(ours), file=sys.stderr)

by_school, nat = {}, {}
seen_cips = set()
with open(FOS, encoding='utf-8-sig', newline='') as fh:
    for row in csv.DictReader(fh):
        if row['CREDLEV'] != '3': continue
        cip = row['CIPCODE']
        if cip not in WANT: continue
        seen_cips.add(cip)
        e = num(row.get('EARN_MDN_4YR'))
        if e is None: continue
        w = num(row.get('EARN_COUNT_WNE_4YR')) or 1
        nat.setdefault(cip, []).append((e, w))
        d = unit2dom.get(row['UNITID'])
        if d:
            cur = by_school.setdefault(d, {}).get(cip)
            if cur is None or w > cur[1]: by_school[d][cip] = (e, w)

def wmedian(pairs):
    pairs = sorted(pairs)
    total = sum(w for _, w in pairs); acc = 0
    for e, w in pairs:
        acc += w
        if acc * 2 >= total: return e

missing = sorted(WANT - seen_cips)
print('cips with no rows at all:', missing, file=sys.stderr)
# Медиана по США — по специальности целиком (все её коды CIP вместе),
# а в школе — по одной программе с наибольшим числом выпускников.
NATM = {}
for m, codes in MAJORS.items():
    pairs = [p for c in codes for p in nat.get(c, [])]
    if pairs: NATM[m] = wmedian(pairs)
SCH = {}
for d, cips in by_school.items():
    row = {}
    for m, codes in MAJORS.items():
        best = max((cips[c] for c in codes if c in cips), key=lambda p: p[1], default=None)
        if best: row[m] = best[0]
    if row: SCH[d] = row
out = {'national': NATM, 'schools': SCH}
js = ('// СГЕНЕРИРОВАНО data/build_earnings.py — руками не править.\n'
      '// College Scorecard, Field of Study (10.06.2026): EARN_MDN_4YR — медиана заработка\n'
      '// выпускников бакалавриата на 4-й год после выпуска, $ 2024. По США — медиана\n'
      '// по специальности, взвешенная по числу выпускников. PrivacySuppressed пропущен.\n'
      'const EARN = ' + json.dumps(out, separators=(',', ':')) + ';\n')
open(os.path.join(REPO, 'data', 'earnings.js'), 'w').write(js)
print('schools with data:', len(SCH), 'majors with US median:', len(NATM),
      'bytes:', len(js), file=sys.stderr)
