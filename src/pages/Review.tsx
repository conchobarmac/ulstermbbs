import { useEffect, useMemo, useState } from 'react';
import type { Db } from '../lib/db';
import type { Objective, Question, QuestionState } from '../lib/types';
import { isDue } from '../lib/schedule';
import { go } from '../lib/router';
import { Study } from '../components/Study';

const WHEN = [
  { dueOnly: true, label: 'Only due', hint: 'Questions whose review date has arrived' },
  { dueOnly: false, label: 'Everything', hint: 'Every learned question, whether due or not' },
];

// Cumulative grade ranges: Blank only → Blank + Partial → … → all grades.
const RANGES = [
  { max: 0, label: 'Blank', dots: [0] },
  { max: 1, label: 'Blank + Partial', dots: [0, 1] },
  { max: 2, label: 'Blank to Mostly', dots: [0, 1, 2] },
  { max: 3, label: 'All grades', dots: [0, 1, 2, 3] },
];

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function Review({ db, params }: { db: Db; params: URLSearchParams }) {
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const [summary, setSummary] = useState<QuestionState[] | null>(null);
  // URL: scope=due|all (legacy "weak" = everything, Blank + Partial); grades=0..3 (highest grade included)
  const scopeParam = params.get('scope');
  const [dueOnly, setDueOnly] = useState(scopeParam !== 'all' && scopeParam !== 'weak');
  const [maxGrade, setMaxGrade] = useState(() => {
    const g = Number(params.get('grades'));
    if (params.get('grades') !== null && Number.isInteger(g) && g >= 0 && g <= 3) return g;
    return scopeParam === 'weak' ? 1 : 3;
  });
  const [week, setWeek] = useState<number | undefined>(num('week'));
  const [section, setSection] = useState<number | undefined>(num('section'));
  const [lob, setLob] = useState<number | undefined>(num('section') === undefined ? num('lob') : undefined);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [shuffled, setShuffled] = useState(false);
  const [session, setSession] = useState<Question[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.summary().then(setSummary).catch((e) => setError((e as Error).message));
    db.objectives().then(setObjectives).catch(() => setObjectives([]));
  }, [db]);

  const weeks = useMemo(() => {
    const m = new Map<number, string>();
    summary?.forEach((r) => {
      const label = [r.case_title, r.topic].filter(Boolean).join(' · ');
      if (!m.has(r.week) || (!m.get(r.week) && label)) m.set(r.week, label);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [summary]);

  const sections = useMemo(() => {
    const m = new Map<number, string>();
    summary?.filter((r) => r.week === week).forEach((r) => {
      if (!m.has(r.section) || (!m.get(r.section) && r.section_title)) m.set(r.section, r.section_title);
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [summary, week]);

  // The week's objectives: those with wording, plus any number a question is tagged with.
  const lobs = useMemo(() => {
    const m = new Map<number, string>(objectives.filter((o) => o.week === week).map((o) => [o.num, o.title]));
    summary?.filter((r) => r.week === week).forEach((r) => r.lobs?.forEach((n) => { if (!m.has(n)) m.set(n, ''); }));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [objectives, summary, week]);

  const count = useMemo(() => {
    if (!summary) return 0;
    const now = new Date();
    return summary.filter(
      (r) =>
        r.learned_at &&
        (week === undefined || r.week === week) &&
        (section === undefined || r.section === section) &&
        (lob === undefined || (r.lobs ?? []).includes(lob)) &&
        (!dueOnly || isDue(r.due_at, now)) &&
        r.last_grade !== null &&
        r.last_grade <= maxGrade,
    ).length;
  }, [summary, dueOnly, maxGrade, week, section, lob]);

  async function start() {
    setLoading(true);
    setError('');
    try {
      const qs = await db.reviewQuestions({ dueOnly, maxGrade, week, section, lob });
      setSession(shuffled ? shuffle(qs) : qs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Started from a section's Review button on the home screen: go straight in.
  const autoStart = params.get('start') === '1';
  useEffect(() => {
    if (autoStart && summary && !session && !loading) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, summary]);

  if (session) {
    const where =
      week === undefined ? 'All weeks' : `Week ${week}${section !== undefined ? ` · Section ${section}` : lob !== undefined ? ` · LOB ${lob}` : ''}`;
    const label = `${dueOnly ? 'Due' : 'Everything'}${maxGrade < 3 ? ` · ${RANGES[maxGrade].label}` : ''}`;
    return <Study db={db} mode="review" title={`Review · ${label} · ${where}`} questions={session} onExit={() => go('/')} />;
  }

  if (error) return <p className="error">{error}</p>;
  if (!summary || (autoStart && loading)) return <p className="muted">Loading…</p>;

  return (
    <div className="card review-setup">
      <h2>Review</h2>
      <p className="muted">Only questions you've already been through in Learn mode appear here. Questions you haven't learned are never mixed in.</p>

      <fieldset>
        <legend>Which questions</legend>
        <div className="segmented">
          {WHEN.map((w) => (
            <label key={w.label} className={dueOnly === w.dueOnly ? 'on' : ''} title={w.hint}>
              <input type="radio" name="when" checked={dueOnly === w.dueOnly} onChange={() => setDueOnly(w.dueOnly)} />
              {w.label}
            </label>
          ))}
        </div>
        <p className="muted small">{WHEN.find((w) => w.dueOnly === dueOnly)!.hint}.</p>
      </fieldset>

      <fieldset>
        <legend>Last grade</legend>
        <div className="segmented grades-range">
          {RANGES.map((r) => (
            <label key={r.max} className={maxGrade === r.max ? 'on' : ''}>
              <input type="radio" name="grades" checked={maxGrade === r.max} onChange={() => setMaxGrade(r.max)} />
              <span className="gdots" aria-hidden="true">
                {r.dots.map((g) => <i key={g} className={`g${g}`} />)}
              </span>
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="row gap wrap">
        <label className="field">
          Week
          <select
            value={week ?? ''}
            onChange={(e) => {
              setWeek(e.target.value === '' ? undefined : Number(e.target.value));
              setSection(undefined);
              setLob(undefined);
            }}
          >
            <option value="">All weeks</option>
            {weeks.map(([w, t]) => (
              <option key={w} value={w}>
                Week {w}
                {t ? ` · ${t}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Section
          <select
            value={section ?? ''}
            disabled={week === undefined}
            onChange={(e) => {
              setSection(e.target.value === '' ? undefined : Number(e.target.value));
              setLob(undefined);
            }}
          >
            <option value="">All sections</option>
            {sections.map(([s, t]) => (
              <option key={s} value={s}>
                {s}. {t.replace(/^\d+\.\s*/, '').slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Learning objective
          <select
            value={lob ?? ''}
            disabled={week === undefined || !lobs.length}
            onChange={(e) => {
              setLob(e.target.value === '' ? undefined : Number(e.target.value));
              setSection(undefined);
            }}
          >
            <option value="">All objectives</option>
            {lobs.map(([n, t]) => (
              <option key={n} value={n}>
                LOB {n}{t ? `. ${t.slice(0, 70)}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={shuffled} onChange={(e) => setShuffled(e.target.checked)} />
        Shuffle (otherwise in the order of the notes)
      </label>

      <div className="row gap">
        <button className="primary" disabled={!count || loading} onClick={start}>
          {loading ? 'Loading…' : count ? `Start · ${count} question${count === 1 ? '' : 's'}` : 'Nothing to review'}
        </button>
        <button className="link" onClick={() => go('/')}>Cancel</button>
      </div>
    </div>
  );
}
