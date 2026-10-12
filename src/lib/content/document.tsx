import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Render a long-form editable document (legal / policy pages).
 *
 * Input is plain text in a deliberately small markdown-like format; output is
 * React nodes only — never `dangerouslySetInnerHTML` — so a content editor
 * cannot inject HTML or scripts. Supported syntax:
 *
 *   ## Heading / ### Heading     h2 / h3
 *   - item                        bullet list (indent 2 spaces per level to nest)
 *   1. item                       numbered list
 *   1.1 text  (a) text  (iv) text numbered legal clause; indent 2 spaces per level
 *   | a | b |                     table; first row is the header
 *   **bold**                      emphasis
 *   [label](href)                 link — https, mailto, tel or a site path (/…)
 *
 * Anything else is a paragraph (indentation keeps it aligned with the clause
 * above). Blank lines separate blocks.
 */

// ---------------------------------------------------------------------------
// Inline: **bold** and [label](href)
// ---------------------------------------------------------------------------

const INLINE_RE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

export function renderInline(text: string): ReactNode {
  if (!text.includes('**') && !text.includes('](')) return text;
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const close = part.indexOf('](');
    const label = part.slice(1, close);
    const href = part.slice(close + 2, -1);
    if (!SAFE_HREF_RE.test(href)) return <span key={i}>{label}</span>;
    if (href.startsWith('/')) {
      return (
        <Link key={i} href={href}>
          {label}
        </Link>
      );
    }
    const external = /^https?:\/\//i.test(href);
    return (
      <a key={i} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {label}
      </a>
    );
  });
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

type Block =
  | { kind: 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string; level: number }
  | { kind: 'clause'; num: string; text: string; level: number }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'table'; rows: string[][] };

interface ListItem {
  ordered: boolean;
  text: string;
  children: ListItem[];
}

const CLAUSE_RE = /^(\d+\.\d+|\([a-z]{1,3}\)|\([ivxl]+\))\s+(.*)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;
const BULLET_RE = /^-\s+(.*)$/;
const MAX_LEVEL = 3;

interface RawListLine {
  ordered: boolean;
  level: number;
  text: string;
}

function buildList(lines: RawListLine[]): ListItem[] {
  const root: ListItem[] = [];
  const stack: Array<{ level: number; items: ListItem[] }> = [{ level: -1, items: root }];
  for (const line of lines) {
    while (stack.length > 1 && stack[stack.length - 1].level >= line.level) stack.pop();
    const item: ListItem = { ordered: line.ordered, text: line.text, children: [] };
    stack[stack.length - 1].items.push(item);
    stack.push({ level: line.level, items: item.children });
  }
  return root;
}

export function parseDocument(source: string): Block[] {
  const blocks: Block[] = [];
  let listBuf: RawListLine[] = [];
  let tableBuf: string[][] = [];

  const flush = () => {
    if (listBuf.length) {
      blocks.push({ kind: 'list', items: buildList(listBuf) });
      listBuf = [];
    }
    if (tableBuf.length) {
      blocks.push({ kind: 'table', rows: tableBuf });
      tableBuf = [];
    }
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const level = Math.min(MAX_LEVEL, Math.floor(indent / 2));
    const text = line.trim();

    if (text.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'h3', text: text.slice(4) });
      continue;
    }
    if (text.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'h2', text: text.slice(3) });
      continue;
    }

    if (text.startsWith('|') && text.endsWith('|')) {
      if (listBuf.length) flush();
      const cells = text.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // markdown separator row
      tableBuf.push(cells);
      continue;
    }
    if (tableBuf.length) flush();

    const bullet = text.match(BULLET_RE);
    if (bullet) {
      listBuf.push({ ordered: false, level, text: bullet[1] });
      continue;
    }
    const ordered = text.match(ORDERED_RE);
    if (ordered) {
      listBuf.push({ ordered: true, level, text: ordered[1] });
      continue;
    }
    if (listBuf.length) flush();

    const clause = text.match(CLAUSE_RE);
    if (clause) {
      blocks.push({ kind: 'clause', num: clause[1], text: clause[2], level });
      continue;
    }

    blocks.push({ kind: 'p', text, level });
  }
  flush();
  return blocks;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function ListNodes({ items }: { items: ListItem[] }) {
  // Group consecutive siblings of the same list type into one <ul>/<ol>.
  const groups: ListItem[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0].ordered === item.ordered) last.push(item);
    else groups.push([item]);
  }
  return (
    <>
      {groups.map((group, gi) => {
        const Tag = group[0].ordered ? 'ol' : 'ul';
        return (
          <Tag key={gi}>
            {group.map((item, i) => (
              <li key={i}>
                {renderInline(item.text)}
                {item.children.length > 0 && <ListNodes items={item.children} />}
              </li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}

export function renderDocument(source: string): ReactNode {
  const blocks = parseDocument(source);
  return blocks.map((block, i) => {
    switch (block.kind) {
      case 'h2':
        return <h2 key={i}>{renderInline(block.text)}</h2>;
      case 'h3':
        return <h3 key={i}>{renderInline(block.text)}</h3>;
      case 'p':
        return (
          <p key={i} className="tp-doc__p" data-level={block.level}>
            {renderInline(block.text)}
          </p>
        );
      case 'clause':
        return (
          <div key={i} className="tp-doc__clause" data-level={block.level}>
            <span className="tp-doc__num">{block.num}</span>
            <p>{renderInline(block.text)}</p>
          </div>
        );
      case 'list':
        return <ListNodes key={i} items={block.items} />;
      case 'table': {
        const [head, ...body] = block.rows;
        return (
          <table key={i}>
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} scope="col">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className={ci === 0 ? 'tp-doc__term' : undefined}>
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    }
  });
}
