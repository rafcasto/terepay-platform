'use client';

import { useRef, useState } from 'react';
import { renderDocument } from '@/lib/content/document';

type Mode = 'write' | 'preview' | 'split';

type ActionId =
  | 'h2'
  | 'h3'
  | 'bold'
  | 'bullets'
  | 'numbered'
  | 'clause'
  | 'indent'
  | 'outdent'
  | 'link'
  | 'table'
  | 'paragraph';

const ACTIONS: Array<{ id: ActionId; label: string; title: string; mono?: boolean }> = [
  { id: 'h2', label: 'H2', title: 'Section heading', mono: true },
  { id: 'h3', label: 'H3', title: 'Sub-heading', mono: true },
  { id: 'bold', label: 'B', title: 'Bold', mono: true },
  { id: 'bullets', label: '• List', title: 'Bullet list' },
  { id: 'numbered', label: '1. List', title: 'Numbered list' },
  { id: 'clause', label: 'Clause', title: 'Legal clause (edit the number)' },
  { id: 'indent', label: '→', title: 'Indent (nest under the line above)' },
  { id: 'outdent', label: '←', title: 'Outdent' },
  { id: 'link', label: 'Link', title: 'Link' },
  { id: 'table', label: 'Table', title: 'Insert a table' },
  { id: 'paragraph', label: '¶', title: 'Paragraph (remove formatting)' },
];

const stripPrefix = (line: string) => line.replace(/^(\s*)(## |### |- |\d+\. )/, '$1');

interface DocumentEditorProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  rows?: number;
}

/**
 * Rich-text editor for long-form documents (legal / policy pages).
 *
 * The underlying value is the plain-text document format understood by
 * `renderDocument()` — the toolbar inserts that markup at the cursor and the
 * preview renders it exactly as the public page will. Content is never stored
 * or rendered as HTML, which is what keeps the public pages free of XSS.
 */
export default function DocumentEditor({ id, value, onChange, maxLength, rows = 28 }: DocumentEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>('split');

  /** Replace the selection (or whole lines around it) and restore focus. */
  const edit = (fn: (sel: { before: string; selected: string; after: string }) => { text: string; cursor: [number, number] }) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = fn({ before: value.slice(0, start), selected: value.slice(start, end), after: value.slice(end) });
    if (next.text.length > maxLength) return;
    onChange(next.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.cursor[0], next.cursor[1]);
    });
  };

  const wrap = (open: string, close: string, placeholder: string) =>
    edit(({ before, selected, after }) => {
      const inner = selected || placeholder;
      const text = `${before}${open}${inner}${close}${after}`;
      const s = before.length + open.length;
      return { text, cursor: [s, s + inner.length] };
    });

  /** Apply `transform` to every line touched by the selection. */
  const lines = (transform: (line: string, index: number) => string) =>
    edit(({ before, selected, after }) => {
      const lineStart = before.lastIndexOf('\n') + 1;
      const head = before.slice(0, lineStart);
      const block = before.slice(lineStart) + selected;
      const changed = block.split('\n').map(transform).join('\n');
      const text = `${head}${changed}${after}`;
      return { text, cursor: [head.length, head.length + changed.length] };
    });

  const insertBlock = (snippet: string) =>
    edit(({ before, selected, after }) => {
      const needsLead = before.length > 0 && !before.endsWith('\n');
      const lead = needsLead ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : '';
      const body = `${lead}${snippet}`;
      const text = `${before}${body}${selected ? '\n' + selected : ''}${after}`;
      const s = before.length + lead.length;
      return { text, cursor: [s, s + snippet.length] };
    });

  const runAction = (id: ActionId) => {
    switch (id) {
      case 'h2':
        return lines((l) => `## ${stripPrefix(l).trim()}`);
      case 'h3':
        return lines((l) => `### ${stripPrefix(l).trim()}`);
      case 'bold':
        return wrap('**', '**', 'bold text');
      case 'bullets':
        return lines((l) => `- ${stripPrefix(l).trim()}`);
      case 'numbered':
        return lines((l, i) => `${i + 1}. ${stripPrefix(l).trim()}`);
      case 'clause':
        return lines((l) => `1.1 ${stripPrefix(l).trim()}`);
      case 'indent':
        return lines((l) => `  ${l}`);
      case 'outdent':
        return lines((l) => l.replace(/^ {1,2}/, ''));
      case 'link':
        return wrap('[', '](https://)', 'link text');
      case 'table':
        return insertBlock('| Term | Meaning |\n| First term | What it means |\n| Second term | What it means |');
      case 'paragraph':
        return lines((l) => stripPrefix(l));
    }
  };

  const tabBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        mode === m ? 'bg-[#16263B] text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  const showEditor = mode !== 'preview';
  const showPreview = mode !== 'write';

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-slate-50 px-2 py-1.5">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.title}
            aria-label={a.title}
            onClick={() => runAction(a.id)}
            disabled={!showEditor}
            className={`rounded-md border border-transparent px-2 py-1 text-xs text-slate-700 transition-colors hover:border-gray-200 hover:bg-white disabled:opacity-40 ${
              a.mono ? 'font-semibold' : ''
            }`}
          >
            {a.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
          {tabBtn('write', 'Write')}
          {tabBtn('split', 'Split')}
          {tabBtn('preview', 'Preview')}
        </span>
      </div>

      <div className={`grid ${mode === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {showEditor && (
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
            className={`w-full resize-y px-3 py-2 font-tabular text-[13px] leading-[1.55] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#F5A523] ${
              mode === 'split' ? 'md:border-r md:border-gray-200' : ''
            }`}
          />
        )}
        {showPreview && (
          <div className="tp-prose max-h-[600px] overflow-auto bg-white px-5 py-4 text-[14px]" aria-label="Preview">
            {value.trim() ? (
              renderDocument(value)
            ) : (
              <p className="text-slate-400">Nothing to preview yet — start writing on the left.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
