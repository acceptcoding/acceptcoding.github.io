import { CANONICAL_HISTORY_SCHEMA, LADDER_SIZE, SITE_SALT } from './config.js';
import { assertTrainingDate, isValidDateString } from './dates.js';
import { isCanonicalHistoryProblem, problemMetadataFingerprint, stableProblemId } from './problems.js';

const CANONICAL_RESOLVER_VERSION_RE = /^j\d+-[a-z0-9-]+$/;

function validCanonicalId(value) {
  return typeof value === 'string' && /^[^:]+:.+$/.test(value);
}
export function validateCanonicalHistoryManifest(manifest, records = null, sourceProvenance = null) {
  if (!manifest || typeof manifest !== 'object' || manifest.schema !== CANONICAL_HISTORY_SCHEMA) return { valid: false, reason: 'schema' };
  if (!CANONICAL_RESOLVER_VERSION_RE.test(manifest.resolverVersion || '') || manifest.selectionSalt !== SITE_SALT || manifest.boundary !== 'utc-midnight-completion') return { valid: false, reason: 'provenance' };
  if (!isValidDateString(manifest.coverageStart) || manifest.coverageEnd !== null && !isValidDateString(manifest.coverageEnd) || manifest.coverageEnd !== null && manifest.coverageStart > manifest.coverageEnd) return { valid: false, reason: 'coverage' };
  if (!manifest.sourceProvenance || !/^[0-9a-f]{64}$/.test(manifest.sourceProvenance.problemsSha256 || '') || !/^[0-9a-f]{64}$/.test(manifest.sourceProvenance.contestsSha256 || '')) return { valid: false, reason: 'source-provenance' };
  if (sourceProvenance && (manifest.sourceProvenance.problemsSha256 !== sourceProvenance.problemsSha256 || manifest.sourceProvenance.contestsSha256 !== sourceProvenance.contestsSha256)) return { valid: false, reason: 'source-mismatch' };
  if (!manifest.entries || typeof manifest.entries !== 'object' || Array.isArray(manifest.entries)) return { valid: false, reason: 'entries' };
  for (const [date, entry] of Object.entries(manifest.entries)) {
    if (!isValidDateString(date) || !entry || typeof entry !== 'object' || !Array.isArray(entry.ids) || entry.ids.length !== LADDER_SIZE) return { valid: false, reason: `entry:${date}` };
    if (new Set(entry.ids).size !== LADDER_SIZE || entry.ids.some(id => !validCanonicalId(id))) return { valid: false, reason: `ids:${date}` };
    if (records && entry.ids.some(id => !records.some(record => stableProblemId(record) === id && isCanonicalHistoryProblem(record)))) return { valid: false, reason: `metadata:${date}` };
  }
  return { valid: true, reason: null };
}
export function canonicalHistoryIds(manifest, date, records = null, sourceProvenance = null) {
  const result = validateCanonicalHistoryManifest(manifest, records, sourceProvenance);
  if (!result.valid) throw new Error(`Invalid canonical history manifest: ${result.reason}`);
  assertTrainingDate(date, date);
  const entry = manifest.entries[date];
  return entry ? [...entry.ids] : null;
}
export function hydrateCanonicalProblems(ids, records) {
  if (!Array.isArray(ids) || ids.length !== LADDER_SIZE || new Set(ids).size !== LADDER_SIZE || ids.some(id => !validCanonicalId(id))) throw new Error('Invalid canonical daily ladder IDs');
  const wanted = new Set(ids);
  const byId = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = stableProblemId(record);
    if (!wanted.has(id) || !isCanonicalHistoryProblem(record)) continue;
    const current = byId.get(id);
    if (!current || problemMetadataFingerprint(record) < problemMetadataFingerprint(current)) byId.set(id, record);
  }
  const ladder = ids.map(id => byId.get(id) || null);
  if (ladder.some(problem => !problem)) throw new Error('Canonical daily ladder metadata is unavailable');
  return ladder;
}
