export type Kind = 'recall' | 'application';
export type Mode = 'learn' | 'review';

/** A question as stored in the database, including its study state. */
export interface Question {
  id: string;
  week: number;
  case_title: string;
  topic: string;
  section: number;
  section_title: string;
  group_title: string;
  qid: string;
  kind: Kind;
  question: string;
  answer: string;
  position: number;
  learned_at: string | null;
  last_grade: number | null;
  last_seen_at: string | null;
  interval_days: number;
  due_at: string | null;
  times_seen: number;
  flagged: boolean;
}

/** The light version used for the home screen counts. */
export type QuestionState = Pick<
  Question,
  'id' | 'week' | 'case_title' | 'topic' | 'section' | 'section_title' | 'learned_at' | 'last_grade' | 'due_at' | 'flagged'
>;

/** One row of the weekly import file, after validation. */
export interface ImportRow {
  week: number;
  case_title: string;
  topic: string;
  section: number;
  section_title: string;
  group_title: string;
  qid: string;
  kind: Kind;
  question: string;
  answer: string;
  position: number;
}

export interface GradeRecord {
  question_id: string;
  grade: number;
  mode: Mode;
  created_at: string;
}

export type ReviewScope = 'due' | 'weak' | 'all';

export interface ReviewFilter {
  scope: ReviewScope;
  week?: number;
  section?: number;
}
