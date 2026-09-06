# Старые формулы AdmitMap — снято 2026-09-05

## platform.html — calcChance + whyChance

```js
function calcChance(school) {
            const s = typeof school === 'string' ? SCHOOLS.find(x => x.name === school) : school;
            if (!s) return null;
            // Without the school's real admit rate / SAT / GPA there is nothing honest to
            // compute from — callers render an em dash rather than a made-up probability.
            if (s.rate == null || s.sat == null || s.gpa == null) return null;
            const gpa = parseFloat(document.getElementById('plt-gpa')?.value) || USER.gpa || 3.5;
            const testType = document.getElementById('plt-test-type')?.value || USER.testType;
            let sat = USER.testScore || 0;
            if (testType === 'sat') sat = parseFloat(document.getElementById('plt-test-score')?.value) || USER.testScore || 1200;
            else if (testType === 'act') {
                const act = parseFloat(document.getElementById('plt-test-score')?.value) || USER.testScore || 26;
                const actSat = { 36: 1590, 35: 1570, 34: 1540, 33: 1520, 32: 1500, 31: 1480, 30: 1460, 29: 1430, 28: 1410, 27: 1380, 26: 1360, 25: 1330, 24: 1300, 23: 1270, 22: 1240, 21: 1210, 20: 1180, 19: 1150, 18: 1110, 17: 1070 };
                sat = actSat[Math.round(act)] || 1200;
            }
            // Academic deviation multiplier
            const gpaGap = gpa - s.gpa;
            const satGap = sat - s.sat;
            let mult = 1.0;
            mult += gpaGap * 0.55;
            mult += satGap * 0.00055;
            // AP bonus (capped at +8%)
            const aps = USER.apExams.filter(e => e.name && e.score);
            let apBonus = aps.reduce((sum, e) => sum + (e.score >= 5 ? 2.5 : e.score >= 4 ? 1.5 : e.score >= 3 ? 0.5 : -0.3), 0);
            apBonus = Math.min(8, Math.max(-3, apBonus));
            // Essay bonus
            const essayWords = USER.essay.trim().split(/\s+/).filter(w => w).length;
            const essayBonus = essayWords > 400 ? 4 : essayWords > 200 ? 2 : essayWords > 50 ? 1 : 0;
            // Honor bonus
            const hBonus = USER.honorLevel === 'international' ? 7 : USER.honorLevel === 'national' ? 4.5 : USER.honorLevel === 'state' ? 1.5 : 0;
            // Activity bonus
            const actCount = (USER.activities || []).length;
            const actBonus = actCount >= 5 ? 2 : actCount >= 3 ? 1 : 0;
            // Need-aware
            let aidEffect = 0;
            const inc = parseInt(USER.income) || 125000;
            if (s.need_aware && !isNaN(inc)) { if (inc < 60000) aidEffect = 1; else if (inc > 200000) aidEffect = -1.5; }
            let pct = s.rate * mult + apBonus + essayBonus + hBonus + actBonus + aidEffect;
            return Math.round(Math.min(96, Math.max(1, pct)));
        }
        /* Explains a chance number by re-deriving the same terms calcChance uses,
           so the breakdown can never drift from the actual calculation. */
```

## report.html — personalOdds

```js
function personalOdds(st, sc){
  const mult = 1 + (st.gpa - gpaFromSat(sc.sat))*0.55 + (st.sat - sc.sat)*0.00055;
  return Math.round(Math.min(96, Math.max(1,
    sc.admit*mult + Math.min(8, st.activities*0.4) + Math.min(6, st.honors*0.8))));
}
const tierOf = p => p<15?'reach':p<45?'match':'safety';
const tcol   = t => t==='reach'?'#c2566f':t==='match'?'#2563eb':'#516179';

```
