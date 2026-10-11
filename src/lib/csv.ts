import Papa from 'papaparse';
import type { ImportRow, Kind } from './types';

// Import file format (CSV with a header row). Column names are case-insensitive.
//   week           required  whole number, e.g. 7
//   case           optional  the case/topic title, e.g. "Sundip Patel: MI & IHD"
//   section        required  whole number (the learning objective number)
//   section_title  optional  the learning objective heading
//   group          optional  sub-heading within the section
//   id             required  unique within the week, e.g. "4.12"
//   type           optional  "recall" (default) or "application"
//   question       required
//   answer         required  **double asterisks** make text bold
// Rows keep the order they have in the file.

export const COLUMNS = ['week', 'case', 'section', 'section_title', 'group', 'id', 'type', 'question', 'answer'] as const;
const REQUIRED = ['week', 'section', 'id', 'question', 'answer'];

const ALIASES: Record<string, string> = {
  case_title: 'case',
  topic: 'case',
  lo: 'section',
  objective: 'section',
  section_heading: 'section_title',
  group_title: 'group',
  subheading: 'group',
  qid: 'id',
  question_id: 'id',
  kind: 'type',
  q: 'question',
  a: 'answer',
};

export interface ParseResult {
  rows: ImportRow[];
  errors: string[];
  weeks: number[];
  sections: number;
}

function normaliseHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ALIASES[k] ?? k;
}

export function parseImport(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normaliseHeader,
  });

  const errors: string[] = [];
  for (const e of parsed.errors.slice(0, 10)) {
    errors.push(`Line ${(e.row ?? 0) + 2}: ${e.message}`);
  }

  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED.filter((c) => !fields.includes(c));
  if (missing.length) {
    errors.push(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected: ${COLUMNS.join(', ')}`);
    return { rows: [], errors, weeks: [], sections: 0 };
  }

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  const positions = new Map<number, number>();

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const get = (k: string) => (r[k] ?? '').toString().trim();
    const week = Number(get('week'));
    const section = Number(get('section'));
    const qid = get('id');
    const question = get('question');
    const answer = get('answer');
    const typeRaw = get('type').toLowerCase();

    const problems: string[] = [];
    if (!Number.isInteger(week) || get('week') === '') problems.push('week must be a whole number');
    if (!Number.isInteger(section) || get('section') === '') problems.push('section must be a whole number');
    if (!qid) problems.push('id is empty');
    if (!question) problems.push('question is empty');
    if (!answer) problems.push('answer is empty');
    let kind: Kind = 'recall';
    if (typeRaw === 'application' || typeRaw === 'app') kind = 'application';
    else if (typeRaw && typeRaw !== 'recall') problems.push(`type "${typeRaw}" should be recall or application`);

    const key = `${week}|${qid}`;
    if (qid && seen.has(key)) problems.push(`id ${qid} appears twice in week ${week}`);

    if (problems.length) {
      errors.push(`Line ${line}: ${problems.join('; ')}`);
      return;
    }
    seen.add(key);
    const position = positions.get(week) ?? 0;
    positions.set(week, position + 1);
    rows.push({
      week,
      case_title: get('case'),
      section,
      section_title: get('section_title'),
      group_title: get('group'),
      qid,
      kind,
      question,
      answer,
      position,
    });
  });

  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b);
  const sections = new Set(rows.map((r) => `${r.week}|${r.section}`)).size;
  return { rows, errors, weeks, sections };
}

/** Build a CSV string from objects (used for export). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });
}
