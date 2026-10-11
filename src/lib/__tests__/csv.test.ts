import { describe, expect, it } from 'vitest';
import { parseImport } from '../csv';

const header = 'week,case,section,section_title,group,id,type,question,answer';

describe('parseImport', () => {
  it('parses quoted fields with commas, quotes and newlines, keeping order', () => {
    const csv = [
      header,
      '7,"Sundip Patel: MI & IHD",1,"1. Drugs",Conduction,1.1,recall,"Trace the pathway, start to end.","**SA node** → ""AV node""\nline 2"',
      '7,"Sundip Patel: MI & IHD",1,"1. Drugs",Conduction,1.2,,"Q2","A2"',
      '7,"Sundip Patel: MI & IHD",2,"2. Angina",Application,2.1,application,"Q3","A3"',
    ].join('\n');
    const r = parseImport(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ week: 7, section: 1, qid: '1.1', kind: 'recall', position: 0, case_title: 'Sundip Patel: MI & IHD' });
    expect(r.rows[0].answer).toBe('**SA node** → "AV node"\nline 2');
    expect(r.rows[1].kind).toBe('recall');
    expect(r.rows[2]).toMatchObject({ kind: 'application', position: 2, group_title: 'Application' });
    expect(r.weeks).toEqual([7]);
    expect(r.sections).toBe(2);
  });

  it('accepts header aliases, case and a BOM', () => {
    const r = parseImport('﻿Week,Section,QID,Question,Answer\n8,3,3.1,q,a');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ week: 8, section: 3, qid: '3.1', kind: 'recall' });
  });

  it('reports missing columns', () => {
    const r = parseImport('week,question,answer\n7,q,a');
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatch(/Missing columns: section, id/);
  });

  it('skips bad rows with line numbers and catches duplicate ids', () => {
    const csv = [header, '7,,1,,,1.1,,q,a', 'x,,1,,,1.2,,q,a', '7,,1,,,1.1,,q,a', '7,,1,,,1.3,,,a', '7,,1,,,1.4,essay,q,a'].join('\n');
    const r = parseImport(csv);
    expect(r.rows.map((x) => x.qid)).toEqual(['1.1']);
    expect(r.errors).toHaveLength(4);
    expect(r.errors[0]).toMatch(/^Line 3: week/);
    expect(r.errors[1]).toMatch(/appears twice/);
    expect(r.errors[2]).toMatch(/question is empty/);
    expect(r.errors[3]).toMatch(/type "essay"/);
  });

  it('positions count separately per week', () => {
    const r = parseImport([header, '7,,1,,,1.1,,q,a', '8,,1,,,1.1,,q,a', '7,,1,,,1.2,,q,a'].join('\n'));
    expect(r.rows.map((x) => `${x.week}:${x.position}`)).toEqual(['7:0', '8:0', '7:1']);
  });
});
