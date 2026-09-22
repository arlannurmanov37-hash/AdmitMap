/**
 * POST /api/activities  { checkout_id, activities: [{type, desc, hours, weeks, years, grades}] }
 *   -> { ok, overall, subs: {depth, leadership, impact, progression, narrative},
 *        items: [{name, type, score, dims, note}], verdict, fixes, rubric }
 *
 * AdmitMap's activity rubric (set by the owner 2026-09-22): depth over breadth,
 * leadership & initiative, quantifiable impact and progression over time are
 * judged per activity; personal narrative is judged for the list as a whole.
 * The model only judges; weighting and the Spike roll-up happen here, so the
 * same judgements always give the same numbers.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cors, bad, allowScoring } from './_lib.js';

// Opus с размышлением отвечает 20–60 с — дефолтного лимита функции не хватает.
export const config = { maxDuration: 120 };

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

/* Рубрика AdmitMap, заданная владельцем 22.09.2026. В сумме 100%.
   Первые четыре — по каждой активности, narrative — по списку целиком. */
const RUBRIC = [
  ['depth',       0.25, 'Depth over breadth'],
  ['leadership',  0.25, 'Leadership & initiative'],
  ['impact',      0.25, 'Quantifiable impact'],
  ['progression', 0.15, 'Progression over time'],
  ['narrative',   0.10, 'Personal narrative']
];
const DIMS = ['depth', 'leadership', 'impact', 'progression'];      // по активности
const W = Object.fromEntries(RUBRIC.map(([k, w]) => [k, w]));
const W_ITEM = DIMS.reduce((s, d) => s + W[d], 0);                  // 0.90

/* Spike: сильнейшая активность весит больше всего, вторая и третья —
   поддерживают, «наполнитель» почти не двигает итог (вес 0.58^i, как в платформе). */
const SPIKE_DECAY = 0.58;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per submitted activity, in the same order they were given.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A 2-4 word label for this activity as a reader would name it, e.g. "Varsity Debate", "Robotics Captain", "Food Bank Volunteer". No trailing period.' },
          scores: {
            type: 'object',
            properties: Object.fromEntries(
              DIMS.map((d) => [d, { type: 'number', description: `${d} score for this activity, 0-10, one decimal` }])
            ),
            required: DIMS,
            additionalProperties: false
          },
          note: { type: 'string', description: 'One short clause naming what carries or limits this activity. No praise for its own sake.' }
        },
        required: ['title', 'scores', 'note'],
        additionalProperties: false
      }
    },
    narrative: { type: 'number', description: 'Personal narrative for the list as a whole, 0-10, one decimal: do the activities tie together into one believable picture of who this student is and what they care about?' },
    verdict: { type: 'string', description: 'One sentence on what this list says about the student.' },
    fixes: {
      type: 'array', items: { type: 'string' },
      description: 'Two or three specific things that would strengthen the list, ordered by how much they would move it. Concrete, not generic.'
    }
  },
  required: ['items', 'narrative', 'verdict', 'fixes'],
  additionalProperties: false
};

const SYSTEM = `You are an experienced admissions reader evaluating a student's activity list the
way admissions committees do: holistically, valuing depth, leadership and sustained commitment
over the number of clubs joined.

Score every activity on four criteria, each 0-10 (one decimal), then score the list as a whole
on personal narrative. Anchor to a realistic admitted-student distribution at selective
universities: ordinary club membership is a 3-5; genuine sustained commitment with real
responsibility is 7-8; 9+ means state or national significance. Do not inflate. Do not give
every criterion the same score.

Per activity:
- depth (depth over breadth): long-term dedication and real achievement in this one area.
  Two or three core commitments beat superficial participation in ten clubs.
- leadership (leadership & initiative): tangible proof the student made something happen —
  founding an organization, managing a project, taking charge of a community initiative.
  A title with no described duties is not leadership.
- impact (quantifiable impact): numbers that prove the contribution — money raised, hours
  dedicated, people helped, events organized, results won. Vague "helping" scores low.
- progression (progression over time): how involvement grew from 9th to 12th grade —
  increasing responsibility and maturity. Four identical years show commitment but no growth.

For the whole list:
- narrative (personal narrative): do the activities tie back to one believable picture of
  the student — their genuine values, personality and the impact they could have on a
  campus community? A focused, coherent list scores high; a scattered one scores low.

Hours, weeks and years are evidence for depth and progression, but they never rescue an
activity with no leadership or impact: "Volunteer at local hospital" for four years with no
described role or result is weak. "Founded a program where 45 teens call 120 isolated
seniors weekly" is strong even at modest hours. A part-time job or caring for family is as
valid as any club — never penalise a student for having less free time.

Judge only what is written. Every note must point at something in that specific activity.
Never write advice that would apply to any student. This student is paying for the truth,
not encouragement.`;

const clamp10 = (v) => Math.max(0, Math.min(10, Math.round((Number(v) || 0) * 10) / 10));

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const { activities } = req.body || {};

  const gate = await allowScoring(req);
  if (!gate.ok) return bad(res, gate.status, gate.error);

  const list = Array.isArray(activities) ? activities.filter((a) => a && (a.desc || a.name)) : [];
  if (!list.length) return bad(res, 400, 'Add at least one activity with a description.');
  if (list.length > 10) return bad(res, 400, 'The Common App accepts up to 10 activities.');

  const rendered = list.map((a, i) => {
    const hrs = Number(a.hours) || 0, wks = Number(a.weeks) || 0, yrs = Number(a.years) || 0;
    const load = (hrs && wks) ? `${hrs} h/week over ${wks} weeks` : 'time commitment not given';
    // классы участия — основа для progression (9 → 12)
    const grades = Array.isArray(a.grades) ? a.grades.map(String).filter(Boolean).slice(0, 6) : [];
    return [
      `${i + 1}. ${(a.name || a.type || 'Untitled').toString().slice(0, 120)}`,
      a.type && a.name ? `   Category: ${String(a.type).slice(0, 60)}` : null,
      `   ${String(a.desc || '').slice(0, 600) || '(no description given)'}`,
      `   ${load}${yrs ? `, ${yrs} year${yrs === 1 ? '' : 's'}` : ''}`,
      grades.length ? `   Grades: ${grades.join(', ')}` : null
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  try {
    // fallbacks: 'default' — если классификатор Opus 5 откажет, сервер Anthropic
    // сам повторит запрос на рекомендованной модели в том же вызове.
    const message = await client.beta.messages.create({
      model: 'claude-opus-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA }
      },
      messages: [{ role: 'user', content: `${list.length} activities:\n\n${rendered}` }]
    });

    if (message.stop_reason === 'refusal') {
      return bad(res, 422, 'This list could not be reviewed automatically. Please contact support.');
    }

    const block = message.content.find((b) => b.type === 'text');
    if (!block) return bad(res, 502, 'The scorer returned an empty response. Please try again.');

    const parsed = (() => {
      try { return JSON.parse(block.text); }
      catch (e) { throw new Error(`bad JSON (stop_reason ${message.stop_reason}): ${block.text.slice(0, 120)}`); }
    })();

    // Модель могла вернуть меньше или больше пунктов — выравниваем по входу.
    const items = list.map((a, i) => {
      const got = (parsed.items || [])[i] || {};
      const dims = Object.fromEntries(DIMS.map((d) => [d, clamp10(got.scores && got.scores[d])]));
      const score10 = DIMS.reduce((s, d) => s + dims[d] * W[d], 0) / W_ITEM;
      return {
        name: (typeof got.title === 'string' && got.title.trim() ? got.title.trim()
               : (a.name || a.type || `Activity ${i + 1}`)).toString().slice(0, 60),
        type: (a.type || '').toString().slice(0, 60),     // отчёт ставит иконку по типу
        score: Math.round(score10 * 10),                   // в интерфейсе шкала /100
        dims: Object.fromEntries(DIMS.map((d) => [d, Math.round(dims[d] * 10)])),
        note: typeof got.note === 'string' ? got.note.slice(0, 200) : ''
      };
    });

    // Spike: сортируем по баллу, сильнейшая активность — вес 1, дальше 0.58, 0.34…
    const ranked = items.slice().sort((x, y) => y.score - x.score);
    const w = ranked.map((_, i) => Math.pow(SPIKE_DECAY, i));
    const wsum = w.reduce((s, x) => s + x, 0);
    const spike = (f) => ranked.reduce((s, it, i) => s + f(it) * w[i], 0) / wsum;

    const subs = Object.fromEntries(DIMS.map((d) => [d, Math.round(spike((it) => it.dims[d]))]));
    subs.narrative = Math.round(clamp10(parsed.narrative) * 10);
    // итог = Spike по четырём критериям активностей (90%) + narrative списка (10%)
    const overall = DIMS.reduce((s, d) => s + subs[d] * W[d], 0) + subs.narrative * W.narrative;

    res.status(200).json({
      ok: true,
      overall: Math.round(overall),                                         // /100
      subs,
      items,
      verdict: parsed.verdict,
      fixes: parsed.fixes,
      rubric: RUBRIC.map(([key, weight, label]) => ({ key, weight, label }))
    });
  } catch (err) {
    if (err?.status === 429) return bad(res, 429, 'The scorer is busy right now. Try again in a moment.');
    console.error('activity scoring failed', err?.status, err?.message);
    return bad(res, 502, 'Scoring failed. Please try again.', { detail: `${err?.status || ''} ${String(err?.message || err).slice(0, 300)}`.trim() });
  }
}
