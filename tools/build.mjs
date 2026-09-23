import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';

const required = [
  'index.html', 'previous.html',
  'styles.css', 'core.js', 'js/app.js', 'js/codeforces.js',
  'js/i18n.js', 'js/storage.js', 'js/ladder-repository.js', 'js/persistence.js',
  'domain/config.js', 'domain/dates.js', 'domain/problems.js', 'domain/selector.js',
  'domain/history.js', 'domain/account.js', 'domain/url-state.js',
  'application/session.js', 'application/controller.js', 'application/view-model.js', 'application/account-view-model.js', 'application/account-sync.js',
  'js/routes.js', 'js/share.js',
  'pt/index.html', 'pt/daily/index.html', 'pt/challenges/index.html', 'pt/previous/index.html',
  'en/index.html', 'en/daily/index.html', 'en/challenges/index.html', 'en/previous/index.html',
  'es/index.html', 'es/daily/index.html', 'es/challenges/index.html', 'es/previous/index.html', '404.html',
  'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', '.nojekyll',
  'docs/en/index.md', 'docs/pt-BR/index.md', 'docs/es/index.md',
  '.github/workflows/pages.yml',
];
for (const path of required) await access(path);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

const htmlRouteFiles = await htmlFiles('.');

const scriptPattern = /<script\b([^>]*)>/gi;
const attributePattern = /([\w:-]+)\s*=\s*["']([^"']*)["']/gi;
const importPattern = /\b(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const stripQuery = reference => reference.split(/[?#]/, 1)[0];
const moduleEntries = new Set();
for (const htmlPath of htmlRouteFiles ?? []) {
  const html = await readFile(htmlPath, 'utf8');
  for (const script of html.matchAll(scriptPattern)) {
    const attributes = Object.fromEntries([...script[1].matchAll(attributePattern)].map(match => [match[1].toLowerCase(), match[2]]));
    if (attributes.type?.toLowerCase() !== 'module' || !attributes.src) continue;
    const reference = stripQuery(attributes.src);
    if (reference.startsWith('/')) {
      moduleEntries.add(reference.slice(1));
    } else {
      const relative = normalize(join(dirname(htmlPath), reference));
      try { await access(relative); moduleEntries.add(relative); }
      catch { moduleEntries.add(normalize(reference)); }
    }
  }
}

// Keep standalone browser modules in the audit even when no current HTML page
// loads them directly; their reachable imports are part of the shipped graph.
for (const path of [
  'core.js',
  'domain/config.js', 'domain/dates.js', 'domain/problems.js', 'domain/selector.js', 'domain/history.js', 'domain/account.js', 'domain/calendar.js', 'domain/url-state.js',
  'application/language-policy.js', 'application/session.js', 'application/controller.js', 'application/view-model.js', 'application/account-view-model.js', 'application/account-sync.js', 'application/navigation.js', 'application/preferences.js', 'application/share.js',
  'js/app.js', 'js/codeforces.js', 'js/i18n.js', 'js/storage.js', 'js/ladder-repository.js', 'js/persistence.js', 'js/routes.js', 'js/share.js', 'js/share-policy.js',
]) moduleEntries.add(path);

const syntaxFiles = new Set();
const pending = [...moduleEntries];
while (pending.length) {
  const path = pending.pop();
  if (syntaxFiles.has(path)) continue;
  await access(path);
  syntaxFiles.add(path);
  const source = await readFile(path, 'utf8');
  const references = [
    ...source.matchAll(importPattern),
    ...source.matchAll(dynamicImportPattern),
  ];
  for (const match of references) {
    const reference = stripQuery(match[1]);
    if (!reference.startsWith('.')) continue;
    const target = normalize(join(dirname(path), reference));
    await access(target);
    pending.push(target);
  }
}

for (const path of syntaxFiles) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--check', path], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${path} failed syntax check`)));
  });
}

const localReferencePattern = /(?:href|src)=["'](\/(?!\/)[^"']+)["']/g;
let localReferenceCount = 0;
for (const htmlPath of htmlRouteFiles) {
  const html = await readFile(htmlPath, 'utf8');
  for (const match of html.matchAll(localReferencePattern)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    if (!reference || reference === '/') continue;
    localReferenceCount += 1;
    const target = reference.endsWith('/') ? join(reference, 'index.html') : reference;
    try { await access(`.${target}`); }
    catch { throw new Error(`Missing local HTML asset reference: ${htmlPath} -> ${reference}`); }
  }
}

const packageText = await readFile('package.json', 'utf8');
const packageJson = JSON.parse(packageText);
if (packageJson.version !== '0.0.1') throw new Error('package.json must remain the authoritative 0.0.1 version');
console.log(`Validated ${required.length} static entry files, ${htmlRouteFiles.length} HTML routes, ${localReferenceCount} root-absolute local references, and JavaScript syntax.`);
