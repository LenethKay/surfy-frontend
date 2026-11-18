export const SURFY_QUESTION_KEYS = [
  'ask.why',
  'ask.next',
  'ask.offline',
  'ask.photo',
  'ask.uncertain',
  'ask.link',
];

const QUESTION_MATCHERS = [
  { key: 'ask.why', words: ['why', 'flagged', 'warning', 'bakit', 'mark', 'suspicious'] },
  { key: 'ask.next', words: ['what', 'do', 'now', 'should', 'gagawin', 'next', 'action'] },
  { key: 'ask.link', words: ['link', 'safe', 'open', 'click', 'bukas', 'ligtas'] },
  { key: 'ask.offline', words: ['offline', 'internet', 'online', 'connection', 'walang net'] },
  { key: 'ask.photo', words: ['photo', 'picture', 'image', 'keep', 'save', 'sine-save', 'larawan'] },
  { key: 'ask.uncertain', words: ['sure', 'certain', 'unsure', 'not sure', 'sigurado', 'uncertain'] },
];

function findQuestionKey(question) {
  const normalized = question.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const best = QUESTION_MATCHERS
    .map(({ key, words }) => ({
      key,
      score: words.reduce((score, word) => score + (normalized.includes(word) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score)[0];
  return best?.score ? best.key : null;
}

export function getSurfyAnswer(question, result, t) {
  const key = findQuestionKey(question);
  if (!key) return t('ask.fallback');

  if (key === 'ask.why') {
    const indicators = result?.signals?.map((signal) => t(`signal.${signal.id}`)).filter(Boolean);
    return indicators?.length
      ? indicators.join(' ')
      : t('result.summary.none');
  }
  if (key === 'ask.next') return result?.level === 'low' ? t('risk.low.description') : t('result.advice');
  if (key === 'ask.link') {
    return result?.level === 'low'
      ? t('ask.link.low')
      : t('ask.link.caution');
  }
  if (key === 'ask.offline') return t('ask.offline.answer');
  if (key === 'ask.photo') return t('ask.photo.answer');
  return t('result.insufficient');
}
