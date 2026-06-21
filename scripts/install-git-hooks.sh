#!/usr/bin/env bash
# =============================================================================
# TerePay — Install Git Hooks
# =============================================================================
# Run once after cloning (or after changing the hook scripts):
#   bash scripts/install-git-hooks.sh
#
# This installs a pre-push hook that runs scripts/security-precheck.sh
# before every `git push`.  The hook blocks the push if any check fails.
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Resolve the hooks directory.
# In a git worktree the .git entry is a *file*, not a directory.
# We need to find the actual hooks directory in the main repository.
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"
HOOKS_DIR="$GIT_DIR/hooks"

# If we're in a worktree, git rev-parse --git-dir returns something like
# /path/to/repo/.git/worktrees/<name> — the hooks live one level up in the
# common .git directory.
if [ -f "$GIT_DIR/commondir" ]; then
  COMMON_DIR="$(cat "$GIT_DIR/commondir")"
  # commondir can be relative
  if [[ "$COMMON_DIR" != /* ]]; then
    COMMON_DIR="$GIT_DIR/$COMMON_DIR"
  fi
  HOOKS_DIR="$COMMON_DIR/hooks"
fi

mkdir -p "$HOOKS_DIR"

HOOK_FILE="$HOOKS_DIR/pre-push"

cat > "$HOOK_FILE" << 'HOOK'
#!/usr/bin/env bash
# TerePay pre-push hook — runs security-precheck.sh before every git push.
# Installed by scripts/install-git-hooks.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT="$REPO_ROOT/scripts/security-precheck.sh"

if [ ! -f "$SCRIPT" ]; then
  echo "⚠  security-precheck.sh not found — skipping pre-push security check"
  exit 0
fi

bash "$SCRIPT"
HOOK

chmod +x "$HOOK_FILE"

echo "✓  Pre-push hook installed at: $HOOK_FILE"
echo ""
echo "The hook will run 'bash scripts/security-precheck.sh' before every git push."
echo "To bypass in an emergency (strongly discouraged): git push --no-verify"
