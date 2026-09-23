const DIGIT_EMOJI = Object.freeze(['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']);

export const PUBLIC_ORIGIN = 'https://acceptcoding.github.io';

function dateObject(date) {
  return new Date(`${date}T12:00:00Z`);
}

export function formatShareDate(date, language) {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(dateObject(date));
  }
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function balloonRepresentation(solvedCount) {
  const count = Math.max(0, Number.parseInt(solvedCount, 10) || 0);
  if (count === 0) return '💻';
  if (count <= 3) return '🎈'.repeat(count);
  return `${String(count).split('').map((digit) => DIGIT_EMOJI[Number(digit)]).join('')}🎈`;
}

export function shareUrl(language, date) {
  return `${PUBLIC_ORIGIN}/${language}/challenges/${date}/`;
}

export function createSharePayload({ language, date, solvedCount }) {
  if (!date || !['pt', 'en', 'es'].includes(language)) return null;
  const count = Math.max(0, Number.parseInt(solvedCount, 10) || 0);
  const formattedDate = formatShareDate(date, language);
  const visual = balloonRepresentation(count);
  const cta = {
    pt: 'E aí, bora codar?',
    en: 'Up for some coding?',
    es: '¿Te animas a programar?',
  }[language];
  const lines = (count === 0 ? {
    pt: [`Desafio ACCEPT de ${formattedDate}. ${visual}`],
    en: [`ACCEPT challenge for ${formattedDate}. ${visual}`],
    es: [`Desafío ACCEPT del ${formattedDate}. ${visual}`],
  } : {
    pt: [`Fiz o desafio ACCEPT de ${formattedDate}.`, `Resolvi ${count} ${count === 1 ? 'problema' : 'problemas'}. ${visual}`],
    en: [`I did the ACCEPT challenge for ${formattedDate}.`, `I solved ${count} ${count === 1 ? 'problem' : 'problems'}. ${visual}`],
    es: [`Hice el desafío ACCEPT del ${formattedDate}.`, `Resolví ${count} ${count === 1 ? 'problema' : 'problemas'}. ${visual}`],
  })[language];
  const url = shareUrl(language, date);
  return { url, text: [...lines, '', cta, url].join('\n') };
}
