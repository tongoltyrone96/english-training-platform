function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function tokens(value: string) { return value.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean); }

function editDistance(left: string[], right: string[]) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}

export function scoreGroqTranscript(referenceText: string, transcript: string, words: Array<{ word: string; start: number; end: number }>, averageLogProbability?: number) {
  const reference = tokens(referenceText); const spoken = tokens(transcript);
  const distance = editDistance(reference, spoken);
  const accuracy = clamp((1 - distance / Math.max(reference.length, spoken.length, 1)) * 100);
  const completeness = clamp((1 - Math.max(0, reference.length - spoken.length) / Math.max(reference.length, 1)) * accuracy);
  const confidence = averageLogProbability === undefined ? accuracy : clamp(Math.exp(averageLogProbability) * 100);
  const pronunciation = clamp(accuracy * 0.75 + confidence * 0.25);
  const duration = words.length ? Math.max(0.1, words[words.length - 1].end - words[0].start) : Math.max(1, spoken.length / 2);
  const wordsPerMinute = spoken.length / duration * 60;
  const paceScore = wordsPerMinute < 70 ? wordsPerMinute / 70 * 100 : wordsPerMinute > 190 ? Math.max(0, 100 - (wordsPerMinute - 190)) : 100;
  const longPauses = words.slice(1).filter((word, index) => word.start - words[index].end > 0.8).length;
  const fluency = clamp(paceScore - longPauses * 8);
  return { pronunciation, completeness, fluency, accuracy };
}
