# English Training Platform

팀 내부용 영어 말하기 훈련 및 주간 시험 웹사이트입니다. Phase 1~6과 Phase 7 핵심 보안 코드가 구현되어 있습니다. 인증, 콘텐츠/DOCX 관리, Training, 실제 평가 provider, 주간 Test, 팀 chart/순위, 사용자·초대 관리와 감사 로그를 포함합니다.

## 로컬 실행

Node.js 22+, PostgreSQL이 필요합니다.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

현재 개발 PC에는 프로젝트 전용 PostgreSQL 18 클러스터가 구성되어 있습니다. 재부팅 후에는 다음 순서로 실행합니다.

```bash
export PATH="$HOME/.local/lib/node-v22.19.0-linux-x64/bin:$PATH"
npm run db:start
npm run dev
```

Linux Node.js 22는 위 사용자 로컬 경로에 설치되어 있습니다. `export`를 WSL의 `~/.bashrc`에 추가하면 새 터미널마다 입력하지 않아도 됩니다.

DB 상태 확인과 종료에는 각각 `npm run db:status`, `npm run db:stop`을 사용합니다. 전용 DB는 `127.0.0.1:55432`에서만 수신하고 SCRAM 인증을 사용합니다. 데이터 파일은 Linux 사용자 홈의 `.local/share/english-training-postgres`에 있으며 source 저장소에는 포함되지 않습니다.

`INITIAL_INVITATION_CODE`는 8자 이상으로 설정합니다. `INITIAL_ADMIN_EMAIL`과 정확히 일치하는 이메일로 최초 가입한 한 명만 ADMIN이 됩니다.

로컬 HTTP 실행은 `AUTH_SECURE_COOKIES=false`를 사용합니다. HTTPS로 배포할 때는 반드시 `AUTH_SECURE_COOKIES=true`로 변경합니다.
Windows에서 WSL IP로 접속할 때는 `AUTH_URL`을 브라우저에서 사용하는 주소와 동일하게 설정합니다.

실제 평가 연동 전 Training UI 흐름만 확인하려면 로컬 환경에서만 `EVALUATION_MODE=mock`을 사용할 수 있습니다. 이 모드는 음성을 평가하지 않고 명시적인 mock 결과를 반환하므로 운영 환경에서 사용하면 안 됩니다.

## 실제 평가 설정

- `GROQ_API_KEY`: Groq Console에서 발급한 API key
- `GROQ_WHISPER_MODEL`: 기본값 `whisper-large-v3-turbo` (정확도 우선 시 `whisper-large-v3`)
- `GROQ_LANGUAGE_MODEL`: 기본값 `openai/gpt-oss-20b` (Structured Outputs 지원)
- `EVALUATION_MODE=real`: 실제 Groq 음성인식·문장 평가 provider 사용

브라우저 audio는 서버 메모리로 수신한 후 임시 디렉터리에서 WAV로 변환합니다. 변환 파일은 성공과 오류 모두 즉시 삭제되며 DB, object storage 및 로그에는 audio나 URL을 저장하지 않습니다.

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
```

## 현재 검증 결과

- Prisma Client 생성 및 schema 검증: 통과
- TypeScript type-check: 통과
- ESLint: 오류/경고 없이 통과
- Vitest: 6개 파일, 15개 테스트 통과
- PostgreSQL integration: 1개 파일, 2개 DB constraint 테스트 통과
- Playwright E2E: 인증·잘못된 초대코드·관리자 RBAC 3개 시나리오 작성 완료
- Next.js production build: 통과 (`--webpack`)
- PostgreSQL 18 migration 및 seed 적용: 통과
- Groq 음성인식 및 문장 평가 연동

총 17개 unit/integration 테스트가 통과했습니다. 실행 smoke test에서 `/sign-in`은 HTTP 200, 미인증 `/dashboard`는 `/sign-in`으로 HTTP 307 redirect되는 것을 확인했습니다. Playwright 실행에는 `sudo npx playwright install-deps chromium`으로 WSL 브라우저 라이브러리를 한 번 설치해야 합니다.

Next.js 기본 Turbopack build는 현재 격리 환경에서 CSS worker가 내부 포트를 열 수 없어 실패했습니다. 같은 source를 webpack production build로 검증했습니다. `npm audit --omit=dev`에서 Prisma CLI 계열 `deepmerge-ts` 취약점 3건(high)이 보고되었으나 제안된 자동 수정은 Prisma를 이전 버전으로 강제 변경하므로 적용하지 않았습니다. 이는 production runtime이 아닌 migration 도구 경로이며 Prisma 업데이트 시 재검토해야 합니다.

전체 단계와 기술 결정은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 참고하세요.

Vercel용 저장소 구조와 실제 배포 순서는 [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)를 참고하세요.

## 배포 전 확인

- 관리형 PostgreSQL에 `npx prisma migrate deploy` 실행
- production `AUTH_SECRET`, 관리자 이메일, 운영 시간대 설정
- Groq key와 model ID 설정 후 실제 정답·동의표현·무음·잡음 dataset 검증
- ffmpeg 실행을 지원하는 Node.js runtime과 60초 request timeout 확인
- HTTPS, reverse proxy의 신뢰 가능한 `x-forwarded-for`, 백업과 log retention 설정
- Playwright E2E 및 실제 모바일 브라우저 microphone 권한 검증
