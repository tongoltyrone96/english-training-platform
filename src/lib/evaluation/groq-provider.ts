import "server-only";
import { z } from "zod";
import type { SpeechAssessment, SpeechAssessmentProvider } from "./providers";
import { scoreGroqTranscript } from "./groq-score";
import { hasRecognizableSpeech, isLikelySilenceHallucination } from "./transcript";

const responseSchema = z.object({
  text: z.string(),
  duration: z.number().nonnegative().optional(),
  words: z.array(z.object({ word: z.string(), start: z.number().nonnegative(), end: z.number().nonnegative() })).optional().default([]),
  segments: z.array(z.object({
    start: z.number().nonnegative().optional(),
    end: z.number().nonnegative().optional(),
    avg_logprob: z.number().optional(),
    no_speech_prob: z.number().min(0).max(1).optional(),
  }).passthrough()).optional().default([]),
});

export class GroqSpeechAssessmentProvider implements SpeechAssessmentProvider {
  private readonly key: string;
  private readonly model: string;
  constructor(options: { key?: string; model?: string } = {}) {
    const key = options.key ?? process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_NOT_CONFIGURED");
    this.key = key;
    this.model = options.model ?? process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";
  }

  async assess(audio: Uint8Array, referenceText: string): Promise<SpeechAssessment> {
    const isWav = audio.length > 44 && String.fromCharCode(...audio.slice(0, 4)) === "RIFF";
    if (isWav) {
      const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength); let energy = 0; let peak = 0; let count = 0;
      for (let offset = 44; offset + 1 < audio.length; offset += 2) { const sample = view.getInt16(offset, true) / 32768; energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); count++; }
      const rms = count ? Math.sqrt(energy / count) : 0;
      if (rms < 0.0015 && peak < 0.015) throw new Error("NO_SPEECH_RECOGNIZED");
    }
    const form = new FormData();
    const mimeType = isWav ? "audio/wav" : "audio/webm";
    form.set("file", new Blob([new Uint8Array(audio)], { type: mimeType }), isWav ? "answer.wav" : "answer.webm");
    form.set("model", this.model); form.set("language", "en"); form.set("temperature", "0");
    form.set("response_format", "verbose_json"); form.append("timestamp_granularities[]", "word"); form.append("timestamp_granularities[]", "segment");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${this.key}` }, body: form });
      if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
      const parsed = responseSchema.parse(await response.json());
      const noSpeech = parsed.segments.flatMap((segment) => segment.no_speech_prob === undefined ? [] : [segment.no_speech_prob]);
      if (noSpeech.length && noSpeech.reduce((sum, value) => sum + value, 0) / noSpeech.length >= 0.35) throw new Error("NO_SPEECH_RECOGNIZED");
      if (!hasRecognizableSpeech(parsed.text)) throw new Error("NO_SPEECH_RECOGNIZED");
      const logProbabilities = parsed.segments.flatMap((segment) => segment.avg_logprob === undefined ? [] : [segment.avg_logprob]);
      const averageLogProbability = logProbabilities.length ? logProbabilities.reduce((sum, value) => sum + value, 0) / logProbabilities.length : undefined;
      const scores = scoreGroqTranscript(referenceText, parsed.text, parsed.words, averageLogProbability);
      if (isLikelySilenceHallucination(parsed.text, referenceText, scores.accuracy)) throw new Error("NO_SPEECH_HALLUCINATION");
      return {
        transcript: parsed.text.trim(), pronunciation: scores.pronunciation, fluency: scores.fluency, completeness: scores.completeness,
        words: parsed.words.map((word) => ({ word: word.word, accuracy: scores.accuracy, errorType: "None" })),
        providerVersion: `groq:${this.model}:${isWav ? "wav" : "webm"}:proxy-v2`,
      };
    } finally { clearTimeout(timeout); }
  }
}
