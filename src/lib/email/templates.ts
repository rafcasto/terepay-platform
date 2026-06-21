import { adminDb } from '@/lib/firebase/admin';
import { EMAIL_DEFAULT_TEMPLATES } from './default-templates';
import type { EmailTemplateType } from '@/types/admin';

/**
 * Template resolution + rendering for transactional emails.
 *
 * Resolution order for a given template type:
 *   1. The active admin-authored template in Firestore (`emailTemplates`).
 *   2. The built-in default in `default-templates.ts`.
 *
 * This means admins can fully customise an email through the admin UI, but the
 * system still works (with branded defaults) before any template is authored.
 */

export interface ResolvedTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Substitute `{{variableName}}` tokens. Unknown tokens render as empty strings. */
export function renderMergeFields(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '');
}

async function getActiveTemplate(type: EmailTemplateType): Promise<ResolvedTemplate | null> {
  try {
    // Single-field equality filter — no composite index required. We pick the
    // active template in code to avoid an extra `isActive` composite index.
    const snap = await adminDb
      .collection('emailTemplates')
      .where('type', '==', type)
      .limit(10)
      .get();

    const active = snap.docs.map((d) => d.data()).find((d) => d.isActive === true);
    if (active?.subject && active?.htmlBody && active?.textBody) {
      return {
        subject: active.subject as string,
        htmlBody: active.htmlBody as string,
        textBody: active.textBody as string,
      };
    }
  } catch (err) {
    console.error('[email] Failed to load template, using default:', err instanceof Error ? err.name : 'unknown');
  }

  const fallback = EMAIL_DEFAULT_TEMPLATES[type];
  return fallback
    ? { subject: fallback.subject, htmlBody: fallback.htmlBody, textBody: fallback.textBody }
    : null;
}

/**
 * Resolve a template by type and render it with the given merge variables.
 * Returns `null` if no template (or default) exists for the type.
 */
export async function renderEmail(
  type: EmailTemplateType,
  vars: Record<string, string>,
): Promise<RenderedEmail | null> {
  const template = await getActiveTemplate(type);
  if (!template) return null;

  return {
    subject: renderMergeFields(template.subject, vars),
    html: renderMergeFields(template.htmlBody, vars),
    text: renderMergeFields(template.textBody, vars),
  };
}
