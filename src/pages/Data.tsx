import { useEffect, useState } from 'react';
import type { Db } from '../lib/db';
import type { Question } from '../lib/types';
import { COLUMNS, parseImport, toCsv, type ParseResult } from '../lib/csv';
import { GRADES } from '../lib/schedule';
import { RichText } from '../components/RichText';

function download(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Data({ db }: { db: Db }) {
  return (
    <div className="data">
      <ImportCard db={db} />
      <FlaggedCard db={db} />
      <ExportCard db={db} />
      <DeleteCard db={db} />
    </div>
  );
}

function ImportCard({ db }: { db: Db }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function check(t: string) {
    setText(t);
    setStatus('');
    setResult(t.trim() ? parseImport(t) : null);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    check(await f.text());
  }

  async function doImport() {
    if (!result?.rows.length) return;
    setBusy(true);
    setStatus('');
    try {
      const r = await db.importRows(result.rows);
      const parts = [`Imported ${r.added + r.updated} questions: ${r.added} new, ${r.updated} updated. Your grades were kept.`];
      if (r.changedLearned.length) {
        const ids = r.changedLearned.map((c) => c.qid).join(', ');
        parts.push(
          `${r.changedLearned.length} question${r.changedLearned.length === 1 ? '' : 's'} you'd already learned changed wording and ${r.changedLearned.length === 1 ? 'is' : 'are'} now due for review: ${ids}.`,
        );
      }
      setStatus(parts.join(' '));
      setText('');
      setFileName('');
      setResult(null);
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Import questions</h2>
      <p className="muted small">
        A CSV with the columns <code>{COLUMNS.join(', ')}</code>. Re-importing a week updates the wording and keeps your grades.
      </p>
      <label className="file">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className="button">{fileName || 'Choose CSV file'}</span>
      </label>
      <details>
        <summary className="small">…or paste the CSV text</summary>
        <textarea rows={6} value={text} onChange={(e) => { setFileName(''); check(e.target.value); }} placeholder="week,case,section,section_title,group,id,type,question,answer" />
      </details>

      {result && (
        <div className="preview">
          {result.rows.length > 0 && (
            <p>
              Ready: <strong>{result.rows.length}</strong> questions in {result.sections} section{result.sections === 1 ? '' : 's'}, week{result.weeks.length > 1 ? 's' : ''} {result.weeks.join(', ')}.
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="error">
              <p>{result.errors.length} problem{result.errors.length === 1 ? '' : 's'} (these rows will be skipped):</p>
              <ul>
                {result.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
                {result.errors.length > 12 && <li>…and {result.errors.length - 12} more</li>}
              </ul>
            </div>
          )}
          <button className="primary" disabled={busy || !result.rows.length} onClick={doImport}>
            {busy ? 'Importing…' : `Import ${result.rows.length} questions`}
          </button>
        </div>
      )}
      {status && <p className={status.startsWith('Import failed') ? 'error' : 'ok'}>{status}</p>}
    </section>
  );
}

function FlaggedCard({ db }: { db: Db }) {
  const [qs, setQs] = useState<Question[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ question: '', answer: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    db.flaggedQuestions().then(setQs).catch((e) => setError((e as Error).message));
  }, [db]);

  async function unflag(q: Question) {
    await db.updateQuestion(q.id, { flagged: false });
    setQs((l) => l?.filter((x) => x.id !== q.id) ?? null);
  }

  async function save(q: Question) {
    try {
      await db.updateQuestion(q.id, { question: draft.question.trim(), answer: draft.answer.trim() });
      setQs((l) => l?.map((x) => (x.id === q.id ? { ...x, ...draft } : x)) ?? null);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="card" id="flagged">
      <h2>Flagged questions</h2>
      {error && <p className="error">{error}</p>}
      {!qs ? (
        <p className="muted">Loading…</p>
      ) : qs.length === 0 ? (
        <p className="muted small">Nothing flagged. Press <kbd>F</kbd> (or the flag button) on any question that looks wrong.</p>
      ) : (
        <ul className="flagged">
          {qs.map((q) => (
            <li key={q.id}>
              <div className="muted small">Week {q.week} · {q.qid}</div>
              {editing === q.id ? (
                <div className="edit">
                  <textarea rows={3} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
                  <textarea rows={6} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
                  <div className="row gap">
                    <button className="primary" onClick={() => save(q)}>Save</button>
                    <button onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="question small"><RichText text={q.question} /></div>
                  <div className="answer small"><RichText text={q.answer} /></div>
                  <div className="row gap">
                    <button className="small" onClick={() => { setEditing(q.id); setDraft({ question: q.question, answer: q.answer }); }}>Edit</button>
                    <button className="small" onClick={() => unflag(q)}>Unflag</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExportCard({ db }: { db: Db }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const { questions, grades } = await db.exportData();
      const stamp = new Date().toISOString().slice(0, 10);
      const qRows = questions.map((q) => ({
        week: q.week,
        case: q.case_title,
        topic: q.topic ?? '',
        section: q.section,
        section_title: q.section_title,
        group: q.group_title,
        id: q.qid,
        type: q.kind,
        question: q.question,
        answer: q.answer,
        last_grade: q.last_grade ?? '',
        last_grade_label: q.last_grade === null ? '' : GRADES[q.last_grade].label,
        times_seen: q.times_seen,
        learned_at: q.learned_at ?? '',
        last_seen_at: q.last_seen_at ?? '',
        next_review: q.due_at ?? '',
        flagged: q.flagged ? 'yes' : '',
      }));
      download(`recall-questions-${stamp}.csv`, toCsv(qRows, Object.keys(qRows[0] ?? { week: 1 })));
      const byId = new Map(questions.map((q) => [q.id, q]));
      const gRows = grades.map((g) => ({
        date: g.created_at,
        week: byId.get(g.question_id)?.week ?? '',
        id: byId.get(g.question_id)?.qid ?? '',
        mode: g.mode,
        grade: g.grade,
        grade_label: GRADES[g.grade]?.label ?? '',
      }));
      download(`recall-grades-${stamp}.csv`, toCsv(gRows, ['date', 'week', 'id', 'mode', 'grade', 'grade_label']));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Export</h2>
      <p className="muted small">
        Downloads two spreadsheets: every question with its current grade and next review date, and every grade you've ever given. The questions file can be re-imported as a backup.
      </p>
      <button disabled={busy} onClick={run}>{busy ? 'Preparing…' : 'Download CSVs'}</button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function DeleteCard({ db }: { db: Db }) {
  const [week, setWeek] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('');

  async function run() {
    try {
      await db.deleteWeek(Number(week));
      setStatus(`Deleted week ${week} and its grades.`);
      setWeek('');
      setConfirm('');
    } catch (e) {
      setStatus(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <section className="card">
      <h2>Delete a week</h2>
      <p className="muted small">Removes that week's questions and all their grades. This can't be undone, so export first if unsure.</p>
      <div className="row gap wrap">
        <label className="field">
          Week number
          <input inputMode="numeric" value={week} onChange={(e) => setWeek(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          Type DELETE to confirm
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      </div>
      <button className="danger" disabled={!week || confirm !== 'DELETE'} onClick={run}>Delete week {week}</button>
      {status && <p className={status.startsWith('Delete failed') ? 'error' : 'ok'}>{status}</p>}
    </section>
  );
}
