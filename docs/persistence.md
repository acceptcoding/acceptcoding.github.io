# ACCEPT persistence

ACCEPT has no server-side account store. Browser state is local to the visitor.

## Preferences

- `accept-language` stores the selected presentation language.
- `accept-theme` stores `light`, `dark`, or `system`.

The HTML pages read these preferences during the pre-paint bootstrap. Runtime
preference controls update the same keys.

## Session ladder cache

`js/ladder-repository.js` stores ladders in `sessionStorage` under the existing
salted `daily-ladder-v16` namespace. Each envelope contains `version`, `boundary`,
`date`, and a validated thirteen-problem `ladder`.

The cache is disposable. Invalid dates are rejected before storage access.
Invalid envelopes are ignored. The canonical-history manifest remains ahead of
cache lookup. Cache failures do not prevent a fresh deterministic resolution.

## Local activity

`js/persistence.js` owns these local keys:

- `accept-recent-handles-v1` stores at most twelve recent handles. Legacy string
  entries remain readable.
- `accept-known-solved` stores partial per-handle accepted and unsuccessful
  activity. Legacy handle-to-array entries remain readable as accepted IDs.
- `accept-completion-history-v1` stores per-handle, per-date boolean completion.

Known activity is partial and disposable. It is not evidence that an unmarked
problem was never solved. Completion is recorded only after a qualifying
accepted problem is verified for the visible selection.

Do not rename keys or change schemas silently. Add an explicit, idempotent
migration and tests when a schema change is necessary.
