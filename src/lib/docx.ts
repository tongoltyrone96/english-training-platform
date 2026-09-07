import mammoth from "mammoth";

export const DOCX_MAX_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

export type ParsedSentence = { korean: string; english: string; duplicate: boolean; issues: string[] };

function hasKorean(value: string) { return /[가-힣]/.test(value); }
function hasEnglish(value: string) { return /[A-Za-z]/.test(value); }

export function parseSentenceText(text: string, existingPairs = new Set<string>()) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries: ParsedSentence[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const cleanKorean = (value: string) => value.replace(/^[→▶•-]\s*/, "").trim();
  const cleanEnglish = (value: string) => value.replace(/^\d{1,3}[.)]\s*/, "").trim();
  const isSectionHeading = (value: string) => /^\d+[.)]\s*.*\([^)]*[가-힣][^)]*\)\s*$/.test(value);
  for (let index = 0; index < lines.length;) {
    const first = lines[index];
    if (isSectionHeading(first)) { index++; continue; }
    const second = lines[index + 1];
    if (!second) { errors.push(`번역 쌍을 찾지 못했습니다: ${first}`); break; }
    let korean: string; let english: string;
    if (hasKorean(first) && hasEnglish(second) && !hasKorean(second)) { korean = cleanKorean(first); english = cleanEnglish(second); }
    else if (hasEnglish(first) && !hasKorean(first) && hasKorean(second)) { korean = cleanKorean(second); english = cleanEnglish(first); }
    else { errors.push(`문장 순서를 인식하지 못했습니다: ${first}`); index++; continue; }
    const key = `${korean}\u0000${english}`.toLocaleLowerCase();
    const issues: string[] = [];
    if (!hasKorean(korean)) issues.push("한국어 문장으로 인식되지 않습니다.");
    if (!hasEnglish(english) || hasKorean(english)) issues.push("영어 번역을 확인해 주세요.");
    if (korean.length > 300 || english.length > 500) issues.push("문장이 허용 길이를 초과합니다.");
    const duplicate = seen.has(key) || existingPairs.has(key);
    if (duplicate) issues.push("중복 문장입니다.");
    seen.add(key);
    entries.push({ korean, english, duplicate, issues });
    index += 2;
  }
  if (entries.length === 0) errors.push("가져올 문장 pair가 없습니다.");
  return { entries, errors };
}

export async function parseSentenceDocx(file: File, existingPairs = new Set<string>()) {
  if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("DOCX_EXTENSION");
  if (!allowedMimeTypes.has(file.type)) throw new Error("DOCX_MIME");
  if (file.size === 0 || file.size > DOCX_MAX_BYTES) throw new Error("DOCX_SIZE");
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) throw new Error("DOCX_SIGNATURE");
    const result = await mammoth.extractRawText({ buffer });
    return parseSentenceText(result.value, existingPairs);
  } catch (error) {
    if (error instanceof Error && error.message === "DOCX_SIGNATURE") throw error;
    throw new Error("DOCX_CORRUPT");
  }
}
