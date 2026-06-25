# AdmitMap — Claude Code Project Guide

## What is AdmitMap?
AdmitMap is a college admissions intelligence platform. Students fill out a multi-step onboarding funnel, then get a personalized dashboard showing their acceptance probabilities for each school, AI essay grading, activity scoring, a milestone roadmap, and financial aid matching.

## File Structure
| File | Purpose |
|------|---------|
| `landing.html` | Marketing landing page — the homepage users see first |
| `funnel.html` | 7-step onboarding funnel (Basics → Academics → Activities → Honors → Financial → Schools → Essay) |
| `platform.html` | Full dashboard platform shown after onboarding — the main product |
| `pricing.html` | Pricing / paywall page |
| `admitted.html` | Post-admission congratulations page |
| `admitmap.html` / `AdmitMap.html` | Alternate/legacy landing page versions |
| `index.html` | Site index / entry point |
| `onboarding.html` | Earlier version of the onboarding flow |
| `_preview.html`, `_pv_*.html` | Preview/prototype panel files |

## Tech Stack
- Pure HTML/CSS/JS — no frameworks, no build step
- Fonts: Fraunces (serif display) + Syne (sans-serif body) via Google Fonts
- All data is in-memory JS (no backend yet)

## Design System
- `--navy: #0f1f4b` — primary dark color
- `--royal: #2563eb` — primary blue / CTAs
- `--off: #f8fafc` — page background
- `--line: #e2e8f0` — borders
- `--ok: #10b981` — success green
- `--err: #ef4444` — error red
- `--warn: #f59e0b` — warning amber
- `--purple: #7c3aed` — AP / accent color
- Fonts: Fraunces for headings, Syne for everything else
- No emojis in UI — use clean text or SVG icons only
- `font-variant-numeric: lining-nums tabular-nums` on all elements

## Key Preferences
- No emojis anywhere in the UI — they make the product look unpopular
- No weighted GPA — only unweighted on 4.0 scale
- SAT is a single composite score (400–1600), not split into EBRW + Math
- AP courses must be selected from a dropdown (all official AP courses), not typed
- Majors must be selected from a categorized dropdown, not typed
- School logos: use Google Favicon API with initial-letter fallback on error
- Essay prompts: exact verbatim Common App 7 prompts, displayed as radio list (not dropdown)
- Honors section: mirrors Common App exactly (Yes/No → title + grade level checkboxes + recognition level checkboxes)

## Platform Panels (platform.html)
The platform has a sidebar with these sections:
- **My Application**: Profile, Grades, Testing, Activities, Honors, Writing
- **My Colleges**: Overview table + individual college detail pages
- **Explore**: College Search, My Chances, Essay Grader, Activity Scorer, Milestone Roadmap
- **Account**: Financial Aid

## School Database
- `platform.html` has a `SCHOOLS` array — currently ~41 schools with full stats (SAT, ACT, GPA, admit rate, deadlines, type, domain)
- `funnel.html` has a `universities` array — 600+ schools for the search field (name + domain only)
- Goal: expand platform SCHOOLS to cover all ~2000+ 4-year US institutions

## Current Work In Progress
- Expanding SCHOOLS database in platform.html
- Making Activities and Testing panels fully editable (not read-only)
- Fixing digit baseline rendering with `font-variant-numeric`
- Removing emojis from Activity Scorer panel
