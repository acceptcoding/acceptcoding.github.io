# Getting started (English)

## Run ACCEPT locally

1. Install Node.js 20 or newer and Git.
2. Clone the repository and enter its directory.
3. Run `npm test`.
4. Run `npm run build`.
5. Serve the directory with `python3 -m http.server 4173`.
6. Open `http://localhost:4173/`.

ES modules need HTTP. Opening `index.html` directly is not a supported local
mode.

## Main files

- `index.html`: daily training page.
- `core.js`: pure date, selector, level, and verification rules.
- `js/app.js`: browser state and DOM rendering.
- `js/codeforces.js`: the only Codeforces API adapter.
- `js/i18n.js`: user-facing PT, EN, and ES copy.
- `data/runtime-corpus.js`: checked-in runtime problem snapshot.
- `styles.css`: visual system and responsive layout.
- `docs/`: architecture, selector, persistence, deployment, and language notes.

## Fork and customize

Fork the repository on GitHub. Change the public branding in the HTML and
localized copy in `js/i18n.js`. Keep `core.js`, the selector salt, approved
contest policy, and persistence keys unchanged unless you also update their
behavioral tests and documentation.

## Deploy

There is no backend or secret required.

## Versioning

`package.json` is the authoritative version source. Use semantic versions. The
current public baseline is alpha `0.0.1`. Update the version and release notes
in one deliberate change, then run `npm test`, `npm run build`, and `git diff
--check`.
