# ADMITMAP — Braindump MVP (Minimum Viable Product)

## Problem Statement: what is the painful problem I am solving?

A US high-school senior applying to college is making a **six-figure decision with almost
no information**. Specifically:

1. **They don't know their real odds.** They guess, or rely on a counselor with 300+ other
   students, or on Reddit threads. The result is unbalanced lists — all reaches, or all
   safeties — and avoidable rejection.
2. **They don't know what a college actually costs them.** They see the $90k sticker price
   and self-reject from schools that would have cost them $4,000. Nobody tells them that
   the "expensive" Ivy is often cheaper than their state flagship.
3. **They don't know what to fix.** Generic advice ("do more extracurriculars") instead of
   "your activities are diluting your profile — cut three, go deep on one."
4. **Private counselors cost $3,000–$10,000.** Priced out of reach for the students who
   need the guidance most.

**The promise:** know your real odds, know your real cost, and know exactly what to do next
— for the price of a pizza.

---

## Competitors

> **TODO — pull real numbers before using this section.** These are web products, not apps,
> so SensorTower won't cover them. Use **Similarweb** (traffic), **Crunchbase** (funding),
> and their own pricing pages. Do not estimate — a wrong number here misprices the product.

| Competitor | What it is | Traffic / Revenue | Pricing |
|---|---|---|---|
| **CollegeVine** | Free chancing engine + community | _pull from Similarweb_ | Free (B2B monetised) |
| **Naviance (PowerSchool)** | School-district platform, counselor-facing | _pull_ | Sold to districts, not students |
| **Scoir** | Modern Naviance competitor | _pull_ | Freemium + district contracts |
| **AdmitYogi** | Real admitted-student profiles | _pull_ | ~$30–60 one-time |
| **Crimson Education** | Full-service human counseling | _pull_ | $10k–50k packages |
| **AppySchool / Polygence / etc.** | Niche point tools | _pull_ | Varies |

**The gap AdmitMap fills:** CollegeVine is free but vague and monetises the student as the
product. Crimson is precise but $10k+. **Nothing sits in the middle at $10–39 with honest,
sourced data.**

---

## Marketing Potential

- **TikTok virality** — the affordability content is inherently shocking:
  *"Harvard costs a $60k family $2,000/year, not $90,000."* The product IS the hook.
- **Instagram Reels** — same content, second surface.
- **Reddit r/ApplyingToCollege** — 1M+ members, extremely high intent, hostile to ads but
  receptive to genuinely useful data.
- **SEO long-tail** — one page per school: *"What does Syracuse actually cost a $75k family?"*
  ~1,600 schools = ~1,600 pages of durable organic traffic.
- **Seasonality is brutal and must be respected** — demand spikes Aug–Nov (early deadlines)
  and Dec–Jan (regular). A launch outside that window wastes spend.
- **Paid creators** — budget $4,000. Performance CPM ($2–3) for volume, flat-fee niche
  admissions creators for trust. See launch plan.

---

## Features

**Built and working:**
- Acceptance probability per school, from the student's real profile (GPA, SAT/ACT, APs,
  activities, honors, essay)
- **"Why this number?"** breakdown — every chance decomposes into its contributing factors
- Financial aid modelling — net price by income band, per school
- Essay grader — 6-dimension rubric (Curiosity, Character, Voice, Detail, Contribution, Writing)
- Activity Scorer — 5-criteria rubric (Depth, Leadership, Impact, Time, Context)
- Milestone Roadmap — 7 stages, editable tasks, week-by-week
- College Search across 1,683 four-year US institutions
- Application rounds — verified ED / ED II / EA / REA / RD deadlines
- Profile gap analysis — where you fall short of admitted students

**Not built yet (be honest about this):**
- **Alex** — the AI counselor is a static guidance layer today, not a live LLM
- Real AI essay feedback (needs the Claude endpoint + backend)
- Accounts / cross-device sync (localStorage only)
- Payments (Lemon Squeezy + license key, not yet wired)

---

## Data — the actual moat, and the actual risk

This is what separates AdmitMap from a wrapper. It is also the thing most likely to sink it.

- **1,683** four-year US colleges (2-year/vocational deliberately excluded)
- **900** with verified admit rate / SAT / ACT from the US Dept. of Education College Scorecard
- **1,759** with financial-aid data (net price by income band, COA, Pell %, median debt)
- **20** hand-verified end-to-end from Common Data Sets — these override everything else

**Rules that must never be broken:**
1. Never display a number without a source. Unknown renders **"—"**, never a guess.
2. Never compute a chance for a school whose real stats we don't have.
3. Aid figures are labelled estimates, and always point to the school's own Net Price Calculator.

---

## Pages

### Landing Page
Marketing homepage. Hero with live example, feature grid, "the process" road animation,
comparison section, reviews, CTA. One job: get the student into the funnel.

### Funnel (7 steps)
Basics → Academics → Activities → Honors → Financial → Schools → Essay.
Direction-aware transitions, autosave, progress stepper. Ends with an analysis animation,
then hands off to pricing. **Persists the school list so the paywall can personalise.**

### Pricing / Paywall
Hard paywall — nothing is revealed before payment. Three tiers, money-back guarantee, FAQ.
Headline personalises to the student's own school count and counts down to Nov 1.

### Platform (the product)

**Dashboard** — welcome, application progress with completion bar, quick tiles, "You vs
Admitted" comparison, application timeline.

**My Application** — Profile, Grades, Testing & APs, Activities, Honors, Writing. All editable.

**My Colleges** — two-pane list + detail. Per school: odds, application rounds with deadlines,
contact links, social links, financial breakdown.

**College Search** — search/filter across all 1,683 schools, real stats on each card, add to list.

**My Chances** — grid of every school with probability, tier (Reach / Match / Safety), and the
**"Why this number?"** breakdown modal.

**Essay Grader** — paste a personal statement or supplemental, get scored on 6 dimensions with
targeted feedback. Pre-grade guidance fills the space before first use.

**Activity Scorer** — Spike Score gauge, per-activity breakdown across 5 criteria, and a report
on why each activity scores what it does and how to level it up.

**Milestone Roadmap** — 7 stages from "Find your spike" to Decision Day, editable tasks with
realistic time estimates and Alex commentary.

**Financial Aid** — income band selector, per-school net price, grants, debt, Pell.

**Ask Alex** — counselor chat (static today, LLM later).

---

## Onboarding Flow

1. Land on marketing page → **"Find out your chances"**
2. Complete the 7-step funnel (~5 minutes)
3. Analysis animation (builds anticipation, sets up the reveal)
4. **Paywall** — personalised to their school count + deadline countdown
5. Pay → license key unlocks the platform
6. Land on Dashboard with their profile already populated

---

## Business Model

| Tier | Price | What it is |
|---|---|---|
| **Snapshot Report** | $9.99 one-time | Chances for selected schools, aid fit, academic + EC analysis, comparison vs admitted averages, essay evaluation |
| **Pro** | $39 / month | Everything in Snapshot + unlimited tracking, deep AI essay feedback, week-by-week roadmap, activity portfolio builder, per-school aid modelling, priority support |
| **Admission Pass** | $149 / year | Everything in Pro + application tracker, list builder, scholarship hub, interview prep, timeline planner, final application review |

- **Payments:** Lemon Squeezy (Merchant of Record — Stripe doesn't support Kazakhstan)
- **Gating:** license key validated by one serverless function
- **Success bar:** $1,000 revenue within 60 days of launch

---

## Critical Path to Launch

1. **Fill the 150-school verified CSV** — the launch blocker (~50 hours, founder time)
2. **Serverless function** — license validation + Claude essay endpoint
3. **Wire Lemon Squeezy** checkout → license key → unlock
4. **Methodology page** — public explanation of how chances are calculated
5. **Start creator marketing** — begin before launch so the audience exists on day one

---

## Biggest Risks

1. **Data accuracy.** The entire pitch is "honest numbers." One wrong deadline or fabricated
   stat destroys the premise. Mitigated by: never display unsourced values.
2. **Hard paywall conversion.** Nothing is shown before payment — the pricing page carries the
   entire business. If conversion is under ~2%, the funnel needs surgery, not more traffic.
3. **Seasonality.** Miss Aug–Nov and you wait a year.
4. **Distribution from Kazakhstan to US teens.** No warm network. Paid creators are the plan;
   it is unproven.
5. **"Unlimited AI essays" cost exposure.** Capped by a hard monthly spend limit on the API key.
