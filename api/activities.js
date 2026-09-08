/**
 * POST /api/activities  { key, activities: [{name, type, desc, hours, weeks, years}] }
 *   -> { ok, overall, subs: {leadership, depth, impact}, items: [{name, score, note}], verdict, fixes }
 *
 * Scores the extracurricular list the way an admissions reader would: on what
 * the student actually wrote, not on how many rows they filled in. Structured
 * outputs guarantee the response parses.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cors, bad, validateLicense } from './_lib.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

/* Три оси из макета отчёта. Веса складываются в 100%.
   Итог считаем здесь, а не в модели: так он воспроизводим. */
const RUBRIC = [
  ['leadership', 0.35, 'Leadership'],
  ['depth',      0.40, 'Depth and commitment'],
  ['impact',     0.25, 'Impact']
];
const AXES = RUBRIC.map(([k]) => k);

const SCHEMA = {
  type: 'object',
  properties: {
    axes: {
      type: 'object',
      properties: Object.fromEntries(
        AXES.map((a) => [a, { type: 'number', description: `${a} score for the list as a whole, 0-10, one decimal` }])
      ),
      required: AXES,
      additionalProperties: false
    },
    items: {
      type: 'array',
      description: 'One entry per submitted activity, in the same order they were given.',
      items: {
        type: 'object',
        properties: {
          score: { type: 'number', description: 'This activity on its own, 0-10, one decimal' },
          note:  { type: 'string', description: 'One short clause naming what carries or limits it. No praise for its own sake.' }
        },
        required: ['score', 'note'],
        additionalProperties: false
      }
    },
    verdict: { type: 'string', description: 'One sentence on what this list says about the student.' },
    fixes: {
      type: 'array', items: { type: 'string' },
      description: 'Two or three specific things that would strengthen the list, ordered by how much they would move it. Concrete, not generic.'
    }
  },
  required: ['axes', 'items', 'verdict', 'fixes'],
  additionalProperties: false
};

const SYSTEM = `You are an experienced admissions reader evaluating a student's activity list.

Score 0-10 (one decimal). Anchor to a realistic admitted-student distribution at selective
universities: a normal list of school clubs is a 4-5; genuine sustained commitment with real
responsibility is 7-8; 9+ means state or national significance. Do not inflate. Do not give
every axis or every activity the same score.

Axes:
- leadership: did they hold real responsibility and make decisions others depended on, or
  simply hold a title? Founding, running, or rebuilding something counts far more than
  membership or an appointed position with no described duties.
- depth: sustained commitment over years and hours in a few things, rather than a wide
  scatter of shallow ones. Reward continuity and escalating responsibility. Ten light
  activities are worth less than three deep ones.
- impact: did anything actually change because of them? Look for people served, money
  raised, work published, competitions won, things built that outlived the student.
  Vague claims of "helping" score low.

Judge only what is written. An activity described as "Debate club member" is a 3, no matter
how many hours are attached to it. An activity described as "founded a tutoring program that
served 60 students weekly" is strong even at modest hours. Hours and years are context, not
the score itself.

Every note must point at something in that specific activity. Never write advice that would
apply to any student. This student is paying for the truth, not encouragement.`;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const { key, activities } = req.body || {};

  const lic = await validateLicense(key);
  if (!lic.ok) return bad(res, 402, lic.error);

  const list = Array.isArray(activities) ? activities.filter((a) => a && (a.desc || a.name)) : [];
  if (!list.length) return bad(res, 400, 'Add at least one activity with a description.');
  if (list.length > 15) return bad(res, 400, 'That is more activities than any application accepts.');

  const rendered = list.map((a, i) => {
    const hrs = Number(a.hours) || 0, wks = Number(a.weeks) || 0, yrs = Number(a.years) || 0;
    const load = (hrs && wks) ? `${hrs} h/week over ${wks} weeks` : 'time commitment not given';
    return [
      `${i + 1}. ${(a.name || a.type || 'Untitled').toString().slice(0, 120)}`,
      a.type && a.name ? `   Category: ${String(a.type).slice(0, 60)}` : null,
      `   ${String(a.desc || '').slice(0, 600) || '(no description given)'}`,
      `   ${load}${yrs ? `, ${yrs} year${yrs === 1 ? '' : 's'}` : ''}`
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  try {
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
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

    const parsed = JSON.parse(block.text);

    // Зажимаем: значения уходят прямо в интерфейс.
    for (const a of AXES) {
      const v = Number(parsed.axes[a]);
      parsed.axes[a] = Math.max(0, Math.min(10, Math.round(v * 10) / 10));
    }

    // Модель могла вернуть меньше или больше пунктов — выравниваем по входу.
    const items = list.map((a, i) => {
      const got = (parsed.items || [])[i] || {};
      const v = Math.max(0, Math.min(10, Number(got.score) || 0));
      return {
        name: (a.name || a.type || `Activity ${i + 1}`).toString().slice(0, 120),
        score: Math.round(v * 10),                    // в интерфейсе шкала /100
        note: typeof got.note === 'string' ? got.note.slice(0, 200) : ''
      };
    });

    const overall = RUBRIC.reduce((sum, [k, w]) => sum + parsed.axes[k] * w, 0);

    res.status(200).json({
      ok: true,
      overall: Math.round(overall * 10),              // /100
      subs: Object.fromEntries(AXES.map((a) => [a, Math.round(parsed.axes[a] * 10)])),
      items,
      verdict: parsed.verdict,
      fixes: parsed.fixes,
      rubric: RUBRIC.map(([key, weight, label]) => ({ key, weight, label }))
    });
  } catch (err) {
    if (err?.status === 429) return bad(res, 429, 'The scorer is busy right now. Try again in a moment.');
    console.error('activity scoring failed', err?.status, err?.message);
    return bad(res, 502, 'Scoring failed. Please try again.');
  }
}
