# onboarding.html — all text on the page

Three screens, shown in sequence. Edit this file directly.

---

## SCREEN 1 — Loading (`#s-load`) · 30 seconds

**Logo:** AdmitMap

**Status pill, top right** — changes as it runs:
| When | Text |
|---|---|
| Steps 1–2 | Getting started |
| Steps 3–4 | Working through it |
| Steps 5–6 | Almost there |
| 100% | Done |

**Ring:** `0%` → `100%`
**Label under the number:** `Analyzing` → at 100% becomes `Analysed`

**Heading:** Building your report.

**Line under the heading** — the step running right now:
1. Reading your academic profile
2. Scoring your activities and honors
3. Comparing against admitted students
4. Grading your essay on six criteria
5. Modelling financial aid
6. Calculating your acceptance odds

At 100% → **Acceptance odds calculated** (green, with a tick)

**Checklist** — same six, but past tense once each one finishes:

| Left column | Right column |
|---|---|
| Academic profile read | Activities and honors scored |
| Compared against admitted students | Essay graded on six criteria |
| Financial aid modelled | Acceptance odds calculated |

---

## SCREEN 2 — Social proof (`#s-proof`)

> ⚠️ Every number on this screen is unverifiable. Same problem we removed from the landing page.

- **4.9** /5 — from 3,200 student reviews
- Trusted by **10,000+** applicants building a smarter school list.
- **$9,400** — saved per student, a year
- **$41M** — in aid uncovered
- Quote: *"The aid modelling found the schools where I'd get a real package — two came out cheaper than my state school."*
  — **Dani R.**, `Admitted · NYU`, `$14,200/yr after aid`
- Button: **See my report**

---

## SCREEN 3 — Analysis complete (`#s-found`)

**Eyebrow:** Analysis complete

**Heading:** Here's what we found in your profile.

**Subheading:** Every school on your list, scored against this year's admitted class and modelled against your family's finances.

**Stat rows:**

| Figure | Label | Sub-label |
|---|---|---|
| All 10 schools scored | | Dream, Match and Safety |
| **7** /10 | beat the admitted average | GPA, rigor and activities |
| **3** /10 | cost under $18,000 a year | after grants, not sticker price |
| **4** /10 | reward applying early | ED and EA close in |
| **85** days | | |
| **$91.4k** | in grants and aid modelled | across your four years |

**Locked block:**
- Still locked
- Per-school odds, tiering and net costs are ready in your report.
- 10 schools waiting

**Button:** Continue

---

## Notes

- **Screen 3's numbers are hardcoded**, not computed: `7/10`, `3/10`, `4/10`, `$91.4k` and `All 10 schools` are written straight into the HTML. Only the `85 days` countdown is calculated (days to Nov 1). So a student with 4 schools still reads "All 10 schools scored".
- Ring label reads `Analyzing` (US spelling) but flips to `Analysed` (UK). Pick one.
