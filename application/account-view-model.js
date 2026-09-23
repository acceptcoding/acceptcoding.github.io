const SPECIAL_HANDLE_RANKS = Object.freeze({ mikemirzayanov: 'Headquarters' });

export const RANK_CLASSES = Object.freeze([
  'rank-unknown', 'rank-unrated', 'rank-newbie', 'rank-pupil', 'rank-specialist',
  'rank-expert', 'rank-candidate', 'rank-master', 'rank-grandmaster',
  'rank-legendary', 'rank-tourist', 'rank-headquarters',
]);

export function officialRankName(profile = {}, normalizeHandle = (value) => String(value ?? '').trim().toLowerCase()) {
  const handle = normalizeHandle(profile.handle);
  if (SPECIAL_HANDLE_RANKS[handle]) return SPECIAL_HANDLE_RANKS[handle];
  const value = String(profile.rank || '').trim().toLowerCase();
  const rating = Number(profile.rating);
  if (value === 'tourist' || Number.isFinite(rating) && rating >= 4000) return 'tourist';
  const names = {
    unrated: 'unrated', newbie: 'newbie', pupil: 'pupil', specialist: 'specialist', expert: 'expert',
    'candidate master': 'candidate master', master: 'master', 'international master': 'international master',
    grandmaster: 'grandmaster', 'international grandmaster': 'international grandmaster', 'legendary grandmaster': 'legendary grandmaster',
    headquarters: 'Headquarters',
  };
  if (names[value]) return names[value];
  if (Number.isFinite(rating)) {
    if (rating >= 3000) return 'legendary grandmaster';
    if (rating >= 2600) return 'international grandmaster';
    if (rating >= 2400) return 'grandmaster';
    if (rating >= 2300) return 'international master';
    if (rating >= 2100) return 'master';
    if (rating >= 1900) return 'candidate master';
    if (rating >= 1600) return 'expert';
    if (rating >= 1400) return 'specialist';
    if (rating >= 1200) return 'pupil';
    return 'newbie';
  }
  return 'unrated';
}

export function rankClass(rank) {
  const value = String(rank || '').trim().toLowerCase();
  if (value === 'unrated') return 'rank-unrated';
  if (value === 'tourist') return 'rank-tourist';
  if (value === 'headquarters') return 'rank-headquarters';
  if (value === 'legendary grandmaster') return 'rank-legendary';
  if (value === 'newbie') return 'rank-newbie';
  if (value === 'pupil') return 'rank-pupil';
  if (value === 'specialist') return 'rank-specialist';
  if (value === 'expert') return 'rank-expert';
  if (value === 'candidate master') return 'rank-candidate';
  if (['master', 'international master'].includes(value)) return 'rank-master';
  if (['grandmaster', 'international grandmaster', 'legendary grandmaster'].includes(value)) return 'rank-grandmaster';
  return 'rank-unknown';
}

export function readableRankName(profile, normalizeHandle) {
  return officialRankName(profile, normalizeHandle).replace(/\b\w/g, (letter) => letter.toUpperCase());
}
