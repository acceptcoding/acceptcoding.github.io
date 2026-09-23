# Selector contract

`domain/selector.js` is the authoritative production implementation. The
rating-range preview that originated this contract is retained outside the
repository at `accept-research/rating-range-simulator/`; it is a semantic
reference, not production code to copy literally.

The selector is deterministic. Do not change its algorithm, version, salt, or
window geometry without an explicit product decision, focused invariant tests,
and a replay comparison.

## Rating ladder

ACCEPT builds thirteen ordered positions, `Q0` through `Q12`, from exact-rating
buckets. The preferred slot windows are:

```text
Q0  800       Q1  900–1000  Q2  1000–1100 Q3  1200–1300
Q4  1400–1500 Q5  1500–1700 Q6  1700–1800 Q7  1900–2000
Q8  2100–2300 Q9  2400–2600 Q10 2700–2900 Q11 3000–3200
Q12 3300–3500
```

Preferred adjacent deltas are inclusive: `100–200` for Q0→Q6,
`200–300` for Q6→Q8, `200–400` for Q8→Q10, and `200–500` for Q10→Q12.
The leading `(0, 0)` entry in the Python preview is a placeholder for Q0 and
is not a production transition.

The preview enumerates 100-point values inside each window, starts Q0 at 800,
and for each next position prefers values satisfying the immediately previous
delta. If no value satisfies that delta, it chooses the value with the smallest
one-sided delta violation while remaining in that nominal window. Bounds are
inclusive. The preview's module-global Python randomness and exact sequence are
incidental; production uses a date-and-salt-derived local stream instead.

Production translates that guidance to the date-bounded inventory: it keeps
whole exact-rating buckets together, derives a seeded J13 target profile, and
uses a capacity-aware global DP to choose all positions. Slot-window and
adjacent-delta violations are soft penalties, not brittle eligibility gates.
This lets a sparse inventory use repeated exact ratings or a larger jump when
that is preferable to an incomplete or otherwise pathological ladder. The
optional `hard` mode is diagnostic/validation-only and rejects such deviations.

The following remain hard invariants in every mode:

- thirteen positions and thirteen distinct canonical stable IDs;
- nondecreasing ratings;
- no more members selected from an exact-rating bucket than it contains;
- deterministic output for the same eligible inventory, date, salt, and boundary;
- unavailable state rather than a partial ladder when distinct capacity is
  insufficient.

The named views are Q0–Q2, Q2–Q4, Q4–Q6, Q6–Q8, Q8–Q10, and Q10–Q12. The
separate `all` view projects Q0–Q12 and is never inferred as a training level.

## Inputs and order

For a selectable date, ACCEPT uses the bundled runtime corpus. The domain applies
eligibility, duplicate canonicalization, manual exclusions, approved-contest
policy, and the UTC historical completion boundary before rating buckets and
selection are built. Known-solved and completion-history data affect status
presentation, not selection or recurrence avoidance.

A canonical-history manifest entry has priority over reselection. A valid cache
entry is considered after the canonical manifest and before fallback selection.
The resolver rejects invalid dates before cache, corpus, or selection access.

## Date contract

Dates use the exact `YYYY-MM-DD` form. A date maps to the half-open UTC interval
from midnight at the selected date through midnight at the next date. Historical
contest data enters only when the contest has completed at or before that UTC
midnight. Submission verification uses the same interval.

## Empirical comparison

Run the compact cross-system replay with:

```sh
npm run compare:rating
```

`tools/compare-rating-range-simulator.mjs` samples seeded Python preview paths
and deterministic production ladders over the same geometry, then reports slot
and delta violations, position means, rating-signature diversity, sparse soft
fallback, deterministic reordering, and within-ladder distinctness. Exact
sequences are not expected to match: the preview is local and random, whereas
production must plan for bucket capacity and choose stable problem IDs.

## Testing

Test selector behavior through the exported domain functions. Test the resolver
through `js/ladder-repository.js` with injected corpus and storage where a
boundary or cache decision matters. Do not test private helper names or require a
particular file layout for behavioral claims.
