import { executeShare, SHARE_RESULT } from '../application/share.js';

const DEFAULT_SELECTORS = Object.freeze({
  button: '#share-challenge',
  status: '#share-status',
});

const ICONS = Object.freeze({
  success: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  warning: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4M12 16.5v.1"/></svg>',
  share: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 11 7.6-4.5M8.2 13l7.6 4.5"/></svg>',
});

const FEEDBACK_KEYS = Object.freeze({
  [SHARE_RESULT.SHARED]: Object.freeze({ key: 'shareShared', kind: 'success' }),
  [SHARE_RESULT.COPIED]: Object.freeze({ key: 'shareCopied', kind: 'success' }),
  [SHARE_RESULT.FAILED]: Object.freeze({ key: 'shareFailed', kind: 'error' }),
});

function feedbackIcon(kind) {
  return kind === 'success' ? ICONS.success : kind === 'warning' ? ICONS.warning : ICONS.share;
}

/**
 * Adapt application share commands to browser delivery ports and the existing
 * share button/status feedback contract.
 *
 * `ports` must provide the explicit browser effects accepted by executeShare:
 * nativeShare and/or clipboardWriteText. DOM and timer effects are injectable
 * as well, which keeps this adapter independent of the global browser state.
 */
export function createShareAdapter({
  ports = {},
  document = globalThis.document,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
  translate = (key) => key,
  selectors = DEFAULT_SELECTORS,
  feedbackDuration = 1100,
} = {}) {
  let feedbackTimer;

  function button() {
    return document?.querySelector?.(selectors.button);
  }

  function status() {
    return document?.querySelector?.(selectors.status);
  }

  function resetFeedback() {
    const shareButton = button();
    const shareStatus = status();
    if (!shareButton) return;
    clearTimeout?.(feedbackTimer);
    shareButton.classList.remove('is-success', 'is-error');
    shareButton.innerHTML = `${feedbackIcon('share')}<span>${shareButton.dataset.defaultLabel || translate('shareChallenge')}</span>`;
    if (shareStatus) shareStatus.textContent = '';
  }

  function showFeedback(key, kind = 'success') {
    const shareButton = button();
    const shareStatus = status();
    if (!shareButton) return;
    clearTimeout?.(feedbackTimer);
    shareButton.dataset.defaultLabel = shareButton.dataset.defaultLabel || translate('shareChallenge');
    shareButton.classList.remove('is-success', 'is-error');
    shareButton.classList.add(kind === 'success' ? 'is-success' : 'is-error');
    shareButton.innerHTML = `${feedbackIcon(kind)}<span>${translate(key)}</span>`;
    if (shareStatus) shareStatus.textContent = translate(key);
    feedbackTimer = setTimeout?.(() => resetFeedback(), feedbackDuration);
  }

  async function run(command, overridePorts = ports) {
    const result = await executeShare(command, overridePorts);
    const feedback = FEEDBACK_KEYS[result];
    if (feedback) showFeedback(feedback.key, feedback.kind);
    return result;
  }

  return Object.freeze({
    execute: run,
    executeShare: run,
    showFeedback,
    resetFeedback,
  });
}

export { DEFAULT_SELECTORS, ICONS };
