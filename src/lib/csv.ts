import Papa from 'papaparse';
import type { ImportRow, Kind, Objective } from './types';

// Import file format (CSV with a header row). Column names are case-insensitive.
//   week           required  whole number, e.g. 7
//   case           optional  the PBL case, e.g. "Sundip Patel"
//   topic          optional  your own label for the week, e.g. "MI & IHD"
//   section        required  whole number (the chapter / section of the notes)
//   section_title  optional  the section heading
//   group          optional  sub-heading within the section
//   id             required  unique within the week, e.g. "4.12"
//   type           optional  "recall" (default), "application", or "objective"
//   lobs           optional  learning objectives the question tests, e.g. "16;17"
//   question       required
//   answer         required  **double asterisks** make text bold
// Rows keep the order they have in the file.
//
// Objective rows (type "objective") give the wording of the week's learning objectives:
//   id = the objective number, question = its wording. Section and answer can be left empty.
// A file with no lobs column and no objective rows (the older format) treats each section
// as its own objective, so re-importing an older file keeps working.

export const COLUMNS = ['week', 'case', 'topic', 'section', 'section_title', 'group', 'id', 'type', 'lobs', 'question', 'answer'] as const;
const REQUIRED = ['week', 'section', 'id', 'question', 'answer'];

const ALIASES: Record<string, string> = {
  case_title: 'case',
  case_name: 'case',
  patient: 'case',
  topics: 'topic',
  label: 'topic',
  lob: 'lobs',
  los: 'lobs',
  objectives: 'lobs',
  learning_objectives: 'lobs',
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
  objectives: Objective[];
  errors: string[];
  /** Things worth knowing that don't stop the import (e.g. an objective with no questions). */
  warnings: string[];
  weeks: number[];
  sections: number;
}

/** "16;17", "16, 17", "LOB 16 / 17" → [16, 17] */
export function parseLobs(s: string): number[] {
  return [...new Set((s.match(/\d+/g) ?? []).map(Number))].sort((a, b) => a - b);
}

const stripNumber = (t: string) => t.replace(/^\d+\.\s*/, '');

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
    return { rows: [], objectives: [], errors, warnings: [], weeks: [], sections: 0 };
  }

  const hasLobsColumn = fields.includes('lobs');
  const rows: ImportRow[] = [];
  const objectives: Objective[] = [];
  const seen = new Set<string>();
  const seenObjectives = new Set<string>();
  const positions = new Map<number, number>();

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const get = (k: string) => (r[k] ?? '').toString().trim();
    const week = Number(get('week'));
    const typeRaw = get('type').toLowerCase();

    if (typeRaw === 'objective' || typeRaw === 'lob') {
      const num = Number(get('id').replace(/^lob\s*/i, ''));
      const title = get('question') || get('answer');
      const problems: string[] = [];
      if (!Number.isInteger(week) || get('week') === '') problems.push('week must be a whole number');
      if (!Number.isInteger(num) || get('id') === '') problems.push('objective id must be its number');
      if (!title) problems.push('objective wording (question column) is empty');
      if (Number.isInteger(num) && seenObjectives.has(`${week}|${num}`)) problems.push(`objective ${num} appears twice in week ${week}`);
      if (problems.length) errors.push(`Line ${line}: ${problems.join('; ')}`);
      else {
        seenObjectives.add(`${week}|${num}`);
        objectives.push({ week, num, title: stripNumber(title) });
      }
      return;
    }


    const section = Number(get('section'));
    const qid = get('id');
    const question = get('question');
    const answer = get('answer');

    const problems: string[] = [];
    if (!Number.isInteger(week) || get('week') === '') problems.push('week must be a whole number');
    if (!Number.isInteger(section) || get('section') === '') problems.push('section must be a whole number');
    if (!qid) problems.push('id is empty');
    if (!question) problems.push('question is empty');
    if (!answer) problems.push('answer is empty');
    let kind: Kind = 'recall';
    if (typeRaw === 'application' || typeRaw === 'app') kind = 'application';
    else if (typeRaw && typeRaw !== 'recall') problems.push(`type "${typeRaw}" should be recall, application or objective`);

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
      topic: get('topic'),
      section,
      section_title: get('section_title'),
      group_title: get('group'),
      qid,
      kind,
      lobs: hasLobsColumn ? parseLobs(get('lobs')) : [section],
      question,
      answer,
      position,
    });
  });

  const warnings: string[] = [];
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b);

  if (!hasLobsColumn && !objectives.length) {
    // Older format: each section is an objective.
    for (const r of rows) {
      if (!objectives.some((o) => o.week === r.week && o.num === r.section)) {
        objectives.push({ week: r.week, num: r.section, title: stripNumber(r.section_title) || `Section ${r.section}` });
      }
    }
  } else {
    for (const w of weeks) {
      const defined = new Set(objectives.filter((o) => o.week === w).map((o) => o.num));
      const qs = rows.filter((r) => r.week === w);
      const untagged = qs.filter((r) => !r.lobs.length).map((r) => r.qid);
      if (untagged.length) {
        warnings.push(`Week ${w}: ${untagged.length} question${untagged.length === 1 ? ' has' : 's have'} no objective: ${untagged.slice(0, 8).join(', ')}${untagged.length > 8 ? '…' : ''}`);
      }
      if (defined.size) {
        const unknown = [...new Set(qs.flatMap((r) => r.lobs).filter((n) => !defined.has(n)))].sort((a, b) => a - b);
        if (unknown.length) warnings.push(`Week ${w}: questions refer to objective${unknown.length === 1 ? '' : 's'} ${unknown.join(', ')}, which ${unknown.length === 1 ? "isn't" : "aren't"} listed in the file.`);
        const tagged = new Set(qs.flatMap((r) => r.lobs));
        const empty = [...defined].filter((n) => !tagged.has(n)).sort((a, b) => a - b);
        if (empty.length) warnings.push(`Week ${w}: objective${empty.length === 1 ? '' : 's'} ${empty.join(', ')} ${empty.length === 1 ? 'has' : 'have'} no questions.`);
      } else if (qs.length) {
        warnings.push(`Week ${w}: no objective rows, so objectives will show by number only.`);
      }
    }
  }
  objectives.sort((a, b) => a.week - b.week || a.num - b.num);

  const sections = new Set(rows.map((r) => `${r.week}|${r.section}`)).size;
  return { rows, objectives, errors, warnings, weeks, sections };
}

/** Build a CSV string from objects (used for export). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });
}
