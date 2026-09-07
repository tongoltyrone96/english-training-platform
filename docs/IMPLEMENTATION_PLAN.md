# 구현 계획

## 결정 사항

- Next.js 16 App Router, TypeScript, PostgreSQL/Prisma, Auth.js Credentials/JWT 세션을 사용한다.
- 운영 날짜와 ISO week는 서버의 `APP_TIME_ZONE`을 기준으로 계산한다. 브라우저 시간은 표시 보조용으로만 사용한다.
- Groq Whisper와 Groq 언어평가 구현은 provider interface 뒤에 두며, 외부 평가 결과와 최종 점수 계산을 분리한다.
- 오디오는 요청 처리 중에만 임시 보관하고 `finally`에서 삭제한다. DB 모델에는 audio URL이나 binary 필드를 두지 않는다.
- 시험/훈련 시작 시 문장, 설정, prompt/provider version snapshot을 보존한다.

## 단계

1. **Foundation (완료, 실행 검증 대기)**: 프로젝트 설정, 전체 DB 모델, 초대 가입, 최초 관리자, 로그인, 서버 RBAC, dashboard shell.
2. **Content (완료, 실행 검증 대기)**: 달력 조회, 문장 생성/활성 상태 관리, DOCX 검증/preview/선택 import, 전역 설정, 감사 로그.
3. **Training (구현, 실행 검증 대기)**: 세션 생성/복구, 상태 머신, pointer-capture 녹음, timer 강제 종료, idempotent 제출, 재시도 잠금.
4. **Evaluation (구현)**: Groq Whisper/GPT-OSS provider, schema 검증, 결정론적 점수, mock/실연동 테스트 분리.
5. **Test (구현, DB/E2E 검증 대기)**: 토요일/ISO week 제한, 주 1회 unique lock, 무작위 순서 snapshot, 중간 결과 비공개, 완료 결과.
6. **Analytics (구현)**: 일/주 집계, 임시·정식 순위, 동점 규칙, Recharts 및 전주 비교.
7. **Hardening (진행 중)**: DB rate limit, 보안 헤더, 업로드 signature 검사는 구현했다. Playwright E2E, 실제 DB integration, 배포 검증이 남았다.

## 중요 미확정 사항

- 배포 대상과 PostgreSQL 제공자
- Groq 무료 플랜 rate limit과 Whisper 모델 가용성
- Groq 평가 model의 가용성과 고정 버전
- 실제 초대코드와 운영 시간대

이 값들은 구현 구조를 바꾸지 않으므로 환경변수로 남기고 진행한다.

## Phase 2 구현 메모

- DOCX는 확장자, MIME, 5MB 제한과 손상 여부를 검사한다. 원본 binary는 저장하지 않으며 SHA-256과 parsing 결과만 `DocumentImport`에 기록한다.
- preview 항목은 서버 DB에 고정한 후 index로 선택하므로 확인 요청에서 문장 내용을 임의 변조할 수 없다.
- 월간 달력은 운영 시간대의 오늘을 기준으로 하며 월 이동, 날짜 선택, Training 진행/달성 및 Test 결과 표시를 지원한다.
- 문장 추가·활성화 변경, DOCX preview/import, 설정 변경은 `AuditLog`에 남긴다.

## Phase 3 구현 메모

- 사용자·운영 날짜별 session unique constraint로 새로고침 시 기존 세션을 복구한다.
- 시작 시 문제 순서와 설정을 고정하며 통과 전에는 서버가 현재 position 이외의 제출을 거부한다.
- push-to-talk는 pointer capture 및 keyboard 입력을 지원하고 제한시간 0초에 `MediaRecorder.stop()`을 한 번만 실행한다.
- idempotency key 재요청은 기존 평가 결과를 반환하며 audio binary와 URL은 DB 및 로그에 기록하지 않는다.
- `EVALUATION_MODE=mock`은 녹음 UI와 진행 흐름 개발 전용이다. 실제 음성 내용은 평가하지 않으며 운영 완료로 간주하지 않는다.

## Phase 4~7 구현 메모

- 브라우저 녹음을 Groq Whisper transcription API로 전송하고 단어 타임스탬프·전사 일치도·구간 확신도를 이용해 발음/유창성/완성도 추정 점수를 계산한다. 이 점수는 전문 발음평가가 아닌 proxy임을 UI에 표시한다.
- Groq Chat Completions API는 고정 prompt version과 strict JSON Schema를 사용하며 반환값을 다시 Zod로 검증한다.
- Test는 운영 시간대 토요일에만 attempt를 만들고, DB의 주간 unique constraint와 question order snapshot으로 재시험/순서 변경을 막는다.
- 시험 API는 완료 전 점수·정답·피드백을 응답하지 않는다.
- 팀 순위는 평일 70/30, 토·일 50/25/25 산식과 달성일·시험점수·완료시간 동점 규칙을 코드와 단위 테스트로 고정한다.
- 인증·음성평가 rate limit은 DB bucket을 사용하며 사용자 비활성화와 역할 변경은 다음 보호 요청부터 서버 DB 검사로 반영된다.
