/**
 * POST /api/essay  { key, essay, prompt?, school? }  ->  { ok, scores, feedback }
 *
 * Grades a personal statement or supplemental with Claude against AdmitMap's
 * six-dimension rubric. Structured outputs guarantee the response parses, so the
 * UI never has to guess at free text.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cors, bad, validateLicense } from './_lib.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

/* Рубрика AdmitMap. Веса заданы заказчиком и складываются в 100%.
   Итоговый балл — взвешенное среднее, считается здесь, а не моделью:
   так он воспроизводим и не зависит от арифметики в ответе. */
const RUBRIC = [
  ['authenticity', 0.200, 'Authenticity & Voice'],
  ['reflection',   0.200, 'Reflection & Insight'],
  ['character',    0.175, 'Personal Impact & Character'],
  ['specificity',  0.150, 'Specificity & Detail'],
  ['storytelling', 0.150, 'Storytelling & Narrative'],
  ['writing',      0.125, 'Writing Quality']
];
const DIMENSIONS = RUBRIC.map(([k]) => k);

const SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: Object.fromEntries(
        DIMENSIONS.map((d) => [d, { type: 'number', description: `${d} score, 0-10, one decimal` }])
      ),
      required: DIMENSIONS,
      additionalProperties: false,
    },
    verdict: { type: 'string', description: 'One sentence on where this essay stands overall.' },
    strengths: {
      type: 'array', items: { type: 'string' },
      description: 'Two specific things the essay does well, each quoting or naming a concrete moment from it.',
    },
    fixes: {
      type: 'array', items: { type: 'string' },
      description: 'Three specific, actionable revisions, ordered by how much they would improve the essay.',
    },
  },
  required: ['scores', 'verdict', 'strengths', 'fixes'],
  additionalProperties: false,
};

const SYSTEM = `You are an experienced admissions reader evaluating a college application essay.

Score each dimension 0-10 (one decimal). Anchor to a realistic admitted-student distribution:
a competent, unremarkable essay is a 5-6; a genuinely strong one is 7.5-8.5; 9+ is rare.
Do not inflate. Do not give every dimension the same score.

Dimensions:
- authenticity: does it sound genuinely like this student? Is the voice natural, distinctive and believable, rather than performed or borrowed?
- reflection: does the writer go past describing an experience to what they learned, realised, questioned, or how they changed?
- character: does the reader actually learn something about this person — their values, perspective, personality?
- specificity: concrete scenes, details and observations, rather than generic claims and clichés
- storytelling: is there a central thread that progresses naturally, with an opening that pulls and an ending that lands?
- writing: grammar, sentence construction, clarity, word choice, flow, concision, overall readability

Every strength and fix must point at something actually in the essay — quote a phrase or
name the specific paragraph. Never give generic advice that could apply to any essay.
Be direct and useful, not encouraging for its own sake. This student is paying for the truth.`;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const { key, essay, prompt, school } = req.body || {};

  const lic = await validateLicense(key);
  if (!lic.ok) return bad(res, 402, lic.error);

  const text = typeof essay === 'string' ? essay.trim() : '';
  if (text.length < 200) return bad(res, 400, 'Paste a longer draft — at least a few paragraphs.');
  if (text.length > 20000) return bad(res, 400, 'That essay is longer than any application allows.');

  const context = [
    school ? `School: ${school}` : null,
    prompt ? `Prompt: ${prompt}` : 'Prompt: Common App personal statement',
  ].filter(Boolean).join('\n');

  try {
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content: `${context}\n\n---\n\n${text}` }],
    });

    if (message.stop_reason === 'refusal') {
      return bad(res, 422, 'This draft could not be reviewed automatically. Please contact support.');
    }

    const block = message.content.find((b) => b.type === 'text');
    if (!block) return bad(res, 502, 'The grader returned an empty response. Please try again.');

    const parsed = JSON.parse(block.text);
    // Clamp defensively — the UI renders these directly.
    for (const d of DIMENSIONS) {
      const v = Number(parsed.scores[d]);
      parsed.scores[d] = Math.max(0, Math.min(10, Math.round(v * 10) / 10));
    }

    // Взвешенный итог считаем сами: модель к арифметике не привлекается.
    const overall = RUBRIC.reduce((sum, [k, w]) => sum + parsed.scores[k] * w, 0);

    res.status(200).json({
      ok: true,
      ...parsed,
      overall: Math.round(overall * 10) / 10,
      rubric: RUBRIC.map(([key, weight, label]) => ({ key, weight, label }))
    });
  } catch (err) {
    if (err?.status === 429) return bad(res, 429, 'The grader is busy right now. Try again in a moment.');
    console.error('essay grading failed', err?.status, err?.message);
    return bad(res, 502, 'Grading failed. Please try again.');
  }
}
