import { useEffect, useState } from 'react';
import type { Db } from '../lib/db';
import type { Question } from '../lib/types';
import { go, href } from '../lib/router';
import { Study } from '../components/Study';

export function Learn({ db, week, section, restart }: { db: Db; week: number; section: number; restart: boolean }) {
  const [qs, setQs] = useState<Question[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    db.sectionQuestions(week, section).then(setQs).catch((e) => setError((e as Error).message));
  }, [db, week, section]);

  if (error) return <p className="error">Couldn't load the section: {error}</p>;
  if (!qs) return <p className="muted">Loading…</p>;

  const firstNew = qs.findIndex((q) => !q.learned_at);
  const allLearned = firstNew === -1;
  const start = restart || allLearned ? 0 : firstNew;
  let notice: React.ReactNode;
  if (!restart && allLearned && qs.length) notice = 'You’ve learned every question here. Going through again from the start; new grades update your review schedule.';
  else if (!restart && firstNew > 0)
    notice = (
      <>
        Picking up at question {firstNew + 1}, the first one you haven’t graded.{' '}
        <a href={href(`/learn/${week}/${section}?restart=1`)}>Start from question 1</a>
      </>
    );

  const title = qs[0] ? `Learn · Week ${week} · ${section}. ${qs[0].section_title.replace(/^\d+\.\s*/, '')}` : `Learn · Week ${week} · Section ${section}`;

  return <Study db={db} mode="learn" title={title} questions={qs} startIndex={start} notice={notice} onExit={() => go('/')} />;
}
