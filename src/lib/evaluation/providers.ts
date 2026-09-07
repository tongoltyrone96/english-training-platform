export type SpeechAssessment = {
  transcript: string;
  pronunciation: number;
  fluency: number;
  completeness: number;
  prosody?: number;
  words: Array<{ word: string; accuracy: number; errorType: string }>;
  providerVersion: string;
};

export type LanguageEvaluation = {
  meaning: number;
  grammar: number;
  naturalness: number;
  correctedAnswer: string;
  feedbackKo: string;
  missingMeanings: string[];
  detectedIssues: string[];
  modelVersion: string;
  promptVersion: string;
};

export interface SpeechAssessmentProvider {
  assess(audio: Uint8Array, referenceText: string): Promise<SpeechAssessment>;
}

export interface LanguageEvaluationProvider {
  evaluate(input: { korean: string; referenceAnswers: string[]; keywords: string[]; transcript: string }): Promise<LanguageEvaluation>;
}
