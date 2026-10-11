import { useEffect, useMemo, useState } from 'react';
import type { Db } from '../lib/db';
import type { Question, QuestionState, ReviewScope } from '../lib/types';
import { isDue } from '../lib/schedule';
import { go } from '../lib/router';
import { Study } from '../components/Study';

const SCOPES: { value: ReviewScope; label: string; hint: string }[] = [
  { value: 'due', label: 'Due', hint: 'Questions whose review date has arrived' },
  { value: 'weak', label: 'Weak', hint: 'Last graded Blank or Partial, due or not' },
  { value: 'all', label: 'Everything learned', hint: 'Every learned question in your selection' },
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
  const [scope, setScope] = useState<ReviewScope>((params.get('scope') as ReviewScope) || 'due');
  const [week, setWeek] = useState<number | undefined>(num('week'));
  const [section, setSection] = useState<number | undefined>(num('section'));
  const [shuffled, setShuffled] = useState(false);
  const [session, setSession] = useState<Question[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.summary().then(setSummary).catch((e) => setError((e as Error).message));
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

  const count = useMemo(() => {
    if (!summary) return 0;
    const now = new Date();
    return summary.filter(
      (r) =>
        r.learned_at &&
        (week === undefined || r.week === week) &&
        (section === undefined || r.section === section) &&
        (scope !== 'due' || isDue(r.due_at, now)) &&
        (scope !== 'weak' || (r.last_grade !== null && r.last_grade <= 1)),
    ).length;
  }, [summary, scope, week, section]);

  async function start() {
    setLoading(true);
    setError('');
    try {
      const qs = await db.reviewQuestions({ scope, week, section });
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
    const where = week === undefined ? 'All weeks' : `Week ${week}${section === undefined ? '' : ` · Section ${section}`}`;
    const label = SCOPES.find((s) => s.value === scope)!.label;
    return <Study db={db} mode="review" title={`Review · ${label} · ${where}`} questions={session} onExit={() => go('/')} />;
  }

  if (error) return <p className="error">{error}</p>;
  if (!summary || (autoStart && loading)) return <p className="muted">Loading…</p>;

  return (
    <div className="card review-setup">
      <h2>Review</h2>
      <p className="muted">Only questions you've already been through in Learn mode appear here. Questions you haven't learned are never mixed in.</p>

      <fieldset>
        <legend>What to review</legend>
        <div className="segmented">
          {SCOPES.map((s) => (
            <label key={s.value} className={scope === s.value ? 'on' : ''} title={s.hint}>
              <input type="radio" name="scope" checked={scope === s.value} onChange={() => setScope(s.value)} />
              {s.label}
            </label>
          ))}
        </div>
        <p className="muted small">{SCOPES.find((s) => s.value === scope)!.hint}.</p>
      </fieldset>

      <div className="row gap wrap">
        <label className="field">
          Week
          <select
            value={week ?? ''}
            onChange={(e) => {
              setWeek(e.target.value === '' ? undefined : Number(e.target.value));
              setSection(undefined);
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
            onChange={(e) => setSection(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">All sections</option>
            {sections.map(([s, t]) => (
              <option key={s} value={s}>
                {s}. {t.replace(/^\d+\.\s*/, '').slice(0, 60)}
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
