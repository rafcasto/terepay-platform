# Git Workflow

**`dev` is the integration branch for all work. `main` is not the default target.**

This is a hard rule for every contributor and every agent working in this repo.

## Branching

- **Always branch from `dev`.** Never branch from `main` for feature, fix, or chore work.
- Keep your local `dev` up to date before branching.

```bash
git checkout dev
git pull origin dev
git checkout -b <type>/<short-description>
```

Branch name prefixes:

| Prefix | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Tooling, deps, config, docs |
| `refactor/` | Internal changes, no behaviour change |

## After completing any change — build, then commit and push

Every time a change is completed, run a build first and only commit and push if it passes.

```bash
npm run build          # must pass — surfaces type errors
git add -A
git commit -m "<type>: <what changed>"
git push               # pre-push hook runs scripts/security-precheck.sh
```

- **Do not commit or push if the build fails.** Fix the errors first, then re-run the build.
- **Never bypass git hooks** with `--no-verify` — the pre-push security check must run.
- If on `main`, stop and move the work onto a `dev`-based branch before committing.

## Pull requests

- **Always open pull requests against `dev`** as the base branch. Never target `main`.
- `main` is updated only via a release PR from `dev`, handled separately.

```bash
git push -u origin <type>/<short-description>
gh pr create --base dev --head <type>/<short-description>
```

When using the GitHub UI, set the **base branch to `dev`** before creating the PR.

## Checklist before opening a PR

- [ ] Branched from `dev` (not `main`)
- [ ] PR base branch is `dev`
- [ ] `npm run build` passes (surfaces type errors)
- [ ] `npm run lint` passes
- [ ] `bash scripts/security-precheck.sh` passes (also runs on pre-push)
- [ ] Do **not** bypass git hooks with `--no-verify`

## For agents

When completing ANY change in this repo:

1. Branch MUST start from `dev` — if on `main`, switch to `dev` first.
2. Run `npm run build` before committing. Do not commit or push on a failing build.
3. After a passing build, `git commit` and `git push` the change.
4. Every `gh pr create` MUST include `--base dev`.
5. Never use `--no-verify`.
