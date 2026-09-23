// Small browser-storage boundary. Persistence policy and schemas stay in core.js.
export function readLocal(key, fallback = null) {
  try { return globalThis.localStorage?.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeLocal(key, value) {
  try { globalThis.localStorage?.setItem(key, value); return true; } catch { return false; }
}

export function removeLocal(key) {
  try { globalThis.localStorage?.removeItem(key); } catch { /* optional preference */ }
}

export function readSession(key, fallback = null) {
  try { return globalThis.sessionStorage?.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeSession(key, value) {
  try { globalThis.sessionStorage?.setItem(key, value); return true; } catch { return false; }
}
