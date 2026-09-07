"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientId } from "@/lib/client-id";

type State = "READY" | "COUNTING" | "RECORDING" | "SUBMITTING" | "EVALUATING" | "PASSED" | "RETRY_REQUIRED" | "ERROR";
type Result = { transcript?: string; finalScore?: number; passed?: boolean; feedbackKo?: string; scores?: Record<string, number>; error?: string; mock?: boolean; speechProviderVersion?: string };
type AudioDiagnostics = { durationMs: number; rms: number; peak: number; voicedMs: number; sampleRate: number };

function createWav(chunks: Float32Array[], sampleRate: number) {
  const frames = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + frames * 2); const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + frames * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2; }
  return new Blob([buffer], { type: "audio/wav" });
}

function inspectPcm(chunks: Float32Array[], sampleRate: number): AudioDiagnostics {
  let all: Float32Array;
  if (chunks.length === 1) all = chunks[0];
  else { all = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; } }
  let energy = 0; let peak = 0; const samples = all.length; const windowSize = Math.max(1, Math.round(sampleRate * 0.02)); const windows: Array<{ length: number; rms: number }> = [];
  for (let start = 0; start < all.length; start += windowSize) { let windowEnergy = 0; const end = Math.min(all.length, start + windowSize); for (let index = start; index < end; index++) { const sample = all[index]; energy += sample * sample; windowEnergy += sample * sample; peak = Math.max(peak, Math.abs(sample)); } windows.push({ length: end - start, rms: Math.sqrt(windowEnergy / Math.max(1, end - start)) }); }
  const levels = windows.map((window) => window.rms).sort((a, b) => a - b); const noiseFloor = levels[Math.floor(levels.length * 0.2)] ?? 0; const speechThreshold = Math.max(0.006, noiseFloor * 2.5); const voicedSamples = windows.filter((window) => window.rms >= speechThreshold).reduce((sum, window) => sum + window.length, 0);
  return { durationMs: Math.round(samples / sampleRate * 1000), rms: samples ? Math.sqrt(energy / samples) : 0, peak, voicedMs: Math.round(voicedSamples / sampleRate * 1000), sampleRate };
}

export function TrainingRecorder(props: { sessionId: string; itemId: string; korean: string; timeLimitSec: number; passScore: string; autoAdvance: boolean }) {
  const router = useRouter(); const [state, setState] = useState<State>("READY"); const [remaining, setRemaining] = useState(props.timeLimitSec); const [result, setResult] = useState<Result>(); const [inputLevel, setInputLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const chunks = useRef<Blob[]>([]);
  const context = useRef<AudioContext | null>(null); const source = useRef<MediaStreamAudioSourceNode | null>(null); const analyser = useRef<AnalyserNode | null>(null); const silentGain = useRef<GainNode | null>(null); const meterFrame = useRef<number | undefined>(undefined);
  const submitted = useRef(false); const holding = useRef(false); const startedAt = useRef(0); const stopTimer = useRef<number | undefined>(undefined); const key = useRef(createClientId()); const microphoneLabel = useRef("Default microphone");

  const cleanup = useCallback(() => {
    if (meterFrame.current !== undefined) cancelAnimationFrame(meterFrame.current); meterFrame.current = undefined; silentGain.current?.disconnect(); analyser.current?.disconnect(); source.current?.disconnect(); silentGain.current = null; analyser.current = null; source.current = null;
    const currentContext = context.current; context.current = null; if (currentContext && currentContext.state !== "closed") void currentContext.close();
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
  }, []);

  const submit = useCallback(async (blob: Blob, diagnostics: AudioDiagnostics) => {
    if (submitted.current) return; submitted.current = true; setState("SUBMITTING");
    const data = new FormData(); data.set("audio", blob, "answer.wav"); data.set("sessionId", props.sessionId); data.set("itemId", props.itemId); data.set("idempotencyKey", key.current); data.set("durationMs", String(diagnostics.durationMs)); data.set("rms", String(diagnostics.rms)); data.set("peak", String(diagnostics.peak)); data.set("voicedMs", String(diagnostics.voicedMs)); data.set("sampleRate", String(diagnostics.sampleRate));
    try { setState("EVALUATING"); const response = await fetch("/api/training/attempt", { method: "POST", body: data }); const body = await response.json() as Result; if (!response.ok) throw new Error(body.error); setResult(body); setState(body.passed ? "PASSED" : "RETRY_REQUIRED"); if (body.passed && props.autoAdvance) window.setTimeout(() => router.refresh(), 1800); }
    catch (error) { submitted.current = false; setResult({ error: error instanceof Error ? error.message : "The assessment request failed." }); setState("ERROR"); }
  }, [props.autoAdvance, props.itemId, props.sessionId, router]);

  const finish = useCallback(async (webm: Blob) => {
    try {
      const audioContext = context.current;
      if (!audioContext || webm.size < 200) throw new Error("EMPTY_RECORDING");
      const decoded = await audioContext.decodeAudioData(await webm.arrayBuffer());
      const samples = new Float32Array(decoded.getChannelData(0)); const diagnostics = inspectPcm([samples], decoded.sampleRate); const wav = createWav([samples], decoded.sampleRate);
      cleanup(); setInputLevel(0);
      if (diagnostics.durationMs < 500 || diagnostics.voicedMs < 250 || diagnostics.rms < 0.0015 || diagnostics.peak < 0.015) { submitted.current = false; const detail = `Captured ${diagnostics.durationMs} ms · voice ${diagnostics.voicedMs} ms · level ${Math.round(diagnostics.peak * 1000) / 10}%`; setResult({ error: `No clear voice reached “${microphoneLabel.current}”. ${detail}. Check Windows microphone privacy and input volume, then try again.` }); setState("ERROR"); return; }
      void submit(wav, diagnostics);
    } catch { cleanup(); setInputLevel(0); submitted.current = false; setResult({ error: `“${microphoneLabel.current}” did not produce a decodable recording. Check Windows microphone privacy and try again.` }); setState("ERROR"); }
  }, [cleanup, submit]);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    const wait = 800 - (Date.now() - startedAt.current);
    if (wait > 0) { window.clearTimeout(stopTimer.current); stopTimer.current = window.setTimeout(() => { if (recorder.current?.state === "recording") recorder.current.stop(); }, wait); } else recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!["READY", "RETRY_REQUIRED", "ERROR"].includes(state)) return;
    setState("COUNTING"); setResult(undefined); setRemaining(props.timeLimitSec); setInputLevel(0); submitted.current = false; key.current = createClientId(); chunks.current = [];
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error("UNSUPPORTED");
      // Start Web Audio during the pointer gesture. If it is created only after
      // awaiting microphone permission, Chrome can leave it suspended.
      const audioContext = new AudioContext(); context.current = audioContext; await audioContext.resume();
      const media = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = media;
      const track = media.getAudioTracks()[0]; microphoneLabel.current = track?.label || "Default microphone";
      if (!holding.current) { cleanup(); setResult({ error: "Press and keep holding the microphone button until recording starts." }); setState("ERROR"); return; }
      if (audioContext.state !== "running") throw new Error("AUDIO_CONTEXT_SUSPENDED");
      const audioSource = audioContext.createMediaStreamSource(media); source.current = audioSource;
      const audioAnalyser = audioContext.createAnalyser(); audioAnalyser.fftSize = 1024; audioAnalyser.smoothingTimeConstant = 0.3; analyser.current = audioAnalyser;
      const mute = audioContext.createGain(); mute.gain.value = 0; silentGain.current = mute;
      // Keep the graph renderable in Chrome without playing microphone audio.
      audioSource.connect(audioAnalyser); audioAnalyser.connect(mute); mute.connect(audioContext.destination);
      const meterData = new Float32Array(audioAnalyser.fftSize);
      const updateMeter = () => { audioAnalyser.getFloatTimeDomainData(meterData); let peak = 0; for (const sample of meterData) peak = Math.max(peak, Math.abs(sample)); setInputLevel(Math.min(100, Math.round(peak * 500))); meterFrame.current = requestAnimationFrame(updateMeter); }; updateMeter();
      const next = new MediaRecorder(media); recorder.current = next;
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onerror = () => { cleanup(); submitted.current = false; setResult({ error: "The browser could not record from the selected microphone." }); setState("ERROR"); };
      next.onstop = () => finish(new Blob(chunks.current, { type: next.mimeType || "audio/webm" }));
      next.start(250); startedAt.current = Date.now(); setState("RECORDING");
    } catch { cleanup(); setResult({ error: "Allow microphone access and select a working input device, then try again." }); setState("ERROR"); }
  }, [cleanup, finish, props.timeLimitSec, state]);

  useEffect(() => { if (state !== "RECORDING") return; const timer = window.setInterval(() => setRemaining((value) => { if (value <= 1) { window.clearInterval(timer); stop(); return 0; } return value - 1; }), 1000); return () => window.clearInterval(timer); }, [state, stop]);
  useEffect(() => { const release = () => { if (!holding.current) return; holding.current = false; stop(); }; window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release); return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); }; }, [stop]);
  useEffect(() => () => { window.clearTimeout(stopTimer.current); if (recorder.current?.state === "recording") recorder.current.stop(); else cleanup(); }, [cleanup]);
  const retry = () => { submitted.current = false; key.current = createClientId(); setRemaining(props.timeLimitSec); setResult(undefined); setState("READY"); };
  const label = state === "RECORDING" ? "Release to submit" : state === "READY" ? "Hold to speak" : state === "RETRY_REQUIRED" || state === "ERROR" ? "Hold to try again" : state === "PASSED" ? "Moving to next…" : "Processing…";
  return <section className="recorder-card"><div className="timer-row"><span className={`state-pill ${state.toLowerCase()}`}>{state.replaceAll("_", " ")}</span><strong><span>{remaining}</span> SEC</strong></div><div className="timer-track"><span style={{ width: `${(remaining / props.timeLimitSec) * 100}%` }} /></div><div className="training-prompt"><p className="eyebrow">SPEAKING PRACTICE</p><h1>{props.korean}</h1><p className="threshold">TARGET SCORE <strong>{props.passScore}</strong> / 5.0</p></div><p className="recording-hint">Press and hold while speaking, then release to submit</p><div className={`mic-level ${state === "RECORDING" ? "active" : ""}`} aria-label="Live microphone level"><span style={{ width: `${inputLevel}%` }} /></div><button className={`talk-button ${state === "RECORDING" ? "recording" : ""}`} disabled={["SUBMITTING", "EVALUATING", "PASSED"].includes(state)} onPointerDown={(event) => { if (state === "COUNTING" || state === "RECORDING") return; event.preventDefault(); holding.current = true; void start(); }} onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat && state !== "COUNTING" && state !== "RECORDING") { event.preventDefault(); holding.current = true; void start(); } }} onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); holding.current = false; stop(); } }}><span>🎙</span>{label}</button>{result && <div className={`evaluation-result ${result.passed ? "pass" : "fail"}`}>{result.mock && <small>DEVELOPMENT MOCK ASSESSMENT</small>}{result.speechProviderVersion?.startsWith("groq:") && <small>GROQ WHISPER SPEECH ASSESSMENT</small>}{result.transcript && <div className="recognized-speech"><strong>RECOGNIZED SPEECH</strong><p>{result.transcript}</p></div>}{result.finalScore !== undefined && <strong className="score">{result.finalScore.toFixed(2)} <small>/ 5.0</small></strong>}{result.scores && <div className="score-grid">{Object.entries(result.scores).map(([name, score]) => <span key={name}><small>{name}</small><strong>{Math.round(score)}</strong></span>)}</div>}{result.error && <p className="evaluation-error">{result.error}</p>}{(state === "RETRY_REQUIRED" || state === "ERROR") && <button className="ghost-button" onClick={retry}>Try this question again</button>}{state === "PASSED" && !props.autoAdvance && <button className="primary-button" onClick={() => router.refresh()}>Next question</button>}</div>}</section>;
}
