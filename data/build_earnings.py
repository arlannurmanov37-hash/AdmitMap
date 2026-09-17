#!/usr/bin/env python3
"""data/earnings.js — медианный заработок выпускников по специальности.

Источник: College Scorecard, Most-Recent-Cohorts-Field-of-Study (июнь 2026).
Берём только бакалавриат (CREDLEV=3) и только те специальности, что есть
в списке воронки. PrivacySuppressed («PS») — это не ноль, а «не публикуется»:
такие пары школа-специальность пропускаем, в отчёте показываем национальную
медиану по специальности и честно это подписываем.
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
        e = num(row.get('EARN_MDN_HI_2YR')) or num(row.get('EARN_MDN_HI_1YR'))
        if e is None: continue
        nat.setdefault(cip, []).append(e)
        d = unit2dom.get(row['UNITID'])
        if d: by_school.setdefault(d, {})[cip] = e

missing = sorted(WANT - seen_cips)
print('cips with no rows at all:', missing, file=sys.stderr)
NAT = {c: int(statistics.median(v)) for c, v in nat.items()}
out = {'majors': MAJORS, 'national': NAT, 'schools': by_school}
js = ('// СГЕНЕРИРОВАНО data/build_earnings.py — руками не править.\n'
      '// College Scorecard, Field of Study (июнь 2026): медиана заработка\n'
      '// выпускников бакалавриата через 2 года после выпуска (где нет — через 1).\n'
      '// PrivacySuppressed не заменяем оценкой: такие школы просто без цифры.\n'
      'const EARN = ' + json.dumps(out, separators=(',', ':')) + ';\n')
open(os.path.join(REPO, 'data', 'earnings.js'), 'w').write(js)
print('schools with data:', len(by_school), 'national medians:', len(NAT),
      'bytes:', len(js), file=sys.stderr)
