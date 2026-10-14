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

## API configuration

The chat API runs on the server at `/api/chat`. You do not need to add an API key
to a repository `.env` file for a Vercel deployment. In Vercel, open **Project
Settings → Environment Variables** and add `GEMINI_API_KEY` for the Production
environment, then redeploy. Optionally add `GEMINI_API_KEY_BACKUP` as a second
server-side key and `GEMINI_MODEL` to select a model. Never use a `NEXT_PUBLIC_`
prefix for these values and never put keys in client-side code.

For local development only, you can place the same values in `.env.local`:

```env
GEMINI_API_KEY=your_primary_gemini_api_key
GEMINI_API_KEY_BACKUP=your_backup_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest
```

Never commit `.env.local`. The backup key is tried if the primary key fails.

## Deploy

For Vercel:

1. Import this repository into Vercel.
2. Set `GEMINI_API_KEY` in **Project Settings → Environment Variables** for
   Production. Add the backup key and model only if needed.
3. Redeploy after saving the variable. Vercel does not receive ignored local
   `.env.local` files when deploying the repository.
4. Open `https://your-domain/api/chat`. The GET response reports whether a
   server-side key is configured without revealing it. The chat uses POST on
   that same route.

The chat route reads the key on the server at request time. Without a provider
key, a live AI response cannot be generated; the API returns a clear setup
message instead of exposing or fabricating a key. The app starts at the login
screen, then continues to the welcome screen and main chat.

## Checks

```bash
npm run lint
npm run build
```
