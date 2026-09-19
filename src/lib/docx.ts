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
    if (!second) { errors.push(`No translation pair was found for: ${first}`); break; }
    let korean: string; let english: string;
    if (hasKorean(first) && hasEnglish(second) && !hasKorean(second)) { korean = cleanKorean(first); english = cleanEnglish(second); }
    else if (hasEnglish(first) && !hasKorean(first) && hasKorean(second)) { korean = cleanKorean(second); english = cleanEnglish(first); }
    else { errors.push(`The sentence order could not be recognised: ${first}`); index++; continue; }
    const key = `${korean}\u0000${english}`.toLocaleLowerCase();
    const issues: string[] = [];
    if (!hasKorean(korean)) issues.push("This was not recognised as a Korean sentence.");
    if (!hasEnglish(english) || hasKorean(english)) issues.push("Please check the English translation.");
    if (korean.length > 300 || english.length > 500) issues.push("The sentence exceeds the allowed length.");
    const duplicate = seen.has(key) || existingPairs.has(key);
    if (duplicate) issues.push("This sentence is a duplicate.");
    seen.add(key);
    entries.push({ korean, english, duplicate, issues });
    index += 2;
  }
  if (entries.length === 0) errors.push("There are no sentence pairs to import.");
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
