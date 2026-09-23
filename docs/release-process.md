# Release procedure

ACCEPT uses semantic versioning. `package.json` is the single authoritative
version source. The current public baseline is alpha `0.0.1`.

For a release:

1. Review the complete working diff and confirm that no credential or private
   data is present.
2. Update `package.json` once. Do not copy the version into application code.
3. Run `npm test`, `npm run build`, and `git diff --check`.
4. Serve the root over HTTP and check the main page plus every public guide
   route. Check a narrow mobile width and a desktop width when browser tooling
   is available.
5. Review selector, persistence, licensing, attribution, and deployment notes.
6. Create one meaningful release commit and tag only after maintainer approval.

Do not rewrite remote history, publish, or tag from an unreviewed local
change without explicit approval. An alpha patch release may fix behavior without promising
API stability; a minor release may add a compatible feature; a major release
requires a deliberate compatibility decision.
