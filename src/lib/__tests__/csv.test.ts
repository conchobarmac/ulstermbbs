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

describe('topic column', () => {
  it('reads case and topic separately', () => {
    const r = parseImport('week,case,topic,section,id,question,answer\n7,Sundip Patel,MI & IHD,1,1.1,q,a');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ case_title: 'Sundip Patel', topic: 'MI & IHD' });
  });
  it('topic is optional', () => {
    const r = parseImport('week,case,section,id,question,answer\n7,Sundip Patel,1,1.1,q,a');
    expect(r.rows[0].topic).toBe('');
  });
});

describe('learning objectives', () => {
  const h = 'week,case,topic,section,section_title,group,id,type,lobs,question,answer';
  it('reads objective rows and lobs tags', () => {
    const r = parseImport(
      [
        h,
        '8,Daisy Baker,Neonatology,,,,1,objective,,"1. Describe fetal circulation",',
        '8,Daisy Baker,Neonatology,,,,2,objective,,Describe the APGAR score,',
        '8,Daisy Baker,Neonatology,1,Fetal circulation,,1.1,recall,1,q,a',
        '8,Daisy Baker,Neonatology,1,Fetal circulation,,1.2,application,"1; 2",q,a',
      ].join('\n'),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.objectives).toEqual([
      { week: 8, num: 1, title: 'Describe fetal circulation' },
      { week: 8, num: 2, title: 'Describe the APGAR score' },
    ]);
    expect(r.rows.map((x) => x.lobs)).toEqual([[1], [1, 2]]);
    expect(r.rows.map((x) => x.position)).toEqual([0, 1]);
  });

  it('warns about untagged questions, unknown objectives and objectives without questions', () => {
    const r = parseImport(
      [h, '8,,,,,,1,objective,,One,', '8,,,,,,2,objective,,Two,', '8,,,1,,,1.1,,,q,a', '8,,,1,,,1.2,,7,q,a'].join('\n'),
    );
    expect(r.rows).toHaveLength(2);
    expect(r.warnings.join(' ')).toMatch(/1 question has no objective: 1.1/);
    expect(r.warnings.join(' ')).toMatch(/objective 7, which isn't listed/);
    expect(r.warnings.join(' ')).toMatch(/objectives 1, 2 have no questions/);
  });

  it('older files without a lobs column use each section as its objective', () => {
    const r = parseImport('week,section,section_title,id,question,answer\n7,1,1. Effects of drugs,1.1,q,a\n7,2,Angina,2.1,q,a');
    expect(r.rows.map((x) => x.lobs)).toEqual([[1], [2]]);
    expect(r.objectives).toEqual([
      { week: 7, num: 1, title: 'Effects of drugs' },
      { week: 7, num: 2, title: 'Angina' },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('rejects bad objective rows', () => {
    const r = parseImport([h, '8,,,,,,x,objective,,One,', '8,,,,,,3,objective,,,', '8,,,,,,4,objective,,Four,', '8,,,,,,4,objective,,Again,'].join('\n'));
    expect(r.objectives).toHaveLength(1);
    expect(r.errors).toHaveLength(3);
  });
});
