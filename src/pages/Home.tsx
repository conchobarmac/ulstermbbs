import { useEffect, useMemo, useState } from 'react';
import type { Db } from '../lib/db';
import type { Objective, QuestionState } from '../lib/types';
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

interface ObjectiveStats {
  num: number;
  title: string;
  /** Sections (chapters) its questions are in. */
  sections: number[];
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
  objectives: ObjectiveStats[];
  /** True when the objectives aren't simply one per section (so a separate view is worth showing). */
  ownObjectives: boolean;
  total: number;
  learned: number;
  due: number;
  counts: number[];
}

const VIEW_KEY = 'recall-home-view';
function loadViews(): Record<number, 'sections' | 'objectives'> {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function summarise(rows: QuestionState[], objectives: Objective[]): WeekStats[] {
  const now = new Date();
  const weeks = new Map<number, WeekStats>();
  for (const r of rows) {
    let w = weeks.get(r.week);
    if (!w) {
      w = { week: r.week, title: r.case_title, topic: r.topic ?? '', sections: [], objectives: [], ownObjectives: false, total: 0, learned: 0, due: 0, counts: [0, 0, 0, 0] };
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
    const lobs = r.lobs ?? [];
    if (!(lobs.length === 1 && lobs[0] === r.section)) w.ownObjectives = true;
    const os = lobs.map((n) => {
      let o = w!.objectives.find((x) => x.num === n);
      if (!o) {
        o = { num: n, title: '', sections: [], total: 0, learned: 0, due: 0, counts: [0, 0, 0, 0] };
        w!.objectives.push(o);
      }
      if (!o.sections.includes(r.section)) o.sections.push(r.section);
      return o;
    });
    for (const t of [w, s, ...os]) {
      t.total++;
      if (r.learned_at) {
        t.learned++;
        if (r.last_grade !== null) t.counts[r.last_grade]++;
        if (isDue(r.due_at, now)) t.due++;
      }
    }
  }
  const out = [...weeks.values()].sort((a, b) => b.week - a.week);
  for (const w of out) {
    w.sections.sort((a, b) => a.section - b.section);
    for (const o of objectives.filter((x) => x.week === w.week)) {
      const found = w.objectives.find((x) => x.num === o.num);
      if (found) found.title = o.title;
      else w.objectives.push({ num: o.num, title: o.title, sections: [], total: 0, learned: 0, due: 0, counts: [0, 0, 0, 0] });
    }
    w.objectives.sort((a, b) => a.num - b.num);
    w.objectives.forEach((o) => o.sections.sort((a, b) => a - b));
  }
  return out;
}

export function Home({ db }: { db: Db }) {
  const [rows, setRows] = useState<QuestionState[] | null>(null);
  const [error, setError] = useState('');
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [views, setViews] = useState(loadViews);

  useEffect(() => {
    db.summary().then(setRows).catch((e) => setError((e as Error).message));
    db.objectives().then(setObjectives).catch(() => setObjectives([]));
  }, [db]);

  function setView(week: number, v: 'sections' | 'objectives') {
    const next = { ...views, [week]: v };
    setViews(next);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(next));
    } catch {
      /* not saved; fine */
    }
  }

  const weeks = useMemo(() => (rows ? summarise(rows, objectives) : []), [rows, objectives]);
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
      {db.missingObjectives && (
        <p className="notice">
          Database update needed for learning objectives: in Supabase, open SQL Editor and run <code>supabase/migrations/003_objectives.sql</code> from the repo. Everything else works in the meantime.
        </p>
      )}
      {flagged > 0 && (
        <p className="muted small">
          <a href={href('/data')}>{flagged} flagged question{flagged === 1 ? '' : 's'}</a> to check.
        </p>
      )}

      {weeks.map((w, wi) => {
        const isOpen = open[w.week] ?? wi === 0;
        const view = w.ownObjectives ? views[w.week] ?? 'sections' : 'sections';
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
            {isOpen && w.ownObjectives && (
              <div className="segmented view-toggle" role="tablist">
                {(['sections', 'objectives'] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(w.week, v)}>
                    {v === 'sections' ? 'By chapter' : 'By objective'}
                  </button>
                ))}
              </div>
            )}
            {isOpen && view === 'objectives' && (
              <ul className="sections objectives">
                {w.objectives.map((o) => (
                  <li key={o.num}>
                    <div className="sec-text">
                      <div className="sec-title">
                        <strong>LOB {o.num}.</strong> {o.title || <span className="muted">No wording imported</span>}
                      </div>
                      <div className="muted small">
                        {o.total === 0
                          ? 'No questions'
                          : `${o.learned === 0 ? `${o.total} questions` : o.learned === o.total ? `All ${o.total} learned` : `${o.learned}/${o.total} learned`}${o.due ? ` · ${o.due} due` : ''} · ${o.sections.length === 1 ? 'chapter' : 'chapters'} ${o.sections.join(', ')}`}
                      </div>
                      <GradeBar counts={o.counts} unlearned={o.total - o.learned} />
                    </div>
                    <div className="sec-actions">
                      {o.learned > 0 && (
                        <a className="button small" href={href(`/review?week=${w.week}&lob=${o.num}&scope=${o.due ? 'due' : 'all'}&start=1`)}>
                          Review{o.due ? ` ${o.due}` : ''}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {isOpen && view === 'sections' && (
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
