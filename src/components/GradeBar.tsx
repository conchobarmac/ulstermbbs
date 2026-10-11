/** A thin bar showing how a set of questions last went: red / amber / yellow-green / green / not yet learned. */
export function GradeBar({ counts, unlearned }: { counts: number[]; unlearned: number }) {
  const total = counts.reduce((a, b) => a + b, 0) + unlearned;
  if (!total) return null;
  const parts = [
    ...counts.map((n, g) => ({ n, cls: `g${g}` })),
    { n: unlearned, cls: 'gnone' },
  ].filter((p) => p.n > 0);
  const title = `Blank ${counts[0]} · Partial ${counts[1]} · Mostly ${counts[2]} · Solid ${counts[3]} · Not learned ${unlearned}`;
  return (
    <div className="gradebar" title={title} aria-label={title}>
      {parts.map((p) => (
        <span key={p.cls} className={p.cls} style={{ flexGrow: p.n }} />
      ))}
    </div>
  );
}
