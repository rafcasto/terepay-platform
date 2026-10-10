import type { ReactNode } from 'react';

/**
 * Render editable copy that may contain `**bold**` spans.
 *
 * This is the only markup the content editor supports. It is rendered as React
 * nodes (never `dangerouslySetInnerHTML`), so an editor cannot inject HTML —
 * everything outside the asterisks stays a plain text node.
 */
export function renderEmphasis(text: string): ReactNode {
  if (!text.includes('**')) return text;
  const parts = text.split('**');
  // Odd-indexed parts sit between a pair of `**` markers.
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}
