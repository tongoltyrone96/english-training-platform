# Vercel 배포 안내

이 프로젝트는 Vercel의 임시 파일시스템을 영구 저장소로 사용하지 않습니다. 앱과 API는 Vercel Functions에서 실행하고, 데이터는 관리형 PostgreSQL, 발표 자료는 Private Vercel Blob에 저장합니다. 발표 자료는 브라우저에서 Blob으로 직접 전송하므로 30 MB 파일도 Function 요청 본문 제한을 통과하지 않습니다.

## 1. 준비

- Vercel 계정
- GitHub 계정과 이 프로젝트를 올린 private repository
- Groq API key
- 운영 관리자 이메일과 외부에 공개하지 않을 초대코드(8자 이상)

먼저 변경 사항을 GitHub repository에 push합니다. `.env` 파일은 절대로 commit하지 않습니다.

## 2. Vercel 프로젝트 만들기

1. Vercel Dashboard에서 **Add New → Project**를 선택합니다.
2. GitHub repository를 import합니다.
3. Framework Preset은 **Next.js**, Root Directory는 repository의 프로젝트 루트로 둡니다.
4. 아직 Deploy하지 말고 환경변수와 저장소부터 연결합니다.

## 3. PostgreSQL 연결

1. Vercel 프로젝트의 **Storage** 또는 **Integrations**에서 Neon PostgreSQL을 추가합니다.
2. 같은 Vercel 프로젝트에 연결하고 Production/Preview/Development 환경을 선택합니다.
3. Integration이 만든 pooled PostgreSQL URL을 `DATABASE_URL`로 사용합니다. 자동 생성된 변수명이 다르면 `DATABASE_URL`을 별도로 만들고 그 값을 복사합니다.
4. 로컬 PC 주소인 `127.0.0.1:55432`는 Vercel에서 절대 사용할 수 없습니다.

## 4. Private Blob 연결

1. 프로젝트 **Storage → Create Database → Blob**으로 이동합니다.
2. 접근 유형은 **Private**로 만들고 현재 프로젝트에 연결합니다.
3. 연결하면 `BLOB_READ_WRITE_TOKEN`이 프로젝트 환경변수에 자동 추가됩니다.
4. 기존 로컬 `PRESENTATION_STORAGE_DIR`는 Vercel에 설정하지 않습니다.

## 5. 환경변수 입력

Project Settings → Environment Variables에서 [`.env.vercel.example`](../.env.vercel.example)의 항목을 등록합니다. 최소 필수값은 다음과 같습니다.

- `DATABASE_URL`: 관리형 PostgreSQL 연결 문자열
- `AUTH_SECRET`: 32자 이상의 무작위 비밀값 (`openssl rand -base64 32`로 생성 가능)
- `AUTH_TRUST_HOST=true`
- `AUTH_SECURE_COOKIES=true`
- `AUTH_URL=https://실제-프로젝트주소.vercel.app`
- `INITIAL_ADMIN_EMAIL`: 최초 관리자 가입 이메일
- `INITIAL_INVITATION_CODE`: 최초 가입용 비밀 초대코드
- `APP_TIME_ZONE`: 예: `Europe/London` 또는 `Asia/Pyongyang`
- `GROQ_API_KEY`, `GROQ_WHISPER_MODEL`, `GROQ_LANGUAGE_MODEL`
- `EVALUATION_MODE=real`
- `BLOB_READ_WRITE_TOKEN`: Blob 연결 시 자동 생성

Production에 실제 주소를 넣습니다. Preview 배포도 별도로 로그인 시험을 할 경우 Preview용 `AUTH_URL`을 고정하지 말고 해당 배포 URL에 맞춰 관리해야 합니다. 환경변수를 바꾼 뒤에는 반드시 재배포합니다.

## 6. 첫 배포

Vercel에서 **Deploy**를 누릅니다. `vercel-build`가 Prisma Client를 생성한 뒤 Next.js production build를 수행합니다.

## 7. 운영 DB migration과 초기 데이터

최초 한 번, 프로젝트 폴더의 PowerShell에서 아래처럼 실행합니다. 각 따옴표 안에는 Vercel에 입력한 운영값을 넣습니다.

```powershell
$env:DATABASE_URL="postgresql://..."
$env:INITIAL_INVITATION_CODE="your-private-invitation-code"
$env:APP_TIME_ZONE="Europe/London"
npm run db:generate
npm run db:deploy
npx tsx prisma/seed.ts
```

끝난 뒤 같은 PowerShell 창에서 비밀값을 제거합니다.

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:INITIAL_INVITATION_CODE
Remove-Item Env:APP_TIME_ZONE
```

Migration은 build 명령에 넣지 않았습니다. 동시에 여러 배포가 실행될 때 migration이 충돌하지 않도록 운영자가 새 migration 배포 시 한 번 실행합니다.

## 8. 관리자 가입과 확인

1. 배포 주소의 Sign up을 엽니다.
2. `INITIAL_ADMIN_EMAIL`과 정확히 같은 이메일, `INITIAL_INVITATION_CODE`로 가입합니다.
3. 관리자 설정에서 새 초대코드를 발급하고 일반 사용자를 가입시킵니다.
4. 관리자 DOCX 교체, Training 시작, 마이크 녹음/평가, 달력 즉시 반영을 확인합니다.
5. 발표 일정을 만든 뒤 PPT/PDF 업로드와 다른 사용자의 다운로드를 확인합니다.

## 9. 배포 후 주의사항

- Groq 무료 한도와 Vercel/Neon/Blob 무료 한도는 각 서비스 정책에 따라 달라질 수 있습니다.
- Vercel 도메인은 HTTPS이므로 브라우저 마이크 사용 조건을 충족하지만, 사용자가 사이트의 마이크 권한을 직접 허용해야 합니다.
- Groq key, DB URL, Blob token을 브라우저용 `NEXT_PUBLIC_` 변수로 만들지 마십시오.
- 정기적으로 PostgreSQL 백업과 Blob 보존 정책을 확인하십시오.
- API key가 노출되었다고 의심되면 즉시 폐기하고 새 key로 교체한 뒤 재배포합니다.
