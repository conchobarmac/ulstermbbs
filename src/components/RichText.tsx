import { Fragment } from 'react';

/** Renders plain text with **bold** spans and line breaks. No HTML is interpreted. */
export function RichText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
