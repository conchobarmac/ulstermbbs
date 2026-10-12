import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Db } from '../lib/db';
import type { Mode, Objective, Question } from '../lib/types';
import { GRADES, describeDue, dueDate, nextInterval } from '../lib/schedule';
import { RichText } from './RichText';
import { GradeBar } from './GradeBar';

interface Props {
  db: Db;
  mode: Mode;
  title: string;
  questions: Question[];
  startIndex?: number;
  notice?: ReactNode;
  onExit: () => void;
}

export function Study({ db, mode, title, questions, startIndex = 0, notice, onExit }: Props) {
  const [list, setList] = useState<Question[]>(questions);
  const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, questions.length - 1)));
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');
  const [finished, setFinished] = useState(questions.length === 0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [showLobs, setShowLobs] = useState(false);

  useEffect(() => {
    db.objectives().then(setObjectives).catch(() => setObjectives([]));
  }, [db]);
  const objectiveTitle = useMemo(() => new Map(objectives.map((o) => [`${o.week}|${o.num}`, o.title])), [objectives]);
  // The interval each question had when this session started, so re-grading after "Back" doesn't compound.
  const startIntervals = useRef(new Map(questions.map((q) => [q.id, q.interval_days])));
  // Questions already learned before the starting point (e.g. resuming a section at question 43).
  // They count towards progress, so the bar doesn't reset to zero when you come back to a section.
  const doneBefore = useRef(new Set(questions.slice(0, startIndex).filter((q) => q.learned_at).map((q) => q.id)));

  const q = list[idx];
  const sessionGrade = q ? graded[q.id] : undefined;

  const move = useCallback(
    (to: number) => {
      setError('');
      setEditing(false);
      if (to >= list.length) {
        setFinished(true);
        return;
      }
      const target = Math.max(0, to);
      setIdx(target);
      // Show the answer straight away when going back to one you've already graded.
      setRevealed(graded[list[target].id] !== undefined);
    },
    [list, graded],
  );

  const grade = useCallback(
    async (g: number) => {
      if (!q || busy || !revealed) return;
      setBusy(true);
      setError('');
      const interval = nextInterval(g, startIntervals.current.get(q.id) ?? q.interval_days);
      const due = dueDate(interval);
      try {
        await db.recordGrade(q.id, g, mode, interval, due);
        const now = new Date().toISOString();
        setList((l) =>
          l.map((x) =>
            x.id === q.id
              ? { ...x, last_grade: g, interval_days: interval, due_at: due.toISOString(), learned_at: x.learned_at ?? now, times_seen: x.times_seen + 1 }
              : x,
          ),
        );
        const nextGraded = { ...graded, [q.id]: g };
        setGraded(nextGraded);
        setEditing(false);
        if (idx + 1 >= list.length) setFinished(true);
        else {
          setIdx(idx + 1);
          setRevealed(nextGraded[list[idx + 1].id] !== undefined);
        }
      } catch (e) {
        setError(`Couldn't save that grade: ${(e as Error).message}. Try again.`);
      } finally {
        setBusy(false);
      }
    },
    [q, busy, revealed, db, mode, graded, idx, list],
  );

  const toggleFlag = useCallback(async () => {
    if (!q) return;
    const flagged = !q.flagged;
    setList((l) => l.map((x) => (x.id === q.id ? { ...x, flagged } : x)));
    try {
      await db.updateQuestion(q.id, { flagged });
    } catch (e) {
      setError(`Couldn't save the flag: ${(e as Error).message}`);
      setList((l) => l.map((x) => (x.id === q.id ? { ...x, flagged: !flagged } : x)));
    }
  }, [q, db]);

  const startEdit = useCallback(() => {
    if (!q) return;
    setDraftQ(q.question);
    setDraftA(q.answer);
    setEditing(true);
    setRevealed(true);
  }, [q]);

  async function saveEdit() {
    if (!q) return;
    setBusy(true);
    try {
      await db.updateQuestion(q.id, { question: draftQ.trim(), answer: draftA.trim() });
      setList((l) => l.map((x) => (x.id === q.id ? { ...x, question: draftQ.trim(), answer: draftA.trim() } : x)));
      setEditing(false);
    } catch (e) {
      setError(`Couldn't save the edit: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (finished || editing || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (['0', '1', '2', '3'].includes(e.key) && revealed) {
        e.preventDefault();
        void grade(Number(e.key));
      } else if (e.key === 'ArrowLeft') {
        move(idx - 1);
      } else if (e.key === 'ArrowRight') {
        move(idx + 1);
      } else if (e.key.toLowerCase() === 'f') {
        void toggleFlag();
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        startEdit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, editing, revealed, grade, move, idx, toggleFlag, startEdit]);

  const tally = useMemo(() => {
    const t = [0, 0, 0, 0];
    Object.values(graded).forEach((g) => t[g]++);
    return t;
  }, [graded]);
  const gradedCount = Object.keys(graded).length;
  const doneIds = new Set([...doneBefore.current, ...Object.keys(graded)]);
  const doneCount = doneIds.size;
  // Traffic-light progress: the latest grade of every question done so far in this run.
  const doneGrades = [0, 0, 0, 0];
  list.forEach((x) => {
    if (doneIds.has(x.id) && x.last_grade !== null) doneGrades[x.last_grade]++;
  });

  if (finished) {
    const weak = list.filter((x) => graded[x.id] !== undefined && graded[x.id] <= 1);
    const skipped = list.length - doneCount;
    const earlier = doneBefore.current.size;
    return (
      <div className="study">
        <div className="study-head">
          <button className="link" onClick={onExit}>← Home</button>
          <span className="muted">{title}</span>
        </div>
        <div className="card done">
          <h2>{list.length === 0 ? 'Nothing here' : 'Done'}</h2>
          {list.length === 0 ? (
            <p className="muted">{mode === 'review' ? 'No questions match. Nothing is due, or you haven’t learned this yet.' : 'This section has no questions.'}</p>
          ) : (
            <>
              <p>
                {earlier > 0
                  ? `You graded ${gradedCount} this time; with the ${earlier} you'd already done, that's ${doneCount} of ${list.length}`
                  : `You graded ${gradedCount} of ${list.length}`}
                {skipped > 0 ? ` (${skipped} skipped)` : ''}.
              </p>
              <div className="tally">
                {GRADES.map((g) => (
                  <div key={g.value} className={`tally-item g${g.value}`}>
                    <strong>{tally[g.value]}</strong>
                    <span>{g.label}</span>
                  </div>
                ))}
              </div>
              {mode === 'learn' && <p className="muted">These are now in your review queue. Blanks come back tomorrow, partials in 3 days.</p>}
            </>
          )}
          <div className="row gap">
            {weak.length > 0 && (
              <button
                onClick={() => {
                  setList(weak);
                  startIntervals.current = new Map(weak.map((x) => [x.id, x.interval_days]));
                  doneBefore.current = new Set();
                  setGraded({});
                  setIdx(0);
                  setRevealed(false);
                  setFinished(false);
                }}
              >
                Go through the {weak.length} Blank/Partial again now
              </button>
            )}
            <button className="primary" onClick={onExit}>Back to home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="study">
      <div className="study-head">
        <button className="link" onClick={onExit}>← Home</button>
        <span className="muted ellipsis">{title}</span>
        <span className="muted nowrap">
          {idx + 1} / {list.length}
        </span>
      </div>
      <GradeBar className="study-bar" counts={doneGrades} unlearned={list.length - doneCount} restLabel={mode === 'learn' ? 'Not yet learned' : 'Still to go'} />
      {notice && idx === startIndex && gradedCount === 0 && <p className="notice">{notice}</p>}

      <div className="card qcard">
        {mode === 'review' && (
          <div className="qcontext">
            <span className="nowrap">
              Week {q.week}
              {q.case_title ? ` · ${q.case_title}` : ''}
              {q.topic ? ` · ${q.topic}` : ''}
            </span>
            <span className="qsection">
              {q.section}. {q.section_title.replace(/^\d+\.\s*/, '')}
            </span>
          </div>
        )}
        <div className="qmeta">
          <span className="qid">{q.qid}</span>
          {q.kind === 'application' && <span className="badge">Application</span>}
          {q.group_title && <span className="group">{q.group_title}</span>}
          {mode === 'review' && q.last_grade !== null && sessionGrade === undefined && (
            <span className={`badge last g${q.last_grade}`}>Last: {GRADES[q.last_grade].label}</span>
          )}
          {q.lobs?.length > 0 && (
            <button
              className="lobs"
              onClick={() => setShowLobs(!showLobs)}
              aria-expanded={showLobs}
              title={q.lobs.map((n) => `LOB ${n}. ${objectiveTitle.get(`${q.week}|${n}`) ?? ''}`).join('\n')}
            >
              LOB {q.lobs.join(' · ')}
            </button>
          )}
        </div>
        {showLobs && q.lobs?.length > 0 && (
          <ul className="lobtext">
            {q.lobs.map((n) => (
              <li key={n}>
                <strong>{n}.</strong> {objectiveTitle.get(`${q.week}|${n}`) ?? 'No wording for this objective in the import file.'}
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <div className="edit">
            <label>
              Question
              <textarea value={draftQ} onChange={(e) => setDraftQ(e.target.value)} rows={4} />
            </label>
            <label>
              Answer <span className="muted">(**text** for bold)</span>
              <textarea value={draftA} onChange={(e) => setDraftA(e.target.value)} rows={8} />
            </label>
            <div className="row gap">
              <button className="primary" disabled={busy || !draftQ.trim() || !draftA.trim()} onClick={saveEdit}>Save</button>
              <button onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="question">
              <RichText text={q.question} />
            </div>
            {revealed ? (
              <div className="answer">
                <RichText text={q.answer} />
              </div>
            ) : (
              <button className="reveal" onClick={() => setRevealed(true)}>
                Show answer <kbd>Space</kbd>
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {revealed && !editing && (
        <div className="grades" role="group" aria-label="Grade yourself">
          {GRADES.map((g) => (
            <button
              key={g.value}
              className={`grade g${g.value}${sessionGrade === g.value ? ' chosen' : ''}`}
              disabled={busy}
              onClick={() => grade(g.value)}
              title={g.hint}
            >
              <strong>{g.label}</strong>
              <span>{g.hint}</span>
              <kbd>{g.key}</kbd>
            </button>
          ))}
        </div>
      )}

      <div className="study-foot">
        <button className="link" disabled={idx === 0} onClick={() => move(idx - 1)}>← Back</button>
        <div className="row gap">
          <button className={`link${q.flagged ? ' flagged' : ''}`} onClick={toggleFlag} title="Flag this question to check later (F)">
            {q.flagged ? '⚑ Flagged' : '⚐ Flag'}
          </button>
          {!editing && (
            <button className="link" onClick={startEdit} title="Edit question or answer (E)">Edit</button>
          )}
        </div>
        <button className="link" onClick={() => move(idx + 1)}>Skip →</button>
      </div>
      {sessionGrade !== undefined && q.due_at && (
        <p className="muted small center">Graded {GRADES[sessionGrade].label} · next review {describeDue(q.due_at)}</p>
      )}
      <p className="muted small center keys">
        Keys: <kbd>Space</kbd> show · <kbd>0</kbd>–<kbd>3</kbd> grade · <kbd>←</kbd>/<kbd>→</kbd> back/skip · <kbd>F</kbd> flag · <kbd>E</kbd> edit
      </p>
    </div>
  );
}
