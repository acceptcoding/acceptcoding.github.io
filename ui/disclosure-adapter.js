const DEFAULT_PREFERENCE_SELECTOR = '.preference-menu';
const DEFAULT_HELP_SELECTOR = '#help';
const DEFAULT_MONTH_PICKER_SELECTORS = Object.freeze({
  toggle: '#month-picker-toggle',
  panel: '#month-picker',
  calendar: '#calendar',
  legend: '.calendar-legend',
  today: '.calendar-today',
});

function focusableElements(root, selector) {
  return [...root.querySelectorAll(selector)].filter((element) => !element.disabled && element.hidden !== true);
}

function trapTab(event, container, selector) {
  if (event.key !== 'Tab') return;
  const focusable = focusableElements(container, selector);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && container.ownerDocument.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && container.ownerDocument.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Keeps the existing native-details preference disclosures accessible without
 * changing their markup, styles, or application-specific selection behavior.
 */
export function wirePreferenceDetails({
  root = globalThis.document,
  selector = DEFAULT_PREFERENCE_SELECTOR,
  translate = (key) => key,
} = {}) {
  const cleanups = [];
  const menus = [...(root?.querySelectorAll?.(selector) || [])];

  const syncExpanded = (menu) => {
    menu.querySelector('.preference-trigger')?.setAttribute('aria-expanded', String(menu.open));
  };

  const closeMenu = (menu, restoreFocus = true) => {
    if (!menu) return;
    menu.open = false;
    syncExpanded(menu);
    if (restoreFocus) menu.querySelector('.preference-trigger')?.focus();
  };

  for (const menu of menus) {
    const panel = menu.querySelector('.preference-options');
    syncExpanded(menu);
    panel?.setAttribute('role', 'dialog');
    panel?.setAttribute('aria-modal', 'true');
    if (panel && !panel.querySelector('.preference-close')) {
      const close = root.createElement('button');
      close.className = 'preference-close';
      close.type = 'button';
      close.textContent = '×';
      close.setAttribute('aria-label', translate('close'));
      panel.prepend(close);
    }

    const onToggle = () => {
      syncExpanded(menu);
      if (menu.open) setTimeout(() => panel?.querySelector('.preference-close')?.focus(), 0);
    };
    const onPanelKeydown = (event) => {
      if (menu.open && panel) trapTab(event, panel, 'button:not([disabled])');
    };
    menu.addEventListener('toggle', onToggle);
    panel?.addEventListener('keydown', onPanelKeydown);
    cleanups.push(() => {
      menu.removeEventListener('toggle', onToggle);
      panel?.removeEventListener('keydown', onPanelKeydown);
    });
  }

  const onClose = (event) => closeMenu(event.target.closest(selector));
  root.querySelectorAll('.preference-close').forEach((button) => button.addEventListener('click', onClose));
  cleanups.push(() => root.querySelectorAll('.preference-close').forEach((button) => button.removeEventListener('click', onClose)));

  const onDocumentClick = (event) => menus.filter((menu) => menu.open && !menu.contains(event.target)).forEach((menu) => closeMenu(menu, false));
  const onDocumentKeydown = (event) => {
    if (event.key !== 'Escape') return;
    menus.filter((menu) => menu.open).forEach((menu) => closeMenu(menu));
  };
  root.addEventListener('click', onDocumentClick);
  root.addEventListener('keydown', onDocumentKeydown);
  cleanups.push(() => {
    root.removeEventListener('click', onDocumentClick);
    root.removeEventListener('keydown', onDocumentKeydown);
  });

  return () => cleanups.splice(0).forEach((cleanup) => cleanup());
}

/**
 * Wires the dedicated help details/dialog contract. This is intentionally
 * separate from preference and month-picker behavior; it is not a universal
 * overlay abstraction.
 */
export function wireHelpDialog({
  root = globalThis.document,
  selector = DEFAULT_HELP_SELECTOR,
} = {}) {
  const help = root?.querySelector?.(selector);
  if (!help) return () => {};
  const popover = help.querySelector('.help-popover');
  const trigger = help.querySelector('.help-trigger');
  const close = () => {
    help.open = false;
    trigger?.focus();
  };
  const onToggle = () => {
    if (help.open) {
      popover?.style.setProperty('top', '50vh', 'important');
      popover?.style.setProperty('left', '50vw', 'important');
      popover?.style.setProperty('right', 'auto', 'important');
      popover?.style.setProperty('bottom', 'auto', 'important');
      popover?.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      setTimeout(() => popover?.querySelector('.help-close')?.focus(), 0);
    }
  };
  const onCloseClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const onKeydown = (event) => {
    if (popover) trapTab(event, popover, 'button:not([disabled]), a[href], input:not([disabled])');
  };
  const onDocumentKeydown = (event) => {
    if (event.key === 'Escape' && help.open) close();
  };
  const onDocumentClick = (event) => {
    if (help.open && !help.contains(event.target)) close();
  };

  popover?.setAttribute('role', 'dialog');
  popover?.setAttribute('aria-modal', 'true');
  help.addEventListener('toggle', onToggle);
  popover?.addEventListener('keydown', onKeydown);
  root.querySelectorAll(`${selector} .help-close, ${selector} .help-backdrop`).forEach((button) => button.addEventListener('click', onCloseClick));
  root.addEventListener('keydown', onDocumentKeydown);
  root.addEventListener('click', onDocumentClick);

  return () => {
    help.removeEventListener('toggle', onToggle);
    popover?.removeEventListener('keydown', onKeydown);
    root.querySelectorAll(`${selector} .help-close, ${selector} .help-backdrop`).forEach((button) => button.removeEventListener('click', onCloseClick));
    root.removeEventListener('keydown', onDocumentKeydown);
    root.removeEventListener('click', onDocumentClick);
  };
}

/**
 * Owns only the calendar's month-picker disclosure state. Rendering months,
 * navigation, and date selection remain in the calendar composition root.
 */
export function wireMonthPickerDisclosure({
  root = globalThis.document,
  selectors = DEFAULT_MONTH_PICKER_SELECTORS,
} = {}) {
  const toggle = root?.querySelector?.(selectors.toggle);
  const panel = root?.querySelector?.(selectors.panel);
  if (!toggle || !panel) return () => {};
  const calendar = root.querySelector(selectors.calendar);
  const related = [selectors.legend, selectors.today].map((selector) => root.querySelector(selector)).filter(Boolean);
  const setOpen = (open, restoreFocus = false) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (calendar) calendar.hidden = open;
    related.forEach((element) => { element.hidden = open; });
    if (!open && restoreFocus) toggle.focus();
  };
  const onToggle = () => setOpen(panel.hidden);
  const onDocumentClick = (event) => {
    if (panel.hidden || panel.contains(event.target) || event.target === toggle) return;
    setOpen(false);
  };
  const onDocumentKeydown = (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false, true);
  };

  toggle.addEventListener('click', onToggle);
  root.addEventListener('click', onDocumentClick);
  root.addEventListener('keydown', onDocumentKeydown);
  return () => {
    toggle.removeEventListener('click', onToggle);
    root.removeEventListener('click', onDocumentClick);
    root.removeEventListener('keydown', onDocumentKeydown);
  };
}

export { DEFAULT_MONTH_PICKER_SELECTORS };
