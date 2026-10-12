import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GradeRecord, ImportRow, Mode, Question, QuestionState, ReviewFilter } from './types';

export interface User {
  id: string;
  email: string;
}

/** Everything the app needs from storage. Two implementations: Supabase, and an in-browser demo. */
export interface Db {
  readonly kind: 'supabase' | 'demo';
  /** True when the database predates the `topic` column (migration 002 not yet run). */
  missingTopic: boolean;
  getUser(): Promise<User | null>;
  onAuthChange(cb: (u: User | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  summary(): Promise<QuestionState[]>;
  sectionQuestions(week: number, section: number): Promise<Question[]>;
  reviewQuestions(filter: ReviewFilter): Promise<Question[]>;
  flaggedQuestions(): Promise<Question[]>;
  recordGrade(id: string, grade: number, mode: Mode, intervalDays: number, due: Date): Promise<void>;
  updateQuestion(id: string, patch: Partial<Pick<Question, 'question' | 'answer' | 'flagged'>>): Promise<void>;
  importRows(rows: ImportRow[]): Promise<number>;
  deleteWeek(week: number): Promise<void>;
  exportData(): Promise<{ questions: Question[]; grades: GradeRecord[] }>;
}

const STATE_COLUMNS = 'id,week,case_title,section,section_title,learned_at,last_grade,due_at,flagged';

const TOPIC_MIGRATION_MESSAGE =
  "Your database needs a one-line update for the new 'topic' column. In Supabase, open SQL Editor, run supabase/migrations/002_add_topic.sql from the repo, then try again.";

/** PostgREST errors for a column that doesn't exist (yet). */
function isMissingTopic(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return !!err && (err.code === '42703' || err.code === 'PGRST204') && /topic/.test(err.message ?? '');
}
const PAGE = 1000; // Supabase returns at most 1000 rows per request

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
class SupabaseDb implements Db {
  readonly kind = 'supabase' as const;
  missingTopic = false;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key);
  }

  async getUser(): Promise<User | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? '' } : null;
  }

  onAuthChange(cb: (u: User | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      cb(u ? { id: u.id, email: u.email ?? '' } : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  private async all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  async summary() {
    const run = (cols: string) =>
      this.all<QuestionState>(
        (f, t) =>
          this.sb.from('questions').select(cols).order('week').order('position').order('id').range(f, t) as unknown as PromiseLike<{
            data: QuestionState[] | null;
            error: unknown;
          }>,
      );
    try {
      const rows = await run(`${STATE_COLUMNS},topic`);
      this.missingTopic = false;
      return rows;
    } catch (e) {
      if (!isMissingTopic(e)) throw e;
      // Database not yet updated: carry on without topics and let the app show a notice.
      this.missingTopic = true;
      return (await run(STATE_COLUMNS)).map((r) => ({ ...r, topic: '' }));
    }
  }

  sectionQuestions(week: number, section: number) {
    return this.all<Question>((f, t) =>
      this.sb.from('questions').select('*').eq('week', week).eq('section', section).order('position').order('id').range(f, t),
    );
  }

  reviewQuestions(filter: ReviewFilter) {
    return this.all<Question>((f, t) => {
      let q = this.sb.from('questions').select('*').not('learned_at', 'is', null);
      if (filter.dueOnly) q = q.lte('due_at', new Date().toISOString());
      if (filter.maxGrade < 3) q = q.lte('last_grade', filter.maxGrade);
      if (filter.week !== undefined) q = q.eq('week', filter.week);
      if (filter.section !== undefined) q = q.eq('section', filter.section);
      return q.order('week').order('position').order('id').range(f, t);
    });
  }

  flaggedQuestions() {
    return this.all<Question>((f, t) =>
      this.sb.from('questions').select('*').eq('flagged', true).order('week').order('position').range(f, t),
    );
  }

  async recordGrade(id: string, grade: number, mode: Mode, intervalDays: number, due: Date) {
    const { error } = await this.sb.rpc('record_grade', {
      p_question: id,
      p_grade: grade,
      p_mode: mode,
      p_interval: intervalDays,
      p_due: due.toISOString(),
    });
    if (error) throw error;
  }

  async updateQuestion(id: string, patch: Partial<Pick<Question, 'question' | 'answer' | 'flagged'>>) {
    const { error } = await this.sb.from('questions').update(patch).eq('id', id);
    if (error) throw error;
  }

  async importRows(rows: ImportRow[]) {
    const user = await this.getUser();
    if (!user) throw new Error('Not signed in');
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, user_id: user.id }));
      // On a repeat import this updates the text and order but leaves your grades alone.
      let { error } = await this.sb.from('questions').upsert(chunk, { onConflict: 'user_id,week,qid' });
      if (error && isMissingTopic(error)) {
        // Older database without the topic column: fine if the file has no topics, otherwise ask for the update.
        if (rows.some((r) => r.topic)) throw new Error(TOPIC_MIGRATION_MESSAGE);
        const withoutTopic = chunk.map(({ topic: _topic, ...rest }) => rest);
        ({ error } = await this.sb.from('questions').upsert(withoutTopic, { onConflict: 'user_id,week,qid' }));
      }
      if (error) throw error;
    }
    return rows.length;
  }

  async deleteWeek(week: number) {
    const { error } = await this.sb.from('questions').delete().eq('week', week);
    if (error) throw error;
  }

  async exportData() {
    const questions = await this.all<Question>((f, t) =>
      this.sb.from('questions').select('*').order('week').order('position').order('id').range(f, t),
    );
    const grades = await this.all<GradeRecord>((f, t) =>
      this.sb.from('grades').select('question_id,grade,mode,created_at').order('created_at').order('id').range(f, t),
    );
    return { questions, grades };
  }
}

// ---------------------------------------------------------------------------
// Demo: stores everything in this browser (localStorage). For trying the app.
// ---------------------------------------------------------------------------
interface DemoStore {
  questions: Question[];
  grades: GradeRecord[];
}

class DemoDb implements Db {
  readonly kind = 'demo' as const;
  missingTopic = false;
  private key = 'recall-demo-v1';

  private load(): DemoStore {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const s = JSON.parse(raw) as DemoStore;
        s.questions.forEach((q) => (q.topic = q.topic ?? ''));
        return s;
      }
    } catch {
      /* ignore */
    }
    return { questions: [], grades: [] };
  }

  private save(s: DemoStore) {
    try {
      localStorage.setItem(this.key, JSON.stringify(s));
    } catch {
      /* storage full or blocked */
    }
  }

  private sorted(qs: Question[]) {
    return [...qs].sort((a, b) => a.week - b.week || a.position - b.position);
  }

  async getUser() {
    return { id: 'demo', email: 'demo (this browser only)' };
  }
  onAuthChange() {
    return () => {};
  }
  async signIn() {}
  async signOut() {}

  async summary() {
    return this.sorted(this.load().questions);
  }
  async sectionQuestions(week: number, section: number) {
    return this.sorted(this.load().questions.filter((q) => q.week === week && q.section === section));
  }
  async reviewQuestions(filter: ReviewFilter) {
    const now = Date.now();
    return this.sorted(
      this.load().questions.filter(
        (q) =>
          q.learned_at !== null &&
          (!filter.dueOnly || (q.due_at !== null && new Date(q.due_at).getTime() <= now)) &&
          (q.last_grade !== null && q.last_grade <= filter.maxGrade) &&
          (filter.week === undefined || q.week === filter.week) &&
          (filter.section === undefined || q.section === filter.section),
      ),
    );
  }
  async flaggedQuestions() {
    return this.sorted(this.load().questions.filter((q) => q.flagged));
  }
  async recordGrade(id: string, grade: number, mode: Mode, intervalDays: number, due: Date) {
    const s = this.load();
    const q = s.questions.find((x) => x.id === id);
    if (!q) throw new Error('question not found');
    const now = new Date().toISOString();
    q.learned_at = q.learned_at ?? now;
    q.last_grade = grade;
    q.last_seen_at = now;
    q.interval_days = intervalDays;
    q.due_at = due.toISOString();
    q.times_seen += 1;
    s.grades.push({ question_id: id, grade, mode, created_at: now });
    this.save(s);
  }
  async updateQuestion(id: string, patch: Partial<Pick<Question, 'question' | 'answer' | 'flagged'>>) {
    const s = this.load();
    const q = s.questions.find((x) => x.id === id);
    if (q) Object.assign(q, patch);
    this.save(s);
  }
  async importRows(rows: ImportRow[]) {
    const s = this.load();
    for (const r of rows) {
      const existing = s.questions.find((q) => q.week === r.week && q.qid === r.qid);
      if (existing) Object.assign(existing, r);
      else
        s.questions.push({
          ...r,
          id: crypto.randomUUID(),
          learned_at: null,
          last_grade: null,
          last_seen_at: null,
          interval_days: 0,
          due_at: null,
          times_seen: 0,
          flagged: false,
        });
    }
    this.save(s);
    return rows.length;
  }
  async deleteWeek(week: number) {
    const s = this.load();
    const ids = new Set(s.questions.filter((q) => q.week === week).map((q) => q.id));
    s.questions = s.questions.filter((q) => !ids.has(q.id));
    s.grades = s.grades.filter((g) => !ids.has(g.question_id));
    this.save(s);
  }
  async exportData() {
    const s = this.load();
    return { questions: this.sorted(s.questions), grades: s.grades };
  }
}

// ---------------------------------------------------------------------------

function makeDb(): Db | null {
  if (import.meta.env.VITE_DEMO === '1') return new DemoDb();
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  return new SupabaseDb(url, key);
}

/** null when the Supabase environment variables are missing. */
export const db: Db | null = makeDb();
