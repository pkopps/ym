@AGENTS.md

## Claude Code notes

`AGENTS.md` (imported above) is the single source of truth for product guardrails, commands, and verification. Update it there, not here, so Codex and Claude Code stay in sync.

- Project Manager review: use the `yardmatch-project-manager` subagent or the `/yardmatch-progress-review` skill. Both are read-only reviewers that write only under `reports/progress/`.
- Before finishing a change, run the checks `AGENTS.md` lists for that kind of change and report exactly what ran.
- Never read or print `.env`, `.env.local`, or other local secret files. Use `.env.example` for variable names.
- Work on a feature branch and open a PR against `main`; don't push to `main` directly.
