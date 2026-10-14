# NEER AI

NEER AI is a marine information assistant for oceans, seas, rivers, ponds,
boats, water safety, navigation, marine locations, and related map data.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

The chat API runs on the server at `/api/chat`. Add these variables to
`.env.local` for local development:

```env
GEMINI_API_KEY=your_primary_gemini_api_key
GEMINI_API_KEY_BACKUP=your_backup_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest
```

Never commit `.env.local` or put API keys in client-side code. The backup key is
used when the primary provider request fails.

## Deploy

For Vercel:

1. Import this repository into Vercel.
2. In **Project Settings → Environment Variables**, add
   `GEMINI_API_KEY`, `GEMINI_API_KEY_BACKUP`, and `GEMINI_MODEL` for the
   Production environment.
3. Redeploy after saving the variables.
4. Confirm the deployment can reach `https://your-domain/api/chat` with the app
   UI. Do not expose the API keys in the browser.

The POST API route runs on the server and reads the runtime environment
variables correctly. The app starts at the login screen, then continues to the
welcome screen and main chat.

## Checks

```bash
npm run lint
npm run build
```
