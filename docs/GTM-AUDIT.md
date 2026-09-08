# AdmitMap — go-to-market audit
**Date:** 9 September 2026 · **Written by:** Claude (acting as SaaS marketing lead)
**Status:** pre-launch. Product deployed, payments not wired, zero customers.

---

## The clock

| | |
|---|---|
| **53 days** | to 1 November — Early Decision / Early Action deadlines |
| **114 days** | to 1 January — Regular Decision deadlines |

This is not a normal SaaS timeline. Your market has a **hard expiry date**. A student
who has already submitted has no reason to buy anything. Demand for this product does
not decay gently — it falls off a cliff twice, on 1 Nov and 1 Jan, and then is gone
until roughly August 2027.

Everything in this document should be read against that.

---

## 1. What is actually built

| Piece | State |
|---|---|
| Landing page | ✅ 7 sections, live design |
| Funnel | ✅ 7 steps, 18 fields, saves to browser |
| Loading screen | ✅ animated |
| Sign-up | ✅ Google / Apple / email UI |
| Onboarding | ✅ |
| Paywall | ✅ two tiers, $19 / $29 |
| Report | ✅ generated from the student's own profile |
| Odds model | ✅ shared by report and platform |
| School data | ✅ 1,717 searchable, 1,499 fully scored |
| Legal | ✅ terms, privacy, refunds, RU translations |
| **Payments** | ❌ **not wired — cannot take money** |
| Analytics | ❌ none installed |
| Activity scoring | ❌ does not exist |
| Essay grading | ⚠️ built, needs API key on Vercel |

**The build is roughly 85% done and 0% monetised.**

---

## 2. The four things that block revenue

### 2.1 You cannot charge anyone
`buy()` in `paywall.html` redirects straight to `report.html`. No provider, no
checkout, no license.

### 2.2 The paid product is free to anyone who guesses a URL
`report.html` has no gate. Typing `/report` returns the $29 deliverable. Once one
person posts that link on Reddit, the product is free for everyone.

**These two together mean: shipping more features changes nothing. This is the
only work that matters right now.**

### 2.3 No analytics anywhere
No GA, no Plausible, no PostHog, no Vercel Analytics — nothing, in any file.

You are about to send traffic to a 7-step funnel with **no idea where people leave**.
With 53 days on the clock, launching blind means you learn nothing from the first
cohort and cannot fix the funnel before the deadline passes.

This is a 20-minute install and it is the highest-ROI thing on this list after payments.

### 2.4 The report is unusable on a phone
The report is a **fixed 1080px artboard**. The viewport tag says `width=device-width`,
so on a 375px iPhone the browser scales the whole thing down ~2.9×. Body text set at
13px renders around 4–5px.

Your buyer is a 17-year-old. They will open this on a phone. They will pay $29, see
something they cannot read, and request a refund — against a policy that says all
sales are final. That is a chargeback, and chargebacks are how payment providers
close accounts.

---

## 3. Promises the product does not keep

The paywall sells specific features. Checked against what the report actually renders:

| Sold on the paywall | Reality |
|---|---|
| "Every ED, EA and RD deadline" | Deadlines exist for **41 of 1,717 schools — 2.4%** |
| "Average salary after graduation" | The word *salary* appears **0 times** in the report |
| "Comparison with admitted-student profiles" | Report compares to the school's overall admit rate, not admitted profiles |
| "Academic & extracurricular strength analysis" | The activities panel is **hidden** on personal reports — the model does not exist |

**Two of the four bullets on the $19 tier and one on the $29 tier describe things the
product does not do.** This is the single largest legal and refund exposure in the
business, larger than the invented statistics, because it is a paid promise rather
than a marketing claim.

Either build them, or remove them from the paywall before taking a single payment.

---

## 4. Funnel analysis

```
landing → funnel (7 steps, 18 fields) → loading → SIGN-UP → onboarding → paywall → report
```

### 4.1 The sign-up wall is in the wrong place
A student completes seven steps — GPA, test scores, ten activities, honours,
finances, school list, and pastes an entire essay — and **only then** is asked to
create an account, before seeing anything.

That is maximum effort for zero delivered value. Expect heavy drop-off precisely
among the people who invested the most.

**Recommendation:** show a real, partial result *before* the sign-up wall — two or
three schools with live odds, the rest blurred. Sign-up to unlock the rest. The
student has then seen proof the thing works, and the account has a reason to exist.

### 4.2 Seven steps is long for a first session
The essay step in particular — asking a teenager to paste a finished personal
statement before they trust you — is a large ask positioned late but not last.

Consider making the essay **optional and clearly marked as such**, or moving it to
after the first result. It is the highest-friction field in the funnel.

### 4.3 The price now appears before the funnel — good
Fixed 8 Sep. Previously the first mention of money came after seven steps. That was
the single worst conversion defect on the site.

---

## 5. Positioning

### 5.1 What is genuinely defensible
- **1,499 schools with federal admit-rate and net-price data.** Real, checkable, and
  a bigger dataset than most free calculators.
- **Cost alongside odds.** This is the actual differentiator. Every competitor tells
  a student their chances; almost none tell them what the school will cost their
  family. "Duke at $5,083/yr" is a more surprising, more shareable fact than "Duke 26%".
- **One-time price.** Against subscription incumbents, "$29 once, never a
  subscription" is a clean, honest wedge.

### 5.2 The positioning is currently buried
The hero says *"Improve your chances and get admitted."* That is what every competitor
says. The cost angle — your actual edge — appears only in a feature bullet.

**Recommendation:** lead with money. Something in the shape of *"See your real odds —
and what each school would actually cost your family."* The subheading already says
this; it belongs in the headline.

### 5.3 Claims that will not survive contact
- **"5,000+ profiles analyzed"** — you have zero users.
- **"4.9 / 148 early users"** — same.
- **"+1,712 more"** — now accurate. Keep it accurate.

You have decided to keep the first two. Noted, and it is your call. Two operational
consequences you should plan for rather than be surprised by:

1. **Merchant onboarding.** Polar, Lemon Squeezy and Paddle all manually review sites
   before releasing payouts. Unsubstantiated usage stats are a documented reason for
   holds. If they ask, swap the badge rather than argue — a hold at launch costs more
   than the badge is worth.
2. **The refund conversation.** "5,000+ analysed" plus a report that omits three
   advertised features is a bad combination in a dispute.

---

## 6. SEO and sharing — currently zero

| | |
|---|---|
| `meta description` | ❌ none, on any page |
| Open Graph tags | ❌ none |
| `robots.txt` | ❌ missing |
| `sitemap.xml` | ❌ missing |
| favicon | ❌ missing |
| `report.html` title | ❌ **"Bundled Page"** |

Two consequences worth understanding:

**Every shared link is dead on arrival.** Paste `admitmap.app` into iMessage,
Instagram DM, Discord or Reddit and it renders as a bare URL with no image, no title,
no description. For a product whose growth depends on teenagers sending it to each
other, this is the cheapest growth fix available and it is not done.

**The paid report says "Bundled Page" in the browser tab.** That is the artefact your
customer keeps. It should carry their name.

---

## 7. Channels — realistic assessment for 53 days

Ranked by what can plausibly work in the time available.

### Tier 1 — do these
**Reddit.** r/ApplyingToCollege is where this audience actually lives, and you already
have real acquaintances there whose quotes are on the site. **Read the rules before
posting** — that subreddit is aggressively hostile to undisclosed self-promotion, and
a ban is permanent. The workable pattern is participation first: answer chances
questions with genuinely useful analysis, and let the tool come up when relevant.

**A free public tool as the wedge.** Your net-price data is the most interesting thing
you own. A free "what will this school actually cost me" page, no sign-up, is
inherently shareable and pulls exactly the right traffic into the funnel.

### Tier 2 — worth trying
**TikTok / Instagram Reels.** Short clips of surprising outcomes: *"Harvard costs less
than your state school if your family earns under $85k."* That is a genuinely
counterintuitive, true fact from your own data. It is also the kind of thing that
travels.

**School counsellors.** High leverage per contact, slow to convert. Too slow to matter
before 1 Nov, but sets up 2027.

### Tier 3 — do not bother yet
Paid ads. With no analytics and no payment flow you cannot measure or capture
anything. Burning budget now teaches you nothing.

---

## 8. Pricing

Two tiers at $19 and $29 with a $10 gap. The $29 tier adds the financial-aid data —
which, per section 5.1, is your actual differentiator.

**Recommendation: consider dropping the $19 tier.**

Reasoning: it is a decision tax. Every student must now choose between two things they
do not yet understand, and the cheaper option strips out the exact feature that makes
you different from free competitors. A single $29 price is simpler to explain, simpler
to market, and sells the product you actually want people to have.

Also: **`pricing.html` is stale** — it still shows $9.99 / $39 / $149 from the
abandoned subscription model. It is not linked from the footer (which correctly points
at `paywall.html`), but it is publicly reachable. Delete it or rewrite it before
launch; contradictory pricing found by a customer is a trust problem.

---

## 9. Model credibility

The odds model is defensible but has one visible weakness: **it compresses at the top**.
Purdue 87%, Penn State 95% for a strong profile. Numbers above ~90% invite disbelief
even when they are directionally right, and a student who reads 95% and gets rejected
has a story they will tell publicly.

More importantly, the report shows the number without showing the reasoning. A student
seeing "NYU 41%" next to "9.2% admit rate" has no way to know whether to believe it.

**Recommendation:** ship the "Why this number?" explanation. `platform.html` already
has the panel built and empty. Showing the factors — academics, profile, essay,
in-state — converts your most suspicious number into your most trustworthy one, and
it is the cheapest credibility win available.

---

## 10. What I would do, in order

**This week — unblock revenue**
1. Push the five outstanding commits. Everything below is meaningless until the live
   site matches the local one.
2. Wire Polar or Lemon Squeezy. Gate `report.html` behind a license check.
3. Install analytics. Event on every funnel step, sign-up, paywall view, purchase.
4. Fix the report on mobile. Your buyer is on a phone.

**Next week — stop over-promising**
5. Remove or build the three unmet paywall promises: deadlines, salary, activity analysis.
6. Add OG tags, meta descriptions, favicon, and a real `<title>` on the report.
7. Delete or rewrite `pricing.html`.

**Then — earn trust**
8. Ship "Why this number?".
9. Move a partial result before the sign-up wall.
10. Calibrate the top end of the odds model.

**Then — traffic**
11. Free net-price tool as the public wedge.
12. Reddit participation, rules read first.
13. Short-form video on the counterintuitive cost facts.

---

## The one-sentence version

The product is 85% built and 0% monetised; **payments, a gate on the report, analytics,
and a mobile-readable deliverable are the only four things that matter in the next
53 days** — and three features currently advertised on the paywall do not exist and
should be removed before a single card is charged.
