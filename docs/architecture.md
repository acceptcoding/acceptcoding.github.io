# ACCEPT architecture

## Runtime flow

The site uses plain HTML, CSS, and browser ES modules. The browser entry point is
`js/app.js`. It composes pure domain rules, browser adapters, and DOM rendering.
There is no frontend framework or runtime package dependency.

```text
HTML
  -> js/app.js
       -> core.js -> domain/* -> committed policy data
       -> js/ladder-repository.js -> runtime corpus + session storage
       -> js/persistence.js -> local storage schemas
       -> js/codeforces.js -> Codeforces API
       -> DOM rendering and navigation
```

`core.js` is a compatibility entry point. New domain code belongs in the
smallest cohesive module under `domain/`:

- `domain/dates.js` owns date validation, UTC boundaries, and week navigation.
- `domain/problems.js` owns problem identity, eligibility, exclusions, and
  historical filtering.
- `domain/selector.js` is the authoritative production source for the
  simulator-derived rating ladder: deterministic targets, soft slot/delta
  preferences, capacity-aware bucket choice, ladder construction, diagnostics,
  and visible ladder windows.
- `domain/history.js` owns canonical-history validation and hydration.
- `domain/account.js` owns level, submission, activity, and completion semantics.
- `domain/url-state.js` owns canonical levels, URL parsing, and share URLs.
- `domain/config.js` owns shared domain constants.

Domain modules do not import `window`, `document`, `fetch`, or browser storage.

## External boundaries

- `js/codeforces.js` owns request transport, timeout handling, pacing,
  pagination, and Codeforces API error conversion. ACCEPT interpretation stays
  in `domain/account.js`.
- `js/storage.js` is the low-level browser storage capability adapter.
- `js/ladder-repository.js` coordinates the bundled corpus, canonical-history
  precedence, deterministic selection, and the versioned session cache.
- `js/persistence.js` owns recent handles, known activity, and completion
  history. It preserves the existing keys and legacy recent-handle and known
  activity forms.

`js/app.js` owns UI state and presentation. It must not reimplement selector,
activity, completion, cache, or persistence policy.

## Adding a normal feature

1. Put a pure rule in `domain/` when the feature does not require browser or
   network state.
2. Put a browser or network effect in the smallest existing adapter when the
   feature crosses that boundary.
3. Coordinate a multi-boundary operation in the existing application entry
   point unless a new module owns a complete, repeated responsibility.
4. Add behavioral tests at the lowest boundary that can prove the behavior.
5. Run `npm test`, `npm run build`, and the relevant browser checks.
