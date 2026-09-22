/**
 * POST /api/honors  { honors: [{title, grades, levels}] }
 *   -> { ok, overall, items: [{name, tier, score, note}], verdict, rubric }
 *
 * AdmitMap's honors rubric (set by the owner 2026-09-22). Admissions officers tier
 * awards by scale of recognition, selectivity and impact:
 *   Tier 1 — national & international (IMO, ISEF finalist, National Merit Finalist,
 *            research publications): highest impact
 *   Tier 2 — state & regional (state science fair, all-state band, regional debate,
 *            AP Scholar with Distinction): moderate to high
 *   Tier 3 — school-level (Honor Roll, NHS, Student of the Month): low — a restatement
 *            of the transcript
 * Quality over quantity: the best honor carries the score, the rest add a little.
 * The model assigns the tier and the selectivity within it; the score bands per tier
 * and the roll-up are enforced here, so the same judgements give the same numbers.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cors, bad, allowScoring, anthropicKey, safeDetail } from './_lib.js';

// Opus с размышлением отвечает 20–60 с — дефолтного лимита функции не хватает.
export const config = { maxDuration: 120 };

const client = new Anthropic({ apiKey: anthropicKey() }); // ключ очищен от пробелов и переносов

/* Диапазон балла (0–10) внутри каждого уровня: награда школы не может обогнать
   награду штата, какой бы громкой ни была формулировка. */
const BANDS = { 1: [7.0, 10.0], 2: [4.0, 7.5], 3: [0.5, 4.0] };
const TIER_LABEL = { 1: 'National & international', 2: 'State & regional', 3: 'School-level' };

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per submitted honor, in the same order they were given.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The honor as a reader would name it, 2-6 words, e.g. "National Merit Finalist", "ISEF Finalist", "All-State Orchestra". No trailing period.' },
          tier: { type: 'integer', description: 'Exactly 1, 2 or 3: 1 = national/international, 2 = state/regional, 3 = school-level. Judge from what the honor actually is, not only from the level the student ticked.' },
          selectivity: { type: 'number', description: 'Where this honor sits inside its tier, 0-10, one decimal: how selective and externally validated it is.' },
          note: { type: 'string', description: 'One short clause on why it sits there — name the selectivity or the reason it is weak. No praise for its own sake.' }
        },
        required: ['title', 'tier', 'selectivity', 'note'],
        additionalProperties: false
      }
    },
    verdict: { type: 'string', description: 'One sentence on what these honors say about the student to a selective admissions reader.' }
  },
  required: ['items', 'verdict'],
  additionalProperties: false
};

const SYSTEM = `You are an experienced admissions reader evaluating a student's honors and awards.

Honors are secondary academic credentials: they validate a talent and distinguish a student
in a competitive pool. Tier every honor by its scale of recognition, selectivity and impact:

- Tier 1 — national and international: highly selective, externally validated, hard to
  achieve. International Math Olympiad, ISEF finalist, National Merit Finalist, Regeneron
  STS scholar, a published research paper, national-level competition placements.
- Tier 2 — state and regional: solid evidence of ability beyond the student's own school.
  State science fair placements, all-state band or orchestra, regional debate, AP Scholar
  with Distinction, National Merit Commended or Semifinalist.
- Tier 3 — school-level: Honor Roll, National Honor Society, Student of the Month, departmental
  awards. Criteria vary from school to school, so readers treat these as a restatement of
  the transcript, not a differentiator.

Judge from what the honor actually is. The student ticks the recognition level themselves:
if a school-club certificate is marked "International", it is still tier 3. A vague title
with no scale ("Excellence Award") sits low in its tier; a title that states its selectivity
("Top 1% of 500 applicants", "1 of 40 national finalists") sits high.

Then give its selectivity inside that tier, 0-10. Quality matters far more than quantity:
never raise a score because the list is long. Having no major awards is not a flaw in
itself — many schools offer no competition platforms.

Every note must name something about that specific honor. This student is paying for the
truth, not encouragement.`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  if (!anthropicKey()) return bad(res, 503, 'Scoring is not configured.', { detail: 'ANTHROPIC_API_KEY is not set for this environment' });

  const gate = await allowScoring(req);
  if (!gate.ok) return bad(res, gate.status, gate.error);

  const { honors } = req.body || {};
  const list = Array.isArray(honors) ? honors.filter((h) => h && String(h.title || '').trim()) : [];
  if (!list.length) return bad(res, 400, 'Add at least one honor.');
  if (list.length > 5) return bad(res, 400, 'The Common App accepts up to 5 honors.');

  const rendered = list.map((h, i) => {
    const grades = Array.isArray(h.grades) ? h.grades.map(String).filter(Boolean).slice(0, 6) : [];
    const levels = Array.isArray(h.levels) ? h.levels.map(String).filter(Boolean).slice(0, 4) : [];
    return [
      `${i + 1}. ${String(h.title).trim().slice(0, 100)}`,
      levels.length ? `   Level ticked by the student: ${levels.join(', ')}` : null,
      grades.length ? `   Grades: ${grades.join(', ')}` : null
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  try {
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA }
      },
      messages: [{ role: 'user', content: `${list.length} honor${list.length === 1 ? '' : 's'}:\n\n${rendered}` }]
    });

    if (message.stop_reason === 'refusal') {
      return bad(res, 422, 'These honors could not be reviewed automatically. Please contact support.');
    }
    const block = message.content.find((b) => b.type === 'text');
    if (!block) return bad(res, 502, 'The scorer returned an empty response. Please try again.');
    const parsed = (() => {
      try { return JSON.parse(block.text); }
      catch (e) { throw new Error(`bad JSON (stop_reason ${message.stop_reason}): ${block.text.slice(0, 120)}`); }
    })();

    const items = list.map((h, i) => {
      const got = (parsed.items || [])[i] || {};
      const tier = [1, 2, 3].includes(Number(got.tier)) ? Number(got.tier) : 3;
      const [lo, hi] = BANDS[tier];
      // selectivity 0–10 раскладываем внутри полосы уровня
      const score10 = lo + (hi - lo) * clamp(got.selectivity, 0, 10) / 10;
      return {
        name: (typeof got.title === 'string' && got.title.trim() ? got.title.trim() : String(h.title)).slice(0, 60),
        tier,
        tierLabel: TIER_LABEL[tier],
        score: Math.round(score10 * 10),                 // /100
        note: typeof got.note === 'string' ? got.note.slice(0, 200) : ''
      };
    });

    // Качество важнее количества: итог — лучшая награда плюс небольшая прибавка
    // за остальные (10% от каждой, дальше вдвое меньше). Слабая награда никогда
    // не тянет итог вниз.
    const ranked = items.slice().sort((x, y) => y.score - x.score);
    const bonus = ranked.slice(1).reduce((s, it, i) => s + it.score * 0.10 * Math.pow(0.5, i), 0);
    const overall = Math.min(100, Math.round(ranked[0].score + bonus));

    res.status(200).json({
      ok: true,
      overall,
      items,
      verdict: parsed.verdict,
      rubric: [1, 2, 3].map((t) => ({ tier: t, label: TIER_LABEL[t], band: BANDS[t] }))
    });
  } catch (err) {
    if (err?.status === 429) return bad(res, 429, 'The scorer is busy right now. Try again in a moment.');
    console.error('honor scoring failed', safeDetail(err));
    return bad(res, 502, 'Scoring failed. Please try again.', { detail: safeDetail(err) });
  }
}
