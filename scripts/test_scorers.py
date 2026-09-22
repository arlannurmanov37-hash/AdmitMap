"""
Прогоняет эссе и активности через НАСТОЯЩИЙ оценщик AdmitMap — ту же инструкцию,
те же критерии и те же параметры модели, что в api/essay.js и api/activities.js.
Инструкцию и веса скрипт читает прямо из этих файлов, поэтому тестируется ровно
то, что будет работать на сайте.

Запуск (ключ — в переменной окружения, в чат его не вставлять):
    python3 -m venv /tmp/am-venv && /tmp/am-venv/bin/pip install -q anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    /tmp/am-venv/bin/python scripts/test_scorers.py            # эссе + активности
    /tmp/am-venv/bin/python scripts/test_scorers.py --essays   # только эссе
    /tmp/am-venv/bin/python scripts/test_scorers.py --runs 2   # каждое эссе дважды — проверка стабильности

Эссе — файлы .txt в scripts/essays/ (можно добавить своё). Цифра в начале имени
файла — ожидаемый уровень: 1 сильное … 5 слабое.
Стоимость: примерно $0.03–0.08 за одну оценку.
"""
import argparse, json, math, os, re, sys, time
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
MODEL = "claude-opus-5"

# Ожидаемый диапазон итога (0–10) по уровню файла. Якоря из инструкции оценщика:
# «обычное эссе — 5–6, сильное — 7.5–8.5, 9+ редкость».
EXPECTED = {"1": (7.3, 9.0), "2": (5.8, 7.3), "3": (4.0, 5.8), "4": (3.0, 5.0), "5": (1.5, 4.0)}


def js_template(src, name):
    m = re.search(r"const " + name + r" = `([\s\S]*?)`;", src)
    if not m:
        sys.exit(f"Не нашёл {name} в исходнике")
    return m.group(1)


def js_rubric(src):
    return [(k, float(w), label) for k, w, label in re.findall(r"\['(\w+)',\s*([\d.]+),\s*'([^']+)'\]", src)]


ESSAY_SRC = (ROOT / "api/essay.js").read_text()
ACTS_SRC = (ROOT / "api/activities.js").read_text()
ESSAY_SYSTEM, ESSAY_RUBRIC = js_template(ESSAY_SRC, "SYSTEM"), js_rubric(ESSAY_SRC)
ACTS_SYSTEM, ACTS_RUBRIC = js_template(ACTS_SRC, "SYSTEM"), js_rubric(ACTS_SRC)
ACTS_W = {k: w for k, w, _ in ACTS_RUBRIC}
ITEM_DIMS = [k for k, _, _ in ACTS_RUBRIC if k != "narrative"]   # narrative — по списку целиком

ESSAY_SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "object",
            "properties": {k: {"type": "number", "description": f"{k} score, 0-10, one decimal"} for k, _, _ in ESSAY_RUBRIC},
            "required": [k for k, _, _ in ESSAY_RUBRIC],
            "additionalProperties": False,
        },
        "verdict": {"type": "string", "description": "One sentence on where this essay stands overall."},
        "strengths": {"type": "array", "items": {"type": "string"},
                      "description": "Two specific things the essay does well, each quoting or naming a concrete moment from it."},
        "fixes": {"type": "array", "items": {"type": "string"},
                  "description": "Three specific, actionable revisions, ordered by how much they would improve the essay."},
    },
    "required": ["scores", "verdict", "strengths", "fixes"],
    "additionalProperties": False,
}

ACTS_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "description": "One entry per submitted activity, in the same order they were given.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": 'A 2-4 word label for this activity as a reader would name it, e.g. "Varsity Debate", "Robotics Captain", "Food Bank Volunteer". No trailing period.'},
                    "scores": {
                        "type": "object",
                        "properties": {k: {"type": "number", "description": f"{k} score for this activity, 0-10, one decimal"} for k in ITEM_DIMS},
                        "required": ITEM_DIMS,
                        "additionalProperties": False,
                    },
                    "note": {"type": "string", "description": "One short clause naming what carries or limits this activity. No praise for its own sake."},
                },
                "required": ["title", "scores", "note"],
                "additionalProperties": False,
            },
        },
        "narrative": {"type": "number", "description": "Personal narrative for the list as a whole, 0-10, one decimal: do the activities tie together into one believable picture of who this student is and what they care about?"},
        "verdict": {"type": "string", "description": "One sentence on what this list says about the student."},
        "fixes": {"type": "array", "items": {"type": "string"},
                  "description": "Two or three specific things that would strengthen the list, ordered by how much they would move it. Concrete, not generic."},
    },
    "required": ["items", "narrative", "verdict", "fixes"],
    "additionalProperties": False,
}

client = anthropic.Anthropic()


def call(system, schema, user):
    """Тот же запрос, что делает сайт: Opus 5, адаптивное размышление, effort high,
    строгая JSON-схема, fallbacks: default."""
    t = time.time()
    msg = client.beta.messages.create(
        model=MODEL,
        betas=["server-side-fallback-2026-07-01"],
        max_tokens=16000,
        system=system,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": user}],
        extra_body={
            "fallbacks": "default",
            "output_config": {"effort": "high", "format": {"type": "json_schema", "schema": schema}},
        },
    )
    if msg.stop_reason == "refusal":
        raise RuntimeError("refusal")
    text = next(b.text for b in msg.content if b.type == "text")
    return json.loads(text), time.time() - t, msg.model


# ── влияние на шансы: те же формулы, что в data/odds.js ──────────────────
def essay_mult(score10, rate):
    w = 0.30 + 0.70 * math.exp(-rate / 18)
    return max(0.55, min(1.50, 1 + (score10 - 5) * 0.10 * w))


def run_essays(runs):
    files = sorted((ROOT / "scripts/essays").glob("*.txt"))
    print(f"\n=== ЭССЕ ({len(files)} шт., по {runs} раз) ===")
    print("Шкала 0–10 (в отчёте ×10). Множитель к шансам: вуз с приёмом 5% / 25% / 60%.\n")
    for f in files:
        text = f.read_text().strip()
        words = len(text.split())
        overs = []
        for i in range(runs):
            try:
                r, sec, served = call(ESSAY_SYSTEM, ESSAY_SCHEMA,
                                      "Prompt: Common App personal statement\n\n---\n\n" + text)
            except Exception as e:
                print(f"  {f.name}: ОШИБКА — {e}")
                break
            s = {k: max(0, min(10, round(float(r["scores"][k]), 1))) for k, _, _ in ESSAY_RUBRIC}
            overall = round(sum(s[k] * w for k, w, _ in ESSAY_RUBRIC), 1)
            overs.append(overall)
            if i == 0:
                lo, hi = EXPECTED.get(f.name[0], (0, 10))
                flag = "OK " if lo <= overall <= hi else "!! "
                print(f"{flag}{f.name}  ({words} слов)  итог {overall}  → в отчёте {round(overall * 10)}/100   ожидали {lo}–{hi}   [{sec:.0f} с, {served}]")
                print("     " + "  ".join(f"{label.split(' ')[0]} {s[k]}" for k, _, label in ESSAY_RUBRIC))
                print(f"     шансы ×{essay_mult(overall, 5):.2f} / ×{essay_mult(overall, 25):.2f} / ×{essay_mult(overall, 60):.2f}")
                print(f"     «{r['verdict']}»")
        if len(overs) > 1:
            print(f"     повторы: {overs}  (разброс {max(overs) - min(overs):.1f})")
        print()


# Проверка здравого смысла: одинаковые или бо́льшие часы, но разное содержание.
# Основатель сообщества должен стоять заметно выше «просто волонтёра 4 года».
CALIBRATION = {"name": "Calibration", "activities": [
    {"type": "Community Service (Volunteer)", "desc": "Founded Silver Link: 45 teen volunteers call 120 isolated seniors weekly; now in 3 towns", "hrs": "5", "weeks": "40", "grades": ["10", "11", "12"]},
    {"type": "Community Service (Volunteer)", "desc": "Volunteer at local hospital", "hrs": "4", "weeks": "40", "grades": ["9", "10", "11", "12"]},
    {"type": "Debate/Speech", "desc": "Debate club member", "hrs": "10", "weeks": "35", "grades": ["9", "10", "11", "12"]},
    {"type": "Academic", "desc": "Started free SAT tutoring at my school, 60 students weekly, avg +90 points", "hrs": "3", "weeks": "30", "grades": ["12"]},
]}
EXPECTED_ORDER = "ожидаем: Silver Link и SAT tutoring высоко (7+), больничный волонтёр и Debate club member низко (3–5)"


def run_activities():
    html = (ROOT / "test-profiles.html").read_text()
    profiles = [{"p": CALIBRATION}] + json.loads(re.search(r"var PROFILES = (\[[\s\S]*?\]);\n", html).group(1))
    print("\n=== АКТИВНОСТИ (проверка здравого смысла + 10 тестовых профилей) ===")
    print("Spike 0–100 (сильнейшая активность весит больше всего). В модели: 50 = нейтрально, выше — плюс до ×1.85, ниже — минус в селективных вузах.\n")
    for pr in profiles:
        p = pr["p"]
        acts = [a for a in p.get("activities", []) if (a.get("desc") or "").strip()]
        lines = []
        for i, a in enumerate(acts):
            hrs, wks, yrs = a.get("hrs") or 0, a.get("weeks") or 0, len(a.get("grades") or []) or 1
            load = f"{hrs} h/week over {wks} weeks" if hrs and wks else "time commitment not given"
            gr = ", ".join(a.get("grades") or [])
            lines.append(f"{i + 1}. {a.get('type') or 'Untitled'}\n   {a['desc']}\n   {load}, {yrs} year{'' if yrs == 1 else 's'}"
                         + (f"\n   Grades: {gr}" if gr else ""))
        try:
            r, sec, served = call(ACTS_SYSTEM, ACTS_SCHEMA, f"{len(acts)} activities:\n\n" + "\n\n".join(lines))
        except Exception as e:
            print(f"  {p['name']}: ОШИБКА — {e}")
            continue
        # те же расчёты, что в api/activities.js: баллы по весам, потом Spike (0.58^i)
        items = []
        for a, it in zip(acts, r["items"]):
            d = {k: max(0, min(10, round(float(it["scores"][k]), 1))) for k in ITEM_DIMS}
            items.append((round(sum(d[k] * ACTS_W[k] for k in ITEM_DIMS) / sum(ACTS_W[k] for k in ITEM_DIMS) * 10), it["title"], d, it["note"]))
        ranked = sorted(items, key=lambda x: -x[0])
        wts = [0.58 ** i for i in range(len(ranked))]
        spike = lambda f: sum(f(x) * w for x, w in zip(ranked, wts)) / sum(wts)
        subs = {k: round(spike(lambda x, k=k: x[2][k] * 10)) for k in ITEM_DIMS}
        subs["narrative"] = round(max(0, min(10, float(r["narrative"]))) * 10)
        overall = round(sum(subs[k] * ACTS_W[k] for k in ACTS_W))
        mult = 1 + (overall - 50) / 50 * 0.85 if overall > 50 else 1
        print(f"{p['name']:<20} {len(acts):>2} активн.  Spike {overall}/100   "
              + "  ".join(f"{k} {subs[k]}" for k, _, _ in ACTS_RUBRIC)
              + f"   профиль ×{mult:.2f}   [{sec:.0f} с]")
        for sc, title, d, note in items:
            print(f"     {sc:>3}  {title:<26} " + " ".join(f"{k[:4]}{round(d[k]*10):>3}" for k in ITEM_DIMS) + f"  — {note}")
        if p is CALIBRATION:
            print(f"     {EXPECTED_ORDER}")
        print(f"     «{r['verdict']}»\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--essays", action="store_true", help="только эссе")
    ap.add_argument("--activities", action="store_true", help="только активности")
    ap.add_argument("--runs", type=int, default=1, help="сколько раз оценить каждое эссе")
    a = ap.parse_args()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Нет ANTHROPIC_API_KEY. В терминале: export ANTHROPIC_API_KEY=sk-ant-...")
    if not a.activities:
        run_essays(max(1, a.runs))
    if not a.essays:
        run_activities()
