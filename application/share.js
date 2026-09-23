import {
  balloonRepresentation,
  createSharePayload,
  formatShareDate,
  PUBLIC_ORIGIN,
  shareUrl,
} from '../js/share-policy.js';

export { balloonRepresentation, createSharePayload, formatShareDate, PUBLIC_ORIGIN, shareUrl };

export const SHARE_RESULT = Object.freeze({
  SHARED: 'shared',
  COPIED: 'copied',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
});

function solvedCountFromVerification(verification) {
  if (verification?.status !== 'CHECKED') return 0;
  const solvedIds = verification.solvedIds;
  return typeof solvedIds?.size === 'number' ? solvedIds.size : Array.isArray(solvedIds) ? solvedIds.length : 0;
}

/** Build the share view model from application inputs, without browser state. */
export function createShareViewModel({ language, date, verification } = {}) {
  const solvedCount = solvedCountFromVerification(verification);
  const payload = createSharePayload({ language, date, solvedCount });
  return Object.freeze({ language, date, solvedCount, payload });
}

/** Build a delivery command so browser adapters only need to implement ports. */
export function createShareCommand({ title, payload } = {}) {
  if (!payload) return null;
  return Object.freeze({ title: String(title || ''), text: payload.text });
}

/**
 * Deliver a share command through explicit native-share and clipboard ports.
 * A cancelled native share is terminal; other native failures use clipboard.
 */
export async function executeShare(command, ports = {}) {
  if (!command || typeof command.text !== 'string') return SHARE_RESULT.FAILED;
  if (typeof ports.nativeShare === 'function') {
    try {
      await ports.nativeShare({ title: command.title, text: command.text });
      return SHARE_RESULT.SHARED;
    } catch (error) {
      if (error?.name === 'AbortError') return SHARE_RESULT.CANCELLED;
    }
  }
  if (typeof ports.clipboardWriteText !== 'function') return SHARE_RESULT.FAILED;
  try {
    await ports.clipboardWriteText(command.text);
    return SHARE_RESULT.COPIED;
  } catch {
    return SHARE_RESULT.FAILED;
  }
}
