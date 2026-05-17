'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload, File as FileIcon, Trash } from './Icons';

interface DropZoneProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  onFiles: (files: File[]) => void;
  files?: Array<{ name: string; size?: number; status?: 'uploading' | 'done' | 'error'; progress?: number }>;
  onRemove?: (index: number) => void;
  hint?: string;
}

function fmtBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DropZone({
  accept = '.pdf,.csv,image/*',
  multiple = true,
  maxSizeMb = 10,
  onFiles,
  files = [],
  onRemove,
  hint,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= maxSizeMb * 1024 * 1024);
    if (arr.length) onFiles(arr);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e: DragEvent<HTMLButtonElement>) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent<HTMLButtonElement>) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        className={`w-full rounded-2xl border-2 border-dashed transition-colors p-6 text-center ${
          over ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2/40 hover:border-accent/50 hover:bg-accent-soft/40'
        }`}
      >
        <div className="mx-auto h-10 w-10 rounded-full bg-accent-soft text-accent-2 flex items-center justify-center mb-2">
          <Upload size={20} />
        </div>
        <p className="text-sm font-semibold text-text">Drop files here or click to upload</p>
        <p className="text-xs text-muted mt-1">
          {hint ?? `PDF, CSV, or images · up to ${maxSizeMb} MB each`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handle(e.target.files)}
        />
      </button>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface"
            >
              <FileIcon size={18} className="text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{f.name}</p>
                <p className="text-xs text-muted">
                  {fmtBytes(f.size)}
                  {f.status === 'uploading' && ` · ${f.progress ?? 0}%`}
                  {f.status === 'done' && ' · Uploaded'}
                  {f.status === 'error' && ' · Failed'}
                </p>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label="Remove file"
                  className="p-1 text-muted hover:text-danger transition-colors"
                >
                  <Trash size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
