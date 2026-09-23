# ACCEPT Coding Club

ACCEPT Coding Club is a small static daily programming-practice application. Each date resolves one deterministic thirteen-problem ladder. The selected training level is a three-problem window over that ladder; adjacent named levels share one problem.

The visible identity is **ACCEPT Coding Club**: a plain teal speech balloon beside the two-line product name, a thin CSS separator, and a left-aligned three-line EPT block. The localized EPT lines are:

- PT: `Exercícios` / `Prática &` / `Técnica`
- EN: `Everyday` / `Practice &` / `Training`
- ES: `Ejercicios` / `Práctica y` / `Técnica`

The ACCEPT name is inspired by ACCEPT @ Unochapecó 2013 — Algorithms, Contests, Computing Environment, Programming and Training. This project is a contemporary reinterpretation of that historical lineage; the current product name is not presented as a reconstruction of the 2013 expansion.

## Authorship and license

Created by **Leonardo Deliyannis Constantin** — [@leodeliyannis](https://github.com/leodeliyannis), Passo Fundo, RS, Brasil.

ACCEPT is distributed under the [MIT License](LICENSE).

## Architecture

- Plain HTML, CSS, and browser JavaScript; no framework or runtime dependency.
- `core.js` owns local-browser date rules, eligibility, deterministic selection, ladder windows, rank inference, and submission semantics.
- `js/codeforces.js` is the only API adapter.
- `js/app.js` owns DOM state, URL state, handle/profile state, verification, and calendar navigation.
- `js/i18n.js` contains PT, EN, and ES copy.
- `previous.html` is the calendar source template. The public archive is
  `/{lang}/challenges/`, and each date has the permanent URL
  `/{lang}/challenges/YYYY-MM-DD/`. The old `/{lang}/previous/` paths remain
  compatibility aliases.
- `first-ac.html` is a short, beginner-oriented path to a first Accepted.
- `materials.html` is a curated multilingual resource list.

## Frontend UI invariants

- The home page renders the current domain topology from `core.TRAINING_STAGE_KEYS` and `core.visibleProblems(...)`; the presentation must not assume a historical number of levels or problems.
- The level rail remains one native horizontal button strip at every viewport. On narrow screens it scrolls horizontally, exposes a short swipe cue, and adds end padding so the active level can be fully read.
- The four-column problem grid preserves logical alignment: difficulty, one combined title-plus-ID link, and a semantic completion status. Blank, known, wrong, and current states are not communicated by color alone.
- Language and theme preferences are applied before first paint on every route. Guide pages may retain multilingual resource content when the resource language is part of its meaning, but route navigation and shared controls stay localized.
- The site is intentionally static: validate with `npm test` and `npm run build`, then inspect rendered routes at desktop and approximately 390/360/320 px widths before release.

## Local development

ES modules need HTTP. From this directory:

```sh
npm test
npm run build
python3 -m http.server 4173
```

Open <http://localhost:4173/>. GitHub Pages can publish this directory as-is;
the build command only validates the static source and does not create a
generated directory.

`npm run build` is a small static validation command. It checks required entry
files and authored JavaScript syntax; it does not create a backend or bundle.
The complete setup and fork instructions are available in
[`docs/getting-started.md`](docs/getting-started.md),
[`docs/getting-started.pt-BR.md`](docs/getting-started.pt-BR.md),
[`docs/getting-started.es.md`](docs/getting-started.es.md), and
[`docs/release-process.md`](docs/release-process.md).

Technical documentation indexes are available in [English](docs/en/index.md),
[Português do Brasil](docs/pt-BR/index.md), and [español](docs/es/index.md).

## Deployment

GitHub Pages publishes the repository root as a static site. The workflow in
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the test and
static validation gates before deployment. A fork can enable Pages with GitHub
Actions and keep the same root-path layout. There is no backend or server-side
account storage.

## Dates and selection

The user's local browser date and time zone determine which calendar date is today. Each explicit `YYYY-MM-DD` date is interpreted at canonical UTC-midnight boundaries, so the same selectable date produces the same eligible inventory, exact-rating buckets, and ladder in every timezone. The first public ACCEPT date is `2026-09-21`. Dates before it and dates after today cannot produce a daily ladder. The first public date reuses the existing `2026-09-01` selection seed, so no prepared problemset is discarded.

Q0 through Q12 are positions selected jointly by the current `j13-six-stage-trial-v2-seeded-profile` selector, not thirteen independent pools or hard rating ranges. The preferred slot windows are `800`, `900–1000`, `1000–1100`, `1200–1300`, `1400–1500`, `1500–1700`, `1700–1800`, `1900–2000`, `2100–2300`, `2400–2600`, `2700–2900`, `3000–3200`, and `3300–3500`. Transitions Q0→Q6 prefer `100–200`; Q6→Q8 prefer `200–300`; Q8→Q10 prefer `200–400`; Q10→Q12 prefer `200–500`. Each date derives a salted target profile inside these windows and compatible delta ranges using one seed and a local xorshift32 stream, consuming one draw per position; the target profile changes the soft objective but never expands the hard contract. A capacity-aware global DP chooses the thirteen positions jointly; deterministic bucket-local hashing then chooses thirteen distinct IDs. If the eligible inventory cannot supply thirteen distinct problem IDs under the rating-bucket capacity rules, the ladder is unavailable rather than silently showing an incomplete set. Problems without a finite numeric Codeforces rating remain ineligible. The six named windows are Q0–Q2, Q2–Q4, Q4–Q6, Q6–Q8, Q8–Q10, and Q10–Q12. The final `legend` window is an ACCEPT challenge stage spanning the supported 3300–3500 upper tail, not a claim that the corpus contains problems above its current 3500 ceiling.

The selection salt is `accept-daily-selection-v5-language-aware-whole-rating`, independent of the `j13-six-stage-trial-v2-seeded-profile` selector version. Cache compatibility uses the separate `daily-ladder-v16` namespace and `v16` schema, so older computed results are not reused. `core.ladderDiagnostics()` provides pure per-window spans, internal gaps, median, p90, and global Q transition diagnostics for replay and review. Production ladder resolution uses the checked-in `data/runtime-corpus.js` snapshot and does not call Codeforces during page load; its provenance records the source snapshot hashes and its import has a content-derived cache key. The committed `data/canonical-history-manifest.js` remains the future canonical source: a covered date returns its stored ordered IDs first, then hydrates metadata from the same static corpus without reselection. The offline generators validate pinned snapshots and require `--write`. This is not cryptographic secrecy.

English-statement prevention uses the small production artifact `data/english-statement-exclusions.js`. It contains the confirmed unavailable stable ID `524:A` and the measured title-language contest exclusions `648`, `649`, and `929`. A contest is excluded by this preventive rule only when every currently eligible title has substantive Cyrillic text and no Latin alphabetic text; one-character homoglyphs are not sufficient. Contest 524 remains mixed and is not excluded. Unknown or transient page-audit states are not converted into exclusions. The artifact is applied before historical filtering, pool construction, selection, and ladder-cache validation. The research audit and its resumable page cache remain outside this repository.

The main week navigator always starts Sunday. The launch week is Sunday `2026-09-20` through Saturday `2026-09-26`; September 20 is visible for orientation but disabled. The calendar page starts at September 2026 and cannot browse before the launch month or beyond the month containing the current ACCEPT date.

## Persistence and levels

Language selection uses an explicit saved choice first. Without one, only the browser's primary preferred language is inspected: `pt-*` selects Portuguese, `es-*` selects Spanish, and every other value falls back to English. The inferred language is not saved, and the document language is updated to the exact `pt`, `en`, or `es` code. The visible theme order is Light, Dark, System; the stored keys remain `light`, `dark`, and `system`, with System following `prefers-color-scheme`.

These localStorage keys are used:

- `accept-language`
- `accept-theme` — the explicit `light`, `system`, or `dark` theme preference.
- `accept-recent-handles-v1` — up to twelve normalized handles whose Codeforces profiles were successfully loaded for autocomplete;
  selecting one still requires explicit synchronization.
- `accept-known-solved` — one disposable JSON object mapping normalized handles to `{ accepted: [], unsuccessful: [] }` stable problem IDs; legacy handle-to-array values migrate as accepted IDs. It is partial known activity, not a completion history or source of truth.
- `accept-completion-history-v1` — minimal JSON mapping normalized handles to
  completed dates: `history[handle][date] = true`. A date is written only after
  a qualifying Accepted is verified for the visible challenge.

The ladder cache uses `sessionStorage` under the salted `daily-ladder-v16` key
namespace. It is disposable and validated by date, UTC boundary, schema, and
ladder size before reuse.

The initial Newbie display is only a default. It is not an explicit level choice. The input value and successfully loaded handle are separate: account metadata, completion, and status markers project only when the normalized input matches the loaded handle. Account state is session-only; a reload does not restore or automatically query a handle. Recent handles remain a separate convenience autocomplete history, and selecting one still requires explicit synchronization. Editing hides the old projection without destroying it; restoring the matching input restores it locally without a request. A successful first/different-handle sync infers that account's level and owns the inferred provenance. Manual selection is owned by the loaded handle, survives date changes and same-handle refreshes, and is discarded when a different handle syncs.

URL state is `?date=YYYY-MM-DD&level=newbie|pupil|special|expert|master|legend&view=all`. Legacy `div4`, `div3`, `div2`, and `div1` values remain accepted as aliases and canonicalize to `pupil`, `special`, `expert`, and `master`; legacy `level=specialist` canonicalizes to `special`. The level parameter is added for a non-default selected level; inferred navigation carries `level-source=inferred`, while manual selection remains the ordinary canonical level URL. `view=all` is a separate overview over Q0–Q12; legacy `level=all` is accepted and normalized to that view, but `all` is never a training-level identifier or inferred from an account. Share links preserve only this canonical challenge context; they do not add UTM or referral parameters because the site has no analytics or shared-arrival behavior that would justify them.

Problem rating colors continue to use the separate `--cf-*` tokens for problem difficulty. Account rank colors use a distinct ACCEPT palette built around the site's teal, green, blue, violet, amber, and coral roles; they are not copied from Codeforces. Account rank names remain the official Codeforces names in every UI language, including `unrated`, `tourist`, and `Headquarters`. LGM uses an ACCEPT-adapted split treatment (first letter uses the site grandmaster coral, remaining letters use the site ink); `tourist` uses the inverse special treatment. Dark-mode colors are brighter adaptations for contrast.

## API and verification

The daily ladder reads the static runtime corpus; it does not request `problemset.problems` or `contest.list` from each browser. The Codeforces adapter retains those catalog methods for maintenance tooling and keeps `user.info` and `user.status` as separate optional handle-verification methods. All adapter requests are serialized with the documented two-second minimum interval and carry an eight-second abort timeout, so a stalled Codeforces connection exits the loading state instead of leaving the ladder spinner indefinitely. The single icon-only handle-form action (`Carregar handle do Codeforces` / `Atualizar dados do Codeforces`, `Load Codeforces handle` / `Refresh Codeforces data`, `Cargar handle de Codeforces` / `Actualizar datos de Codeforces`) runs the user verification transaction.

A qualifying `OK` submission inside the selected canonical date interval produces a derived `Feito!` / `Done!` / `¡Listo!`; an API/network error produces no completion conclusion and a localized refresh error. Current-date Accepted outranks current-date unsuccessful attempts; otherwise known accepted activity outranks known unsuccessful activity. Strong/faint markers and verification results are keyed by normalized handle plus date, so switching levels does not repeat the request. Every terminal Accepted or unsuccessful attempt encountered during that legitimate status fetch is opportunistically merged into `accept-known-solved`; faint markers mean only that ACCEPT knows about activity, not that the user has never solved an unmarked problem. The derived completion result is read-only; the handle form is the only explicit synchronization action.

Unfrozen historical selection is deterministic against the checked-in static corpus and approved policy. Canonical manifest dates are ID-stable and do not require the selector implementation; canonical metadata must still pass the same eligibility and approved-contest validation. Dates without manifest entries use the fixed selector against the committed corpus. A corpus refresh requires a new corpus version and replay report if published historical behavior must remain immutable.

## Gym research decision

Gym remains outside the normal ladder. The official API documents `contest.list?gym=true` as contest metadata, while `problemset.problems` is the rated problem catalog. The current anonymous Gym contest response does not provide a corresponding problem inventory or per-problem official rating scale. Gym problems would therefore lack, in one simple public source, the stable catalog, compatible official 800–3500 rating, historical eligibility, and clean verification contract required by ACCEPT.

Third-party predicted ratings would introduce a separate methodology, coverage, availability, CORS, rate-limit, and maintenance dependency. That is not justified for the primary daily loop. A future separate Experimental/Gym mode could be reconsidered, but Gym is not silently mixed into Q0–Q12.

## Product pages

The product remains focused on one action: pick a level, get three problems,
solve one. The First AC page explains online judges, input/output, submission,
WA, compilation errors, and the next step after an Accepted. Materials are
links, not copied third-party content.

## Development checks

```sh
npm test
```

For deterministic local date testing, `dev-now=YYYY-MM-DD` is accepted only on localhost and `127.0.0.1`; it is not persisted and is ignored in production. Example:

```text
http://localhost:4173/?dev-now=2026-09-12&date=2026-09-01
```

The browser test page is `tests/core.test.html`. Daily ladder states do not require Codeforces network access; handle/status verification still does.

All requested dates are canonicalized and checked by the same UTC-midnight boundary validator before cache access, historical filtering, or Codeforces resolution. Public URL/UI/cache paths do not expose future ladders. This is not cryptographic secrecy: the deterministic selection algorithm remains client-side, so organizer secrecy requires a separate server-side design.

## Deployment

Publish this directory as a GitHub Pages source. No backend, database, OAuth,
bundler, service worker, or account system is required.
