export function hasRecognizableSpeech(transcript: string) {
  return /[\p{L}\p{N}]/u.test(transcript);
}

export function isLikelySilenceHallucination(transcript: string, referenceText: string, accuracy: number) {
  const normalized = transcript.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  const commonHallucinations = new Set(["thank you", "thanks", "thanks for watching", "thank you for watching", "bye"]);
  return referenceText.trim().split(/\s+/).length >= 5 && accuracy < 15 && commonHallucinations.has(normalized);
}
