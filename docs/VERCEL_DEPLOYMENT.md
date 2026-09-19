# Vercel deployment guide

This project never uses Vercel's ephemeral filesystem as permanent storage. The app and the API run on Vercel Functions, data lives in a managed PostgreSQL instance, and presentation files go to a Private Vercel Blob store. Presentation files are uploaded straight from the browser to Blob, so even a 30 MB file never has to pass through the Function request-body limit.

## 1. Prerequisites

- A Vercel account
- A GitHub account and a private repository holding this project
- A Groq API key
- The production admin email and an invitation code (at least 8 characters) that is never shared publicly

Push your changes to the GitHub repository first. Never commit the `.env` file.

## 2. Create the Vercel project

1. In the Vercel Dashboard, choose **Add New → Project**.
2. Import the GitHub repository.
3. Leave the Framework Preset as **Next.js** and set the Root Directory to the project root in the repository.
4. Don't deploy yet — connect the environment variables and the storage first.

## 3. Connect PostgreSQL

1. Add Neon PostgreSQL from the Vercel project's **Storage** or **Integrations** tab.
2. Connect it to the same Vercel project and select the Production/Preview/Development environments.
3. Use the pooled PostgreSQL URL created by the integration as `DATABASE_URL`. If the auto-generated variable has a different name, create `DATABASE_URL` separately and copy the value into it.
4. `127.0.0.1:55432` is a local-machine address and can never be used on Vercel.

## 4. Connect Private Blob

1. Go to **Storage → Create Database → Blob** in the project.
2. Create it with **Private** access and connect it to the current project.
3. Once connected, `BLOB_READ_WRITE_TOKEN` is added to the project's environment variables automatically.
4. Do not set the local `PRESENTATION_STORAGE_DIR` variable on Vercel.

## 5. Set the environment variables

Register the entries from [`.env.vercel.example`](../.env.vercel.example) under Project Settings → Environment Variables. The minimum required values are:

- `DATABASE_URL`: the managed PostgreSQL connection string
- `AUTH_SECRET`: a random secret of at least 32 characters (generate one with `openssl rand -base64 32`)
- `AUTH_TRUST_HOST=true`
- `AUTH_SECURE_COOKIES=true`
- `AUTH_URL=https://your-actual-project.vercel.app`
- `INITIAL_ADMIN_EMAIL`: the email the first admin will sign up with
- `INITIAL_INVITATION_CODE`: the secret invitation code for that first sign-up
- `APP_TIME_ZONE`: for example `Europe/London` or `Asia/Pyongyang`
- `GROQ_API_KEY`, `GROQ_WHISPER_MODEL`, `GROQ_LANGUAGE_MODEL`
- `EVALUATION_MODE=real`
- `BLOB_READ_WRITE_TOKEN`: generated automatically when Blob is connected

Use the real address for Production. If you also want to test sign-in on Preview deployments, don't pin a Preview `AUTH_URL` — keep it aligned with each deployment's own URL. Always redeploy after changing an environment variable.

## 6. First deployment

Press **Deploy** in Vercel. `vercel-build` generates the Prisma Client and then runs the Next.js production build.

## 7. Production database migration and seed data

Run the following once from PowerShell in the project folder. Put the production values you entered in Vercel inside each pair of quotes.

```powershell
$env:DATABASE_URL="postgresql://..."
$env:INITIAL_INVITATION_CODE="your-private-invitation-code"
$env:APP_TIME_ZONE="Europe/London"
npm run db:generate
npm run db:deploy
npx tsx prisma/seed.ts
```

When it finishes, clear the secrets from that same PowerShell window.

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:INITIAL_INVITATION_CODE
Remove-Item Env:APP_TIME_ZONE
```

Migrations are deliberately left out of the build command. So that concurrent deployments cannot collide on a migration, the operator runs it once when deploying a new migration.

## 8. Admin sign-up and verification

1. Open Sign up on the deployed address.
2. Sign up with exactly the same email as `INITIAL_ADMIN_EMAIL`, using `INITIAL_INVITATION_CODE`.
3. From the admin settings, issue a new invitation code and have regular users sign up.
4. Verify the admin DOCX replacement, starting Training, microphone recording and evaluation, and that the calendar updates immediately.
5. Create a presentation slot, then verify a PPT/PDF upload and a download by another user.

## 9. After deployment

- The Groq free tier and the Vercel/Neon/Blob free tiers can change according to each service's own policy.
- Vercel domains are HTTPS, so the browser's microphone requirements are met, but each user still has to grant the site microphone permission themselves.
- Never expose the Groq key, the database URL, or the Blob token as a browser-facing `NEXT_PUBLIC_` variable.
- Review the PostgreSQL backups and the Blob retention policy regularly.
- If you suspect an API key has leaked, revoke it immediately, replace it with a new key, and redeploy.
