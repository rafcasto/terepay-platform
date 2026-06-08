#!/usr/bin/env bash
# =============================================================================
# TerePay — Security Pre-Push Check
# =============================================================================
# Runs automatically before `git push` via the git pre-push hook.
# Install the hook once per clone:  bash scripts/install-git-hooks.sh
# Run manually at any time:         bash scripts/security-precheck.sh
#
# Exit 0 = all clear (push allowed)
# Exit 1 = one or more checks failed (push blocked)
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

overall=0   # 0 = all pass, 1 = at least one failure

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "${GREEN}  ✓${RESET}  $1"; }
fail() { echo -e "${RED}  ✗${RESET}  $1"; overall=1; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $1"; }
section() { echo -e "\n${CYAN}${BOLD}── $1 ${RESET}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   TerePay Security Pre-Push Check                ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# =============================================================================
# 1. SECRETS IN STAGED / TRACKED SOURCE FILES
# =============================================================================
section "1. Secret Detection"

# Block .env files from being staged
if git diff --cached --name-only 2>/dev/null | grep -qE '(^|/)\.env(\.|$)|serviceAccount.*\.json|\.pem$|\.key$'; then
  fail "Sensitive file detected in staged changes (env file, service account, or key file):"
  git diff --cached --name-only | grep -E '(^|/)\.env(\.|$)|serviceAccount.*\.json|\.pem$|\.key$' | while read -r f; do
    echo "       → $f"
  done
else
  pass "No .env / key files staged"
fi

# Check for hardcoded secrets in src/ and scripts/ (TypeScript/TSX/JS only)
SECRET_PATTERNS=(
  'AIza[A-Za-z0-9_-]{35}'           # Google API key
  'sk_live_[A-Za-z0-9]{24}'         # Stripe live key
  'AC[a-f0-9]{32}'                   # Twilio account SID
  '"private_key":\s*"-----BEGIN'    # Inline service account JSON
)

found_secret=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  hits=$(grep -rnE "$pattern" src/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    if [ "$found_secret" -eq 0 ]; then
      fail "Possible hardcoded secret detected:"
      found_secret=1
    fi
    echo "$hits" | head -5 | while read -r line; do echo "       → $line"; done
    overall=1
  fi
done
[ "$found_secret" -eq 0 ] && pass "No hardcoded secret patterns found in source"

# Warn if any NEXT_PUBLIC_ var looks unusually long (may be a secret)
if [ -f .env.local ]; then
  if grep -qE "^NEXT_PUBLIC_[A-Z_]+=.{60,}" .env.local 2>/dev/null; then
    warn "Some NEXT_PUBLIC_ env vars are unusually long — verify they contain no secrets:"
    grep -E "^NEXT_PUBLIC_[A-Z_]+=.{60,}" .env.local | sed 's/=.*/=***/' | while read -r l; do echo "       → $l"; done
  fi
fi

# =============================================================================
# 2. AUTH / AUTHORISATION CHECKS
# =============================================================================
section "2. Auth & Authorisation"

# Auth endpoints (/api/auth/*) are intentionally session-free — they ARE the
# login/signup surface. Exclude them from the withAuth() check.
# All other mutation endpoints must call withAuth().
missing_auth=()
while IFS= read -r -d '' file; do
  # Skip the auth bootstrapping routes (these cannot require a session)
  if [[ "$file" == */api/auth/* ]]; then
    continue
  fi
  if grep -qE "export async function (POST|PUT|PATCH|DELETE)" "$file"; then
    if ! grep -q "withAuth" "$file"; then
      missing_auth+=("$file")
    fi
  fi
done < <(find src/app/api -name "route.ts" -print0 2>/dev/null)

if [ "${#missing_auth[@]}" -gt 0 ]; then
  fail "Non-auth API route(s) with mutation handlers missing withAuth():"
  for f in "${missing_auth[@]}"; do echo "       → ${f#$ROOT/}"; done
else
  pass "All non-auth mutation route handlers reference withAuth()"
fi

# No route body should accept a 'role' field from the client
if grep -rqE "\bparsed\.role\b|\bbody\.role\b" src/app/api --include="*.ts" 2>/dev/null; then
  fail "A route accepts 'role' from the client body — role must only be set server-side via Firebase custom claims"
  grep -rnE "\bparsed\.role\b|\bbody\.role\b" src/app/api --include="*.ts" 2>/dev/null | head -5 | while read -r line; do echo "       → $line"; done
else
  pass "No client-accepted 'role' field in API routes"
fi

# =============================================================================
# 3. RATE LIMITING
# =============================================================================
section "3. Rate Limiting"

# Auth routes have dedicated limiters (authLoginLimiter etc.) — not checkRateLimit.
# Exclude /api/auth/* from the generic checkRateLimit scan.
missing_rl=()
while IFS= read -r -d '' file; do
  if [[ "$file" == */api/auth/* ]]; then continue; fi
  if grep -qE "export async function (GET|POST|PUT|PATCH|DELETE)" "$file"; then
    if ! grep -q "checkRateLimit" "$file"; then
      missing_rl+=("$file")
    fi
  fi
done < <(find src/app/api -name "route.ts" -print0 2>/dev/null)

if [ "${#missing_rl[@]}" -gt 0 ]; then
  warn "API route(s) missing checkRateLimit() — verify each is intentional:"
  for f in "${missing_rl[@]}"; do echo "       → ${f#$ROOT/}"; done
  echo "       (Rate limiting fails open — warning only. Add checkRateLimit() to each unprotected route.)"
else
  pass "All non-auth route files reference checkRateLimit()"
fi

# =============================================================================
# 4. PII IN LOGS
# =============================================================================
section "4. PII in Logs"

pii_log_patterns=(
  'console\.log\(.*\bemail\b'
  'console\.log\(.*\bpassword\b'
  'console\.log\(.*\btoken\b'
  'console\.log\(.*\bdateOfBirth\b'
  'console\.log\(.*\baccountNumber\b'
  'console\.log\(.*\buser\b.*\{' # console.log(user) or console.log({ user })
)

found_pii_log=0
for pattern in "${pii_log_patterns[@]}"; do
  hits=$(grep -rnE "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    if [ "$found_pii_log" -eq 0 ]; then
      fail "Possible PII in console.log — use structured logging with IDs only:"
      found_pii_log=1
    fi
    echo "$hits" | head -3 | while read -r line; do echo "       → $line"; done
    overall=1
  fi
done
[ "$found_pii_log" -eq 0 ] && pass "No obvious PII in console.log statements"

# =============================================================================
# 5. ERROR HANDLING — NO RAW ERROR FORWARDING
# =============================================================================
section "5. Error Handling"

# Detect patterns like: return NextResponse.json({ error: err }) — raw error object
if grep -rqE "NextResponse\.json\(\{\s*error:\s*err\b" src/app/api --include="*.ts" 2>/dev/null; then
  fail "Raw error object returned to client — use errorResponse() or internalError() instead"
  grep -rnE "NextResponse\.json\(\{\s*error:\s*err\b" src/app/api --include="*.ts" 2>/dev/null | head -5 | while read -r line; do echo "       → $line"; done
else
  pass "No raw error objects forwarded to client"
fi

# =============================================================================
# 6. TYPESCRIPT — NO `any` IN SERVER-SIDE CODE
# =============================================================================
section "6. TypeScript — No 'any' in API / lib code"

# Only check API routes and lib/ (not UI components where any has lower risk).
# Exclude: comments (lines starting with //), z.any() (Zod wildcard — intentional),
# and eslint-disable directives.
any_hits=$(grep -rnE "(:\s*any\b|<any>|\bas any\b)" src/app/api src/lib --include="*.ts" 2>/dev/null \
  | grep -v "^\s*//" \
  | grep -v "z\.any()" \
  | grep -v "eslint-disable" \
  || true)

if [ -n "$any_hits" ]; then
  warn "TypeScript 'any' used in API/lib code — each usage should be justified:"
  echo "$any_hits" | head -8 | while read -r line; do echo "       → $line"; done
else
  pass "No TypeScript 'any' in API routes or lib/"
fi

# =============================================================================
# 7. CLIENT-SIDE FIRESTORE WRITES
# =============================================================================
section "7. No Direct Client Firestore Writes"

# Firestore write calls should only appear in route.ts files (server), not in
# client components (.tsx or non-route .ts files in app/).
client_writes=$(grep -rnE "\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\(" \
  src/app src/hooks src/components --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v "route\.ts" \
  | grep -v "__tests__" \
  || true)

if [ -n "$client_writes" ]; then
  fail "Direct Firestore write calls found in client code — all writes must go through /api/*:"
  echo "$client_writes" | head -5 | while read -r line; do echo "       → $line"; done
else
  pass "No direct Firestore write calls in client components"
fi

# =============================================================================
# 8. CRYPTO QUALITY — NO Math.random() IN SECURITY-SENSITIVE CODE
# =============================================================================
section "8. Crypto Quality"

# Only flag Math.random() in server-side code (api/ and lib/) — UI components
# legitimately use it for generating unique element IDs (accessibility).
mathrand_hits=$(grep -rnE "\bMath\.random\(\)" src/app/api src/lib --include="*.ts" 2>/dev/null || true)

if [ -n "$mathrand_hits" ]; then
  fail "Math.random() used in server/lib code — use crypto.randomBytes() or randomUUID() for any security-relevant value:"
  echo "$mathrand_hits" | head -5 | while read -r line; do echo "       → $line"; done
else
  pass "No Math.random() in server-side code (API routes / lib)"
fi

# =============================================================================
# 9. AUDIT LOG COVERAGE
# =============================================================================
section "9. Audit Log Coverage"

# Routes that create/modify state should call auditLog().
# Exclude read-only routes and known acceptable gaps with a comment.
missing_audit=()
while IFS= read -r -d '' file; do
  if grep -qE "export async function (POST|PUT|PATCH|DELETE)" "$file"; then
    if ! grep -q "auditLog" "$file"; then
      missing_audit+=("$file")
    fi
  fi
done < <(find src/app/api -name "route.ts" -print0 2>/dev/null)

if [ "${#missing_audit[@]}" -gt 0 ]; then
  warn "Mutation route(s) missing auditLog() — add audit logging or confirm these are truly read-only:"
  for f in "${missing_audit[@]}"; do echo "       → ${f#$ROOT/}"; done
else
  pass "All mutation route files reference auditLog()"
fi

# =============================================================================
# 10. DEPENDENCY VULNERABILITIES
# =============================================================================
section "10. Dependency Vulnerabilities"

echo "     Running npm audit --production…"
audit_json=$(npm audit --production --json 2>/dev/null || true)

critical=0; high=0; total=0
if [ -n "$audit_json" ]; then
  eval "$(echo "$audit_json" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    v = d.get('metadata', {}).get('vulnerabilities', {})
    c = v.get('critical', 0)
    h = v.get('high', 0)
    t = sum(v.values())
    print(f'critical={c}; high={h}; total={t}')
except:
    print('critical=0; high=0; total=0')
" 2>/dev/null || echo 'critical=0; high=0; total=0')"
fi

if [ "$critical" -gt 0 ] || [ "$high" -gt 0 ]; then
  fail "npm audit: $critical critical, $high high severity vulnerabilities (total: $total)"
  echo "       Run 'npm audit --production' for remediation details"
else
  pass "npm audit: no critical/high vulnerabilities (total: $total)"
fi

# =============================================================================
# 11. ESLint
# =============================================================================
section "11. Lint"

lint_output=$(npm run lint --silent 2>&1 || true)
lint_errors=$(echo "$lint_output" | grep -c "^\s*[0-9]\+:[0-9]\+\s\+error" 2>/dev/null || true)

if [ "${lint_errors:-0}" -gt 0 ]; then
  fail "ESLint: $lint_errors error(s) — run 'npm run lint' for details"
  echo "$lint_output" | grep "error" | head -8 | while read -r line; do echo "       $line"; done
else
  warn_count=$(echo "$lint_output" | grep -c "warning" 2>/dev/null || true)
  if [ "${warn_count:-0}" -gt 0 ]; then
    pass "ESLint passed (${warn_count} warning(s) — fix before next push)"
  else
    pass "ESLint passed"
  fi
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────${RESET}"
if [ "$overall" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✓  All security checks passed. Push allowed.${RESET}"
  echo ""
  echo -e "  ${YELLOW}Reminder:${RESET} automated checks cannot replace a manual review."
  echo "  For new API routes, auth flows, or PII changes, read the"
  echo "  relevant sections of docs/SECURITY_AUDIT.md before pushing."
  echo -e "${BOLD}──────────────────────────────────────────────────${RESET}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}  ✗  Security check(s) failed. Push blocked.${RESET}"
  echo ""
  echo "  Fix the issues above, then re-run:"
  echo "    bash scripts/security-precheck.sh"
  echo ""
  echo "  Full audit reference: docs/SECURITY_AUDIT.md"
  echo -e "${BOLD}──────────────────────────────────────────────────${RESET}"
  echo ""
  exit 1
fi
