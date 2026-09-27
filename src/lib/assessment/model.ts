/**
 * Ollama model names as the assessment worker knows them, e.g. `llama3.2:3b`,
 * `terepay-analyst` or `terepay-analyst:latest`. Pure helpers — safe to import
 * from client components.
 */

/** `[namespace/]name[:tag]` — the only shape the site will store or send to the worker. */
export const ASSESSMENT_MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,79}(:[a-zA-Z0-9][a-zA-Z0-9._-]{0,39})?$/;

export const ASSESSMENT_MODEL_MAX_LENGTH = 120;

export function isValidAssessmentModel(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= ASSESSMENT_MODEL_MAX_LENGTH &&
    ASSESSMENT_MODEL_PATTERN.test(value)
  );
}

/** Ollama treats a name without a tag as `:latest`. */
function canonical(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return trimmed.includes(':') ? trimmed : `${trimmed}:latest`;
}

/** True when two names refer to the same Ollama model (`x` and `x:latest` match). */
export function isSameAssessmentModel(a: string, b: string): boolean {
  return canonical(a) === canonical(b);
}
