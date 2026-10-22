import React from 'react';

type Block =
  | { kind: 'heading'; text: string; section: number }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'bullets' | 'numbers'; items: string[] }
  | { kind: 'table'; rows: string[][] };

function tableCells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parse(markdown: string): Block[] {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks: Block[] = [];
  let index = 0;
  let section = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ kind: 'heading', text: line.slice(3), section: section++ });
      index += 1;
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const cells = tableCells(lines[index].trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      if (rows.length) blocks.push({ kind: 'table', rows });
      continue;
    }

    const bullet = /^[-*] /.test(line);
    const number = /^\d+\. /.test(line);
    if (bullet || number) {
      const items: string[] = [];
      const matcher = bullet ? /^[-*] / : /^\d+\. /;
      while (index < lines.length && matcher.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(matcher, ''));
        index += 1;
      }
      blocks.push({ kind: bullet ? 'bullets' : 'numbers', items });
      continue;
    }

    if (line.startsWith('> ')) {
      const parts: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        parts.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push({ kind: 'quote', text: parts.join(' ') });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index].trim();
      if (/^(## |\|[- :|]+\||[-*] |\d+\. |> )/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

export function articleHeadings(markdown: string): { title: string; section: number }[] {
  return parse(markdown)
    .filter((block): block is Extract<Block, { kind: 'heading' }> => block.kind === 'heading')
    .map(({ text: title, section }) => ({ title, section }));
}

function inline(text: string): React.ReactNode[] {
  const token = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:wiki:[a-z0-9-]+|https?:\/\/[^)\s]+)\))/g;
  return text
    .split(token)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      const link = part.match(/^\[([^\]]+)\]\((wiki:[a-z0-9-]+|https?:\/\/[^)\s]+)\)$/);
      if (link) {
        const internal = link[2].startsWith('wiki:');
        return (
          <a
            key={index}
            href={internal ? '#/wiki/' + link[2].slice(5) : link[2]}
            target={internal ? undefined : '_blank'}
            rel={internal ? undefined : 'noopener noreferrer'}
          >
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

export function WikiMarkdown({ content }: { content: string }) {
  return (
    <div className="wiki-prose">
      {parse(content).map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <h2 id={'wiki-section-' + block.section} key={index}>
                {block.text}
              </h2>
            );
          case 'paragraph':
            return <p key={index}>{inline(block.text)}</p>;
          case 'quote':
            return <blockquote key={index}>{inline(block.text)}</blockquote>;
          case 'bullets':
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item)}</li>
                ))}
              </ul>
            );
          case 'numbers':
            return (
              <ol key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div className="wiki-table-scroll" key={index}>
                <table>
                  <thead>
                    <tr>
                      {block.rows[0].map((cell, column) => (
                        <th key={column}>{inline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, column) => (
                          <td key={column}>{inline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
