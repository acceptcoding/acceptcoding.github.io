import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { COPY } from '../js/i18n.js';

const root = process.cwd();
const languages = ['pt', 'en', 'es'];
const launchDate = '2026-09-21';
const descriptions = {
  pt: { home: 'Prática diária de programação com três problemas do Codeforces. Resolva um.', daily: 'Treino diário com três problemas do Codeforces. Resolva um.', challenges: 'Calendário de desafios do ACCEPT.' },
  en: { home: 'Daily programming practice with three Codeforces problems. Solve one.', daily: 'Daily training with three Codeforces problems. Solve one.', challenges: 'The ACCEPT challenge archive.' },
  es: { home: 'Práctica diaria de programación con tres problemas de Codeforces. Resuelve uno.', daily: 'Entrenamiento diario con tres problemas de Codeforces. Resuelve uno.', challenges: 'Calendario de desafíos de ACCEPT.' },
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function eachDate(start, end) {
  const dates = [];
  for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function localizeFallback(source, language, page = 'daily') {
  const copy = COPY[language];
  let result = source.replace(/(<([a-z][\w:-]*)\b[^>]*data-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi, (match, open, tag, key, text, close) => {
    return copy[key] === undefined ? match : `${open}${escapeAttribute(copy[key]).replaceAll('&quot;', '"')}${close}`;
  });
  result = result.replace(/<([^>]*data-i18n-aria="([^"]+)"[^>]*)>/gi, (match, attributes, key) => {
    if (copy[key] === undefined || !/aria-label="[^"]*"/i.test(attributes)) return match;
    return `<${attributes.replace(/aria-label="[^"]*"/i, `aria-label="${escapeAttribute(copy[key])}"`)}>`;
  });
  result = result.replace(/<([^>]*data-i18n-placeholder="([^"]+)"[^>]*)>/gi, (match, attributes, key) => {
    if (copy[key] === undefined || !/placeholder="[^"]*"/i.test(attributes)) return match;
    return `<${attributes.replace(/placeholder="[^"]*"/i, `placeholder="${escapeAttribute(copy[key])}"`)}>`;
  });
  result = result.replace(/<([^>]*data-i18n-title="([^"]+)"[^>]*)>/gi, (match, attributes, key) => {
    if (copy[key] === undefined || !/title="[^"]*"/i.test(attributes)) return match;
    return `<${attributes.replace(/title="[^"]*"/i, `title="${escapeAttribute(copy[key])}"`)}>`;
  });
  result = result.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${descriptions[language][page] || descriptions[language].challenges}">`);
  result = result
    .replaceAll("if(t!=='light'&&t!=='system'&&t!=='dark')t='system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';", "if(t!=='light'&&t!=='dark')t='light';")
    .replaceAll('data-i18n-title="Tema: Sistema"', 'data-i18n-title="Tema"')
    .replaceAll('aria-label="Tema: Sistema"', 'aria-label="Tema"')
    .replaceAll('title="Tema: Sistema"', 'title="Tema"')
    .replace(/\s*<button[^>]*data-theme-choice="system"[^>]*>[\s\S]*?<\/button>/gi, '');
  return result;
}

function publicize(source, language, page = 'daily', canonicalPath = null) {
  const languageCode = language.toUpperCase();
  let result = source
    .replaceAll('href="styles.css', 'href="/styles.css')
    .replaceAll('src="js/app.js', 'src="/js/app.js')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('href="balloon', 'href="/balloon')
    .replaceAll('src="balloon', 'src="/balloon')
    .replaceAll('href="./"', `href="/${language}/"`)
    .replaceAll('href="previous.html', `href="/${language}/challenges/`)

    .replace(/<script>!function\(\)\{try\{var t=localStorage\.getItem\('accept-theme'\);/, `<script>!function(){try{var m=location.pathname.match(/^\\/(pt|en|es)(?:\\/|$)/);var t=localStorage.getItem('accept-theme');`)
    .replace("var l=localStorage.getItem('accept-language');", "var l=m?.[1]||localStorage.getItem('accept-language');")
    .replace('<html lang="en">', `<html lang="${language}" data-route-language="${language}" data-language="${language}">`)
    .replace(/(<span class="language-current">)[^<]*(<\/span>)/, `$1${languageCode}$2`)
    .replace(/(<button class="language-option"[^>]*data-language="pt"[^>]*aria-pressed=")[^"]*(")/, `$1${language === 'pt'}$2`)
    .replace(/(<button class="language-option"[^>]*data-language="en"[^>]*aria-pressed=")[^"]*(")/, `$1${language === 'en'}$2`)
    .replace(/(<button class="language-option"[^>]*data-language="es"[^>]*aria-pressed=")[^"]*(")/, `$1${language === 'es'}$2`);
  const canonical = canonicalPath === false ? null : canonicalPath || `/${language}/${page === 'challenges' ? 'challenges/' : page === 'daily' ? 'daily/' : ''}`;
  if (canonical) result = result.replace('</title>', `</title>\n  <link rel="canonical" href="${canonical}">`);
  const localized = localizeFallback(result, language, page).replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${descriptions[language][page] || descriptions[language].challenges}">`);
  return localized;
}


const notFoundCopy = {
  pt: { title: 'Página não encontrada', message: 'O endereço que você abriu não existe ou não está disponível.', home: 'Ir para o início', daily: 'Treino de hoje', challenges: 'Desafios', back: '← Voltar', pageTitle: 'Página não encontrada — ACCEPT Coding Club' },
  en: { title: 'Page not found', message: 'The address you opened does not exist or is not available.', home: 'Go to home', daily: "Today's training", challenges: 'Challenges', back: '← Go back', pageTitle: 'Page not found — ACCEPT Coding Club' },
  es: { title: 'Página no encontrada', message: 'La dirección que abriste no existe o no está disponible.', home: 'Ir al inicio', daily: 'Entrenamiento de hoy', challenges: 'Desafíos', back: '← Volver', pageTitle: 'Página no encontrada — ACCEPT Coding Club' },
};

function notFoundPage(source) {
  const publicSource = publicize(source, 'en', 'daily', false);
  const mainStart = publicSource.indexOf('<main class="shell');
  const mastheadEnd = publicSource.indexOf('</header>', mainStart) + '</header>'.length;
  const footerStart = publicSource.indexOf('    <footer>', mastheadEnd);
  const footerEnd = publicSource.indexOf('</footer>', footerStart) + '</footer>'.length;
  const scriptStart = publicSource.indexOf('  <script type="module"', footerEnd);
  if (mainStart < 0 || mastheadEnd < '</header>'.length || footerStart < 0 || footerEnd < '</footer>'.length || scriptStart < 0) throw new Error('Could not locate shared shell in daily page');
  const masthead = publicSource.slice(mainStart, mastheadEnd).replaceAll('href="/en/"', 'data-404-link="home" href="/en/"');
  const footer = publicSource.slice(footerStart, footerEnd);
  const nav = `<nav class="primary-nav" data-404-nav aria-label="Primary navigation"><a data-404-link="home" data-i18n="homeNav" href="/en/">Home</a><a data-404-link="daily" data-i18n="dailyNav" href="/en/daily/">Today</a><a data-404-link="challenges" data-i18n="challengesNav" href="/en/challenges/">Challenges</a></nav>`;
  const text = key => Object.fromEntries(Object.entries(notFoundCopy).map(([language, copy]) => [language, copy[key]]));
  const textAttribute = key => escapeAttribute(JSON.stringify(text(key)));
  const section = `<section class="home-content" aria-labelledby="not-found-title"><p class="section-kicker">404</p><h1 id="not-found-title" data-404-text="${textAttribute('title')}\">Page not found</h1><p class="home-lead" data-404-text="${textAttribute('message')}\">The address you opened does not exist or is not available.</p><nav class="pathway-list" data-404-recovery aria-label="Recovery links"><a class="pathway pathway-primary" data-404-link="home" href="/en/"><span class="pathway-icon" aria-hidden="true">⌂</span><span data-404-text="${textAttribute('home')}\">Go to home</span></a><a class="pathway" data-404-link="daily" href="/en/daily/"><span class="pathway-icon" aria-hidden="true">→</span><span data-404-text="${textAttribute('daily')}\">Today's training</span></a><a class="pathway" data-404-link="challenges" href="/en/challenges/"><span class="pathway-icon" aria-hidden="true">←</span><span data-404-text="${textAttribute('challenges')}\">Challenges</span></a></nav><p><a class="text-link" href="/en/" data-404-back data-404-text="${textAttribute('back')}\">← Go back</a></p></section>`;
  const recoveryScript = `<script>!function(){var c=${JSON.stringify(COPY)},m=location.pathname.match(/^\\/(pt|en|es)(?:\\/|$)/),s=localStorage.getItem('accept-language'),p=(navigator.languages&&navigator.languages[0])||navigator.language||'',l=m?.[1]||s||String(p).toLowerCase().split('-')[0];l=l==='pt'||l==='es'?l:'en';document.documentElement.lang=l;document.documentElement.dataset.language=l;document.title=${JSON.stringify(Object.fromEntries(Object.entries(notFoundCopy).map(([language, copy]) => [language, copy.pageTitle])))}[l];var copy=c[l]||c.en;document.querySelectorAll('[data-i18n]').forEach(function(e){var k=e.dataset.i18n;if(copy[k]!==undefined)e.textContent=copy[k]});document.querySelectorAll('[data-i18n-aria]').forEach(function(e){var k=e.dataset.i18nAria;if(copy[k]!==undefined)e.setAttribute('aria-label',copy[k])});document.querySelectorAll('[data-i18n-title]').forEach(function(e){var k=e.dataset.i18nTitle;if(copy[k]!==undefined)e.title=copy[k]});document.querySelectorAll('[data-i18n-placeholder]').forEach(function(e){var k=e.dataset.i18nPlaceholder;if(copy[k]!==undefined)e.placeholder=copy[k]});document.querySelectorAll('[data-404-text]').forEach(function(e){var c=JSON.parse(e.dataset['404Text']);e.textContent=c[l]});document.querySelectorAll('[data-404-link]').forEach(function(e){e.href='/'+l+'/'+({home:'',daily:'daily/',challenges:'challenges/'}[e.dataset['404Link']]||'')});document.querySelector('[data-404-back]').href='/'+l+'/';document.querySelectorAll('[data-404-nav]').forEach(function(e){e.setAttribute('aria-label',l==='pt'?'Navegação principal':l==='es'?'Navegación principal':'Primary navigation')});document.querySelectorAll('[data-404-recovery]').forEach(function(e){e.setAttribute('aria-label',l==='pt'?'Links para recuperação':l==='es'?'Enlaces de recuperación':'Recovery links')});document.documentElement.classList.remove('language-pending')}();</script>`;
  return `${publicSource.slice(0, mainStart)}${masthead}\n    ${nav}\n    ${section}\n${footer}${recoveryScript}\n</main>\n</body>\n</html>`
    .replace('<html lang="en"', '<html lang="en" data-route-fallback="true"');
}

function homePage(source, language) {
  const sourceWithoutBack = source.replace(/\s*<a class="daily-back[^"]*"[^>]*>[\s\S]*?<\/a>/, '');
  const start = sourceWithoutBack.indexOf('    <a class="how-to-return"');
  const end = sourceWithoutBack.indexOf('    </section>', start) + '    </section>'.length;
  if (start < 0 || end < 0) throw new Error('Could not locate home template content');
  const section = `    <section class="home-content" aria-labelledby="home-title">
      <header class="home-intro">
        <h1 id="home-title"><span class="home-tagline-line home-tagline-first" data-i18n="homeTaglineFirst">Três problemas do Codeforces por dia.</span><span class="home-tagline-line home-tagline-second"><span data-i18n="homeTaglineSecondBefore">Basta resolver </span><strong data-i18n="homeTaglineEmphasis">um</strong>.</span></h1>
      </header>
      <section class="home-today" aria-labelledby="home-today-label">
        <div class="home-today-header">
          <div><p id="home-today-label" class="section-kicker" data-i18n="homeTodayKicker">Desafio diário</p><p id="home-today-date" class="home-date" data-home-date></p></div>
          <a class="home-primary-action" href="/${language}/daily/" data-i18n="homeTodayAction">Praticar</a>
        </div>
        <div class="home-week" id="home-week" data-i18n-aria="recentDays" aria-label="Dias recentes"></div>
        <a class="home-history-action" href="/${language}/challenges/"><svg class="home-action-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3.5v3M17 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></svg><span data-i18n="homeChallengesAction">Desafios anteriores</span><span aria-hidden="true">→</span></a>
      </section>

    </section>`;
  return publicize(sourceWithoutBack.slice(0, start) + section + sourceWithoutBack.slice(end), language, 'home', `/${language}/`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${descriptions[language].home}">`)
    .replace('<main class="shell" id="how-to">', '<main class="shell" id="home">');
}

const [daily, previous, homeTemplate] = await Promise.all([
  readFile(`${root}/index.html`, 'utf8'),
  readFile(`${root}/previous.html`, 'utf8'),
  readFile(`${root}/tools/templates/home-template.html`, 'utf8'),
]);
const dates = eachDate(launchDate, localDate());
let written = 0;
for (const language of languages) {
  const homeDir = `${root}/${language}`;
  const dailyDir = `${homeDir}/daily`;
  const challengesDir = `${homeDir}/challenges`;
  await Promise.all([mkdir(homeDir, { recursive: true }), mkdir(dailyDir, { recursive: true }), mkdir(challengesDir, { recursive: true })]);
  await writeFile(`${homeDir}/index.html`, homePage(homeTemplate, language));
  await writeFile(`${dailyDir}/index.html`, publicize(daily, language, 'daily', `/${language}/daily/`));
  await writeFile(`${challengesDir}/index.html`, publicize(previous, language, 'challenges', `/${language}/challenges/`));
  written += 3;
  for (const date of dates) {
    const dateDir = `${challengesDir}/${date}`;
    await mkdir(dateDir, { recursive: true });
    await writeFile(`${dateDir}/index.html`, publicize(daily, language, 'daily', `/${language}/challenges/${date}/`));
    written += 1;
  }
}
await writeFile(`${root}/404.html`, notFoundPage(daily));
console.log(`Generated ${written} locale route entry files for ${languages.length} languages through ${localDate()}.`);