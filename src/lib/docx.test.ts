import { describe, expect, it } from "vitest";
import { DOCX_MAX_BYTES, parseSentenceDocx, parseSentenceText } from "./docx";

describe("DOCX constraints", () => {
  it("keeps the upload limit at five MiB", () => expect(DOCX_MAX_BYTES).toBe(5 * 1024 * 1024));
  it("extracts Korean and English pairs", () => {
    const result = parseSentenceText("오늘은 좋습니다.\nIt is nice today.\n\n매일 운동합니다.\nI exercise every day.");
    expect(result.entries).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });
  it("extracts numbered English followed by arrow-prefixed Korean and skips section headings", () => {
    const result = parseSentenceText("1. Introduction (자기소개)\n1. Thank you for this opportunity.\n→ 이 기회를 주셔서 감사합니다.\n2. I build web applications.\n→ 저는 웹 애플리케이션을 개발합니다.");
    expect(result.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ korean: "이 기회를 주셔서 감사합니다.", english: "Thank you for this opportunity." }),
      expect.objectContaining({ korean: "저는 웹 애플리케이션을 개발합니다.", english: "I build web applications." }),
    ]));
    expect(result.errors).toEqual([]);
  });
  it("detects missing translations and duplicate pairs", () => {
    const result = parseSentenceText("안녕하세요.\nHello.\n안녕하세요.\nHello.\n번역 없음");
    expect(result.errors).toHaveLength(1);
    expect(result.entries[1].duplicate).toBe(true);
  });
  it("rejects a renamed non-ZIP file", async () => {
    const file = new File(["not a zip"], "sentences.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await expect(parseSentenceDocx(file)).rejects.toThrow("DOCX_SIGNATURE");
  });
});
