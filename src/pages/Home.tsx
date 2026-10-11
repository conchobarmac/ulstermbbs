import { useEffect, useMemo, useState } from 'react';
import type { Db } from '../lib/db';
import type { QuestionState } from '../lib/types';
import { isDue } from '../lib/schedule';
import { href } from '../lib/router';
import { GradeBar } from '../components/GradeBar';

interface SectionStats {
  section: number;
  title: string;
  total: number;
  learned: number;
  due: number;
  counts: number[];
}

interface WeekStats {
  week: number;
  title: string;
  topic: string;
  sections: SectionStats[];
  total: number;
  learned: number;
  due: number;
  counts: number[];
}

function summarise(rows: QuestionState[]): WeekStats[] {
  const now = new Date();
  const weeks = new Map<number, WeekStats>();
  for (const r of rows) {
    let w = weeks.get(r.week);
    if (!w) {
      w = { week: r.week, title: r.case_title, topic: r.topic ?? '', sections: [], total: 0, learned: 0, due: 0, counts: [0, 0, 0, 0] };
      weeks.set(r.week, w);
    }
    if (!w.title && r.case_title) w.title = r.case_title;
    if (!w.topic && r.topic) w.topic = r.topic;
    let s = w.sections.find((x) => x.section === r.section);
    if (!s) {
      s = { section: r.section, title: r.section_title, total: 0, learned: 0, due: 0, counts: [0, 0, 0, 0] };
      w.sections.push(s);
    }
    if (!s.title && r.section_title) s.title = r.section_title;
    for (const t of [w, s]) {
      t.total++;
      if (r.learned_at) {
        t.learned++;
        if (r.last_grade !== null) t.counts[r.last_grade]++;
        if (isDue(r.due_at, now)) t.due++;
      }
    }
  }
  const out = [...weeks.values()].sort((a, b) => b.week - a.week);
  out.forEach((w) => w.sections.sort((a, b) => a.section - b.section));
  return out;
}

export function Home({ db }: { db: Db }) {
  const [rows, setRows] = useState<QuestionState[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    db.summary().then(setRows).catch((e) => setError((e as Error).message));
  }, [db]);

  const weeks = useMemo(() => (rows ? summarise(rows) : []), [rows]);
  const totalDue = weeks.reduce((a, w) => a + w.due, 0);
  const flagged = rows?.filter((r) => r.flagged).length ?? 0;

  if (error) return <p className="error">Couldn't load your questions: {error}</p>;
  if (!rows) return <p className="muted">Loading…</p>;

  if (!rows.length) {
    return (
      <div className="card empty">
        <h2>No questions yet</h2>
        <p>Import your first week's CSV to get started.</p>
        <a className="button primary" href={href('/data')}>Import questions</a>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="card review-cta">
        <div>
          <h2>Review</h2>
          <p className="muted">
            {totalDue > 0 ? `${totalDue} question${totalDue === 1 ? '' : 's'} due across all weeks.` : 'Nothing due right now.'}
            {' '}Only questions you've already learned appear here.
          </p>
        </div>
        <a className={`button${totalDue ? ' primary' : ''}`} href={href('/review')}>
          {totalDue ? `Review ${totalDue} due` : 'Open review'}
        </a>
      </div>
      {db.missingTopic && (
        <p className="notice">
          Database update needed for week topics: in Supabase, open SQL Editor and run <code>supabase/migrations/002_add_topic.sql</code> from the repo. Everything else works in the meantime.
        </p>
      )}
      {flagged > 0 && (
        <p className="muted small">
          <a href={href('/data')}>{flagged} flagged question{flagged === 1 ? '' : 's'}</a> to check.
        </p>
      )}

      {weeks.map((w, wi) => {
        const isOpen = open[w.week] ?? wi === 0;
        return (
          <section key={w.week} className="card week">
            <button className="week-head" onClick={() => setOpen({ ...open, [w.week]: !isOpen })} aria-expanded={isOpen}>
              <div>
                <h2>
                  Week {w.week}
                  {w.title ? <span className="muted"> · {w.title}</span> : null}
                </h2>
                {w.topic && <p className="topic">{w.topic}</p>}
                <p className="muted small">
                  {w.learned}/{w.total} learned{w.due ? ` · ${w.due} due` : ''}
                </p>
              </div>
              <span className="chev">{isOpen ? '▾' : '▸'}</span>
            </button>
            <GradeBar counts={w.counts} unlearned={w.total - w.learned} />
            {isOpen && (
              <ul className="sections">
                {w.sections.map((s) => (
                  <li key={s.section}>
                    <div className="sec-text">
                      <div className="sec-title">
                        <strong>{s.section}.</strong> {s.title.replace(/^\d+\.\s*/, '') || `Section ${s.section}`}
                      </div>
                      <div className="muted small">
                        {s.learned === 0 ? `${s.total} questions` : s.learned === s.total ? `All ${s.total} learned` : `${s.learned}/${s.total} learned`}
                        {s.due ? ` · ${s.due} due` : ''}
                      </div>
                      <GradeBar counts={s.counts} unlearned={s.total - s.learned} />
                    </div>
                    <div className="sec-actions">
                      <a className={`button small${s.learned < s.total ? ' primary' : ''}`} href={href(`/learn/${w.week}/${s.section}`)}>
                        {s.learned === 0 ? 'Learn' : s.learned < s.total ? 'Continue' : 'Learn again'}
                      </a>
                      {s.learned > 0 && (
                        <a className="button small" href={href(`/review?week=${w.week}&section=${s.section}&scope=${s.due ? 'due' : 'all'}&start=1`)}>
                          Review{s.due ? ` ${s.due}` : ''}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
