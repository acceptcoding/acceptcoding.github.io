import { LANGUAGES } from '../application/language-policy.js';
import { THEMES } from '../application/preferences.js';

const DEFAULT_SELECTORS = Object.freeze({
  menu: '.preference-menu',
  trigger: '.preference-trigger',
  options: '.preference-options',
  close: '.preference-close',
  language: '#language',
  languageOption: '.language-option',
  theme: '#theme',
  themeOption: '.theme-option',
  homePreference: '[data-home-preference]',
});

const LANGUAGE_NAMES = Object.freeze({ pt: 'Português', en: 'English', es: 'Español' });
const WIRED_ROOTS = new WeakSet();

function ownerDocument(root, explicitDocument) {
  if (explicitDocument) return explicitDocument;
  if (root?.nodeType === 9) return root;
  return root?.ownerDocument || null;
}

function find(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function all(root, selector) {
  return root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
}

function focusable(options) {
  return [...options.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
}

function themeOptionIcon(theme) {
  if (theme === 'light') return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/><circle cx="12" cy="12" r="3.5"/></svg>';
  return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/></svg>';
}

function paletteIcon() {
  return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.8a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12h-3Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="14" cy="6.8" r=".8"/></svg>';
}

/**
 * Wire the existing language and theme details controls.
 *
 * The adapter owns DOM state and focus only. Preference policy, persistence,
 * and route navigation are supplied as callbacks by the composition root.
 */
export function createPreferencesControls({
  root,
  document: explicitDocument,
  translate = (key) => key,
  languageNames = LANGUAGE_NAMES,
  languages = LANGUAGES,
  themeChoices = THEMES.filter((theme) => theme !== 'system'),
  themeLabels = { light: 'Light', dark: 'Dark' },
  getLanguage = () => 'en',
  getTheme = () => 'light',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  selectors = DEFAULT_SELECTORS,
  setTimeout: schedule = globalThis.setTimeout,
} = {}) {
  const document = ownerDocument(root, explicitDocument) || (typeof globalThis.document !== 'undefined' ? globalThis.document : null);
  const container = root || document;
  const query = (name) => find(container, selectors[name]);
  const queryAll = (name) => all(container, selectors[name]);

  function syncExpanded(menu) {
    queryWithin(menu, selectors.trigger)?.setAttribute('aria-expanded', String(menu.open));
  }

  function queryWithin(element, selector) {
    return element?.querySelector?.(selector) || null;
  }

  function close(menu, returnFocus = true) {
    if (!menu) return;
    menu.open = false;
    syncExpanded(menu);
    if (returnFocus) queryWithin(menu, selectors.trigger)?.focus();
  }

  function open(menu) {
    if (!menu) return;
    menu.open = true;
    syncExpanded(menu);
    schedule?.(() => queryWithin(menu, selectors.close)?.focus(), 0);
  }

  function renderLanguage(language = getLanguage()) {
    const menu = query('language');
    if (!menu) return;
    const name = languageNames[language] || language;
    queryWithin(menu, selectors.options)?.setAttribute('aria-label', translate('language'));
    queryWithin(menu, selectors.trigger)?.setAttribute('aria-label', `${translate('language')}: ${name}`);
    syncExpanded(menu);
    const current = queryWithin(menu, '.language-current');
    if (current) current.textContent = String(language).toUpperCase();
    queryAll('languageOption').forEach((button) => {
      const option = button.dataset.language;
      const label = languageNames[option] || option;
      button.setAttribute('aria-pressed', String(option === language));
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  function renderTheme(theme = getTheme()) {
    const menu = query('theme');
    if (!menu) return;
    const labels = { ...themeLabels };
    queryWithin(menu, selectors.options)?.setAttribute('aria-label', translate('theme'));
    queryWithin(menu, selectors.trigger)?.setAttribute('aria-label', `${translate('theme')}: ${labels[theme] || theme}`);
    syncExpanded(menu);
    const icon = queryWithin(menu, '.theme-current-icon');
    if (icon) icon.innerHTML = paletteIcon();
    const current = queryWithin(menu, '.theme-current-label');
    if (current) current.textContent = labels[theme] || theme;
    queryAll('themeOption').forEach((button) => {
      const choice = button.dataset.themeChoice;
      const label = labels[choice] || choice;
      queryWithin(button, '.theme-option-icon')?.replaceChildren();
      queryWithin(button, '.theme-option-icon')?.insertAdjacentHTML('afterbegin', themeOptionIcon(choice));
      const optionLabel = queryWithin(button, '.theme-option-label');
      if (optionLabel) optionLabel.textContent = label;
      button.setAttribute('aria-pressed', String(choice === theme));
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  function render(preferences = {}) {
    renderLanguage(preferences.language ?? getLanguage());
    renderTheme(preferences.theme ?? getTheme());
  }

  function wire() {
    if (!container || WIRED_ROOTS.has(container)) return api;
    WIRED_ROOTS.add(container);
    queryAll('menu').forEach((menu) => {
      syncExpanded(menu);
      const options = queryWithin(menu, selectors.options);
      if (!options) return;
      options.setAttribute('role', 'dialog');
      options.setAttribute('aria-modal', 'true');
      let closeButton = queryWithin(options, selectors.close);
      if (!closeButton) {
        closeButton = document?.createElement?.('button');
        if (closeButton) {
          closeButton.className = 'preference-close';
          closeButton.type = 'button';
          closeButton.textContent = '×';
          closeButton.setAttribute('aria-label', translate('close'));
          options.prepend(closeButton);
        }
      }
      menu.addEventListener('toggle', () => {
        syncExpanded(menu);
        if (menu.open) schedule?.(() => queryWithin(menu, selectors.close)?.focus(), 0);
      });
      options.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !menu.open) return;
        const items = focusable(options);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      closeButton?.addEventListener('click', () => close(menu));
    });

    query('language')?.addEventListener('click', (event) => {
      const option = event.target.closest?.(selectors.languageOption);
      const language = option?.dataset.language;
      if (!languages.includes(language)) return;
      onLanguageChange(language, { menu: query('language'), trigger: queryWithin(query('language'), selectors.trigger) });
      close(query('language'));
    });
    query('theme')?.addEventListener('click', (event) => {
      const option = event.target.closest?.(selectors.themeOption);
      const theme = option?.dataset.themeChoice;
      if (!themeChoices.includes(theme)) return;
      onThemeChange(theme, { menu: query('theme'), trigger: queryWithin(query('theme'), selectors.trigger) });
      close(query('theme'));
    });
    queryAll('homePreference').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      open(query(`#${button.dataset.homePreference}`));
    }));
    document?.addEventListener?.('click', (event) => {
      queryAll('menu').filter((menu) => menu.open && !menu.contains(event.target)).forEach((menu) => close(menu));
    });
    document?.addEventListener?.('keydown', (event) => {
      if (event.key !== 'Escape') return;
      queryAll('menu').filter((menu) => menu.open).forEach((menu) => close(menu));
    });
    render();
    return api;
  }

  const api = Object.freeze({ wire, render, renderLanguage, renderTheme, open, close });
  return api;
}

export { DEFAULT_SELECTORS, LANGUAGE_NAMES, themeOptionIcon, paletteIcon };
