# AdmitMap — Funnel Question Inventory & Recommendations

Generated 27 Aug 2026 from `funnel.html`. Part 1 is exactly what you ask today.
Part 2 is what I'd add. Edit this file directly.

---

# PART 1 — EVERY QUESTION YOU ASK TODAY

7 steps. 100% completion requires 14 checks (see `completion()` at funnel.html:1345).

---

## STEP 1 — Basics
> *"Let's start with you." — A few basics so every number in your report is scored against the right class year.*

| # | Question | Type | Options / Notes | Required |
|---|---|---|---|---|
| 1.1 | **First name** | text | placeholder "Maya". First name only — no surname | ✅ |
| 1.2 | **Graduation year** | select | | ✅ |
| 1.3 | **State of residence** | select | 50 states + DC + "Outside the U.S." | ✅ |
| 1.4 | **What do you want to study?** | grouped select | 8 categories: Engineering & CS, Natural Sciences, Math & Statistics, Business & Economics, Social Sciences, Humanities, + others | ✅ |

Card: *Intended major — "admit rates differ a lot by program"*

---

## STEP 2 — Academics
> *"Your academic record." — GPA, test scores and course rigor carry the most weight in your admission probability.*

| # | Question | Type | Options / Notes | Required |
|---|---|---|---|---|
| 2.1 | **Grade point average** | number | "unweighted, 4.0 scale". placeholder 3.85 | ✅ **only required field here** |
| 2.2 | **Class rank** | number | placeholder 12 | ❌ |
| 2.3 | **Class size** | number | placeholder 458 | ❌ |
| 2.4 | **SAT composite** | number | 400–1600. "leave both blank if you're applying test-optional" | ❌ |
| 2.5 | **ACT composite** | number | 1–36 | ❌ |
| 2.6 | **Honors courses** | number | "AP, IB and honors coursework". placeholder 5 | ❌ |
| 2.7 | **Highest math reached** | select | Algebra II → Pre-Calc → Trig → Statistics → AP Stats → Calculus → AP Calc AB → AP Calc BC → Multivariable → Linear Algebra → Diff Eq | ❌ |
| 2.8 | **AP exams taken** | multi-select | Full official AP course list (~38), each with a score field | ❌ |

---

## STEP 3 — Activities
> *"What you actually do." — Depth beats length. Three real commitments read stronger than ten club memberships.*

Repeatable block. Completion wants **at least 3**.

| # | Question | Type | Options / Notes |
|---|---|---|---|
| 3.1 | **Activity or experience type** | select | 30 Common App types: Academic, Art, Athletics: Club, Athletics: JV/Varsity, Career Oriented, Community Service, Computer/Technology, Cultural, Dance, Debate/Speech, Environmental, Family Responsibilities, Foreign Exchange, Foreign Language, Internship, Journalism/Publication, Junior R.O.T.C., Music: Instrumental, Music: Vocal, Religious, Research, Robotics, School Spirit, Science/Math, Social Justice, Student Govt./Politics, Theater/Drama, Work (Paid), Other Club/Activity, Other |
| 3.2 | **Describe it** | textarea | 100 char limit. "e.g. Led a 14-person team to the state final" |
| 3.3 | **Organization or group** | text | "e.g. Lincoln High Robotics" |
| 3.4 | **Did you hold a position or leadership role?** | Yes / No | |
| 3.5 | **Your title** | text | shown if Yes. "e.g. Captain" |
| 3.6 | **Grade levels** | multi-chip | 9, 10, 11, 12, After high school |
| 3.7 | **Hours per week** | number | placeholder 10 |
| 3.8 | **Weeks per year** | number | placeholder 30 |
| 3.9 | **Do you plan to continue this in college?** | Yes / No / Not sure | |

---

## STEP 4 — Financial *(optional, gated)*
> *"Money, before it decides for you." — Answer two questions and every school gets a real price instead of a sticker one.*

**Gate: "Do you want to know your financial aid?"** → *Yes, price my list* / *Skip it*
Pitch shown: across the 1,473 schools with cost data, average gap between sticker and real price is **$20,459/year**.

If **Yes** — 6 questions (the UI says "five"):

| # | Question | Type | Notes |
|---|---|---|---|
| 4.1 | **Household income before tax** | slider | $0–$400k, $2,500 steps. "both parents combined, last filed return" — *"income carries the most weight in every aid formula"* |
| 4.2 | **How many people do your parents support?** | number | "including you" |
| 4.3 | **Your own income last year** | slider | $0–$30k, $500 steps. "jobs, internships — assessed harder than your parents'" |
| 4.4 | **Parent savings and checking** | slider | $0–$200k, $2,500 steps |
| 4.5 | **Parent investments** | slider | $0–$500k, $5,000 steps — *"counted far more gently than income — under 6%"* |
| 4.6 | **What can your family pay per year?** | slider | $0–$100k, $1,000 steps. "your ceiling, not what you hope for" |

---

## STEP 5 — Honors
> *"Honors and awards." — Recognition level matters far more than the count. It is fine to have none.*

Repeatable, fully optional.

| # | Question | Type | Options |
|---|---|---|---|
| 5.1 | **Title** | text | "e.g. National Merit Semifinalist" |
| 5.2 | **Grade levels** | multi-chip | 9, 10, 11, 12, Post-graduate |
| 5.3 | **Level of recognition** | multi-chip | School / State-Regional / National / International |

---

## STEP 6 — Schools
> *"Your school list." — Add up to 10. Include reaches and safeties.*

| # | Question | Type | Notes |
|---|---|---|---|
| 6.1 | **Search colleges** | typeahead | Max 10. Completion wants ≥3. Aliases supported (mit, caltech, ucla, berkeley…) |

**No per-school follow-up questions.** ← biggest structural gap, see 2.1 below.

---

## STEP 7 — Essay
> *"Your personal statement." — Optional, but it moves your odds at selective schools.*

| # | Question | Type | Notes |
|---|---|---|---|
| 7.1 | **Which prompt?** | radio | The verbatim Common App 7 |
| 7.2 | **Your draft** | textarea | Word counter, 650-word Common App limit |
| 7.3 | **Email address** | email | validated. *"your report opens right away — the link is so you can come back to it"* | ✅ |

---

## TOTALS

| | Count |
|---|---|
| Fixed questions | 22 |
| Per activity (×3+) | 9 |
| Per honor | 3 |
| Strictly required | 5 (name, grad year, state, major, GPA) + 3 schools + email |

---

# PART 2 — WHAT I'D ADD, RANKED

Ordered by **accuracy gained per unit of friction**. Not all of these should ship.

---

## TIER 1 — Big accuracy gains, low friction

### 2.1 Application round, per school ⭐ THE BIGGEST ONE
**Where:** Step 6, on each school chip.
**Ask:** *"Which round?"* → ED / ED II / EA / REA / RD / Not sure

This is the single largest lever in the entire model. Applying ED to Duke roughly triples your odds versus RD. Vanderbilt: ~15% ED vs ~4% RD. A report that ignores round can be wrong by a factor of three at exactly the schools students care most about.

You already hold verified ED/EDII/EA/REA/RD deadlines per school. The data is there; the question isn't.

⚠️ **Conflicts with a decision you already made** — the report spec is currently round-agnostic. So this is a real fork: keep it simple and be systematically wrong on reaches, or add one dropdown per school and be far more accurate. My vote is add it, but it's your call.

### 2.2 Citizenship status ⭐
**Where:** Step 1.
**Ask:** *"Are you a U.S. citizen or permanent resident?"* → Citizen/PR / DACA or undocumented / International student

Two enormous effects at once:
- **Admissions:** international admit rates are dramatically lower at most privates and brutal at publics — Michigan, UNC, UVA cap out-of-state and international sharply.
- **Aid:** most schools are *need-aware* for internationals, and the majority give them no institutional aid at all. Your entire financial model breaks for a non-citizen.

You have "Outside the U.S." in the state list, but residence ≠ citizenship. A US citizen living in Dubai and a Kazakh national are completely different applicants.

### 2.3 First-generation status ⭐
**Where:** Step 1, optional.
**Ask:** *"Did either parent complete a four-year degree in the U.S.?"* → Yes / No / Not sure

First-gen is a substantial, openly-acknowledged boost at selective schools — many publish first-gen admit rates well above their overall rate. Every serious chancing tool asks it. One question.

### 2.4 Recruited athlete
**Where:** Step 3.
**Ask:** *"Are you being recruited to play a sport in college?"* → Yes, with a likely letter or coach support / In contact with coaches / No

The largest single hook in admissions — recruited athletes at Ivies are admitted at rates several times the general pool. If a recruited athlete gets a 4% estimate for Princeton, your report is badly wrong for them, and they're exactly the student who'll tell people.

### 2.5 Do you intend to submit scores?
**Where:** Step 2, after SAT/ACT.
**Ask:** *"Do you plan to submit these scores?"* → Yes / No, applying test-optional / Depends on the school

You infer test-optional from blank fields, but that misreads a very common case: a student with a 1380 who'll submit to some schools and not others. Submitting a below-median score actively hurts. Right now you can't tell "no score" from "score I'm hiding."

---

## TIER 2 — High value, more friction

### 2.6 High school context ⭐ (the most underrated item here)
**Where:** Step 2.
**Ask two:**
- *"What kind of high school?"* → Public / Private / Charter / Magnet / Homeschool / International
- *"Roughly how many AP or IB courses does your school offer?"* → None / 1–5 / 6–10 / 11–20 / 20+ / Don't know

This is how admissions officers actually read rigor: **relative to what was available.** 4 APs at a school offering 5 is maximum rigor. 4 APs at a school offering 25 is coasting. Your `honorsCount` field currently treats those identically.

Two dropdowns, and your rigor score stops being systematically unfair to students at under-resourced schools — who are exactly the students your positioning is aimed at.

### 2.7 Legacy
**Where:** Step 1, optional.
**Ask:** *"Did a parent or grandparent attend any school on your list?"* → No / Yes (which)

Still worth a lot at many privates, though a growing number have dropped it. Slightly awkward to ask; pairs naturally with first-gen.

### 2.8 "Does your school rank?"
**Where:** Step 2, before class rank.
Most high schools **don't rank** anymore. Right now a student at a non-ranking school leaves 2.2 and 2.3 blank, which is indistinguishable from laziness. One toggle removes the ambiguity and lets you weight rank properly when it exists.

### 2.9 Senior-year course load
**Where:** Step 2.
**Ask:** *"How would you describe your senior schedule?"* → Most rigorous available / Very rigorous / Rigorous / Standard

Colleges explicitly rate "rigor of secondary school record" on the Common Data Set. Senior year is the last signal they see, and a lightened senior year is a documented red flag.

---

## TIER 3 — Financial accuracy

Your aid section is already stronger than most. Four gaps:

### 2.10 Divorced or separated parents ⭐
**Ask:** *"Are your parents married to each other?"* → Yes / No, divorced or separated / Other

Roughly 200 schools use the **CSS Profile**, which requires **non-custodial parent income**. For a student whose custodial parent earns $50k while the other earns $200k, your estimate could be off by tens of thousands. This is the biggest error source in your aid model.

### 2.11 Home equity and business ownership
**Ask:** *"Do your parents own their home?"* and *"Do they own a business or farm?"*

**FAFSA ignores home equity. CSS Profile counts it.** This is exactly the case where a family self-rejects from a school that would have been affordable, or the reverse. Your product's central promise is getting this number right.

### 2.12 Siblings in college
**Ask:** *"How many siblings will be in college at the same time as you?"*

FAFSA removed the sibling discount in 2024–25, but **CSS Profile schools still count it** — so it still matters at precisely the expensive private schools where your aid estimate carries the most weight.

### 2.13 State grant eligibility
You already collect state of residence, so this is free: Cal Grant, Excelsior, TAP, HOPE, Bright Futures are large and state-specific. No new question needed — just wire the state you already have into the aid model.

---

## TIER 4 — Deliberately NOT recommending

- **Race / ethnicity.** Post-*SFFA* (2023), colleges can't consider race directly. Asking would make your funnel look like it's modelling something illegal, and you couldn't use it honestly anyway. Skip.
- **Demonstrated interest.** Real but small, and students can't self-assess it.
- **Recommendation letter strength.** Pure noise when self-reported.
- **Weighted GPA.** You've deliberately excluded it, and I'd keep it that way — unweighted is the only comparable scale.
- **Supplemental essays.** Matters at selective schools, but 8 more textareas would destroy completion. Better as a post-purchase upsell.

---

# PART 3 — THE FRICTION PROBLEM

Everything above adds questions to a funnel that already has 7 steps **in front of a hard paywall**. Every field is a drop-off point, and drop-off before payment costs you revenue directly.

**The structural fix: split the funnel around the purchase.**

| | Questions | Why here |
|---|---|---|
| **Before payment** | What's needed for a credible estimate | Keep it short. Add only Tier 1: round, citizenship, first-gen, athlete, score intent — **5 questions, mostly one-tap** |
| **After payment** | Everything that sharpens it | They've paid, they're invested, and they'll answer 20 more questions to improve a report they already own |

Post-purchase questions have a second benefit: *"Answer 6 more questions to sharpen your estimate"* turns your report from a static PDF into something they come back to — which is what makes the second purchase possible.

**If you only add five things, add these:**

1. **Application round per school** — biggest single accuracy gain
2. **Citizenship** — currently breaks both models for a whole class of user
3. **APs offered at your school** — makes rigor fair
4. **Parents married / divorced** — biggest error source in aid
5. **Recruited athlete** — cheap insurance against being loudly wrong

