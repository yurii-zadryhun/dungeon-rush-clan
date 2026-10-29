# Repository instructions for contributors and coding agents

This project commits directly to `master`. Make changes in the source files and
submit already-formatted code.

## Permanent CI policy

- `.github/workflows/check.yml` is **read-only validation**, not an autoformatter.
- Keep `permissions: contents: read`.
- Keep `npm run format:check` and `node scripts/ci-contract-check.mjs`.
- Never add `contents: write`, Prettier `--write`, `npm run format`,
  `git commit` or `git push` steps to the Check workflow.
- Do not temporarily change the workflow to get past a formatting failure and
  then revert it in a second commit. This causes redundant runs and deployments.

## Before committing

1. Run `npm run format` locally (or `npx prettier --write <changed-files>`).
2. Run `npm run format:check`.
3. Run relevant tests and build checks.
4. Commit the formatted code **directly**. Fix failing checks in the source,
   never by enabling CI write access.

If code is written through the GitHub API or another tool that bypasses local
Git hooks, the same format-before-commit rule still applies. The CI check does
not change this.

For local clones, `npm run hooks:install` installs the tracked pre-commit
validation hook without any extra dependencies. The hook checks formatting; it
does not modify staged changes.
