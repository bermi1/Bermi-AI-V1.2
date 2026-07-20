# Bermi AI

A Claude-style AI workspace powered by [OpenRouter](https://openrouter.ai):
streaming chat, a full-page dashboard, versioned document generation, company
and personal AI brains, and connectors. Installable as a PWA, light + dark
mode, fully responsive from 375px up.

## Features

- **Accounts & auth** — Claude-style signup/login pages ("Continue with
  Google" + email/password), scrypt-hashed passwords, httpOnly cookie
  sessions; conversations and documents are scoped per user. Internal auth
  is the default so signup always works; `AUTH_PROVIDER=supabase` delegates
  to Supabase Auth
- **Google sign-in** — one-click login/signup with a Google account
  (set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; same credentials as the
  Gmail connector)
- **Registration emails from Supabase** — with the Supabase backend active,
  Supabase Auth owns credentials and sends its own confirmation emails
  (no SMTP setup needed); users click the link, then sign in. On the
  SQLite fallback, a local scrypt flow is used (optional branded code
  emails via Resend/SMTP, instant activation with no email config)
- **Managed AI** — the server's OpenRouter key powers every account; users
  never bring or see an API key
- **Streaming chat** — tokens render as they arrive over SSE, with full
  markdown (GFM tables, syntax-highlighted code blocks, lists)
- **File uploads in chat** — attach .txt/.md/.csv/.json or PDF; the server
  extracts the text and Bermi carries it as conversation context
- **Collapsible sidebar** — new chat, conversation search, recents grouped by
  date, profile row that opens Settings
- **Model selector** — pick from a configurable list of OpenRouter models
  (`server/config/models.json`)
- **Full-page dashboard** — stat tiles, searchable document grid, brain
  cards, connected apps with a recent-Gmail widget, and recent conversations
- **Three brains** — Company, Personal, and a pre-loaded **Vibe Coding
  Instructor** brain (curriculum, prompting techniques, tool guidance,
  teaching plan) injected into every conversation while enabled
- **Feed the knowledge base from files** — upload .txt/.md/.csv/.json/.docx/
  .pdf inside any brain editor; text is extracted and appended to that
  brain's knowledge
- **Profile personalization** — name, work context, and response preferences
  (Claude-style) ride along with every chat
- **Connectors** — Google OAuth built in (Gmail/Calendar/Drive read scopes,
  token refresh, recent-inbox widget); Slack/Notion/GitHub registered in the
  framework
- **Supabase or SQLite** — storage adapter uses Supabase (Postgres) when
  configured and reachable, otherwise local SQLite; identical interface
- **Invoice generator** — form → AI-drafted copy → styled document → PDF
  export. Every edit is saved as a **new version**, never overwritten
- **Full settings dialog** — tabbed like Claude's: Profile, Appearance,
  Models (with add-your-own OpenRouter models), Connectors, API & Data

## Architecture

```
client/   React 18 + Vite + Tailwind (TypeScript)
server/   Express (ESM) — OpenRouter SSE proxy, storage adapter, OAuth, PDF export
```

Storage is an adapter (`server/src/storage/`): `SupabaseStorage` (Data API,
tables prefixed `bermi_*`) when `SUPABASE_URL` + `SUPABASE_KEY` are set and
reachable at startup, `SqliteStorage` otherwise — same async interface, so
routes never care. The chat system prompt is assembled per request from the
base prompt + profile personalization + enabled brains.

The browser never talks to OpenRouter directly. The Express server owns the
API key (environment variable or the server-side settings store) and proxies
`POST /api/chat`, re-streaming tokens to the client. Because the LLM API is
stateless, the server replays the full stored conversation history on every
request.

PDF export renders the invoice HTML template with `puppeteer-core` against a
system Chromium (`CHROME_PATH` to override the binary location).

## Brand & PWA

The official Bermi "b + sparkle" mark lives in `client/public/favicon.svg`
and as a React component in `client/src/components/Logo.tsx`. The app ships
a web manifest, service worker, and 192/512 icons — it installs to the home
screen on iOS/Android and desktop.

## Getting started

```bash
npm install
cp .env.example .env        # add your OPENROUTER_API_KEY (optional — can also
                            # be entered later in Settings)
npm run dev                 # client on :5173, API on :3001
```

Production:

```bash
npm run build               # builds client/dist
npm start                   # Express serves API + built client on :3001
```

## Security notes

- The OpenRouter API key lives **server-side only** — it is read from
  `OPENROUTER_API_KEY` or stored via Settings into SQLite, and only a masked
  hint (`…last4`) is ever returned to the browser.
- `.env` and `server/data/` (the SQLite database) are gitignored.

## Configuration

| What | Where |
| --- | --- |
| OpenRouter API key | `.env` (`OPENROUTER_API_KEY`) or Settings → API & Data |
| Available models | `server/config/models.json` + Settings → Models (custom) |
| Model used for invoice drafting | `DRAFT_MODEL` env var (default: `anthropic/claude-haiku-4.5`) |
| Supabase database | `SUPABASE_URL` + `SUPABASE_KEY` env vars |
| Google connector | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars |
| Registration emails | `RESEND_API_KEY` **or** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, plus `EMAIL_FROM` |
| OAuth redirect base | `PUBLIC_URL` env var (defaults to the request host) |
| Chromium binary for PDF export | `CHROME_PATH` env var |
| Server port | `PORT` (default 3001) |

### Supabase Auth email setup

Confirmation emails are sent by Supabase automatically. One thing to set once
in the Supabase Dashboard → Authentication → URL Configuration: make **Site
URL** your app's address (e.g. `https://yourapp.com` or
`http://localhost:3001`) so the email's confirmation link lands back on
Bermi. Supabase's built-in mailer has modest rate limits; for production
volume, plug your own SMTP into Supabase → Project Settings → Auth.

### Google connector setup

1. Create OAuth 2.0 credentials in Google Cloud Console (type: Web application)
2. Add redirect URI: `http://localhost:3001/api/connectors/google/callback`
   (or `<PUBLIC_URL>/api/connectors/google/callback` in production)
3. Put the client id/secret in `.env`, restart, then Settings → Connectors →
   Connect Google. Gmail (readonly), Calendar (readonly), and Drive (metadata)
   scopes are requested with offline access; tokens auto-refresh.

## Responsive behavior

Tested at 375px, 768px, and 1280px:

- Sidebar collapses to a hamburger-triggered drawer on mobile
- The Documents dashboard docks to the right on desktop and becomes a bottom
  sheet on narrow viewports
- The chat input bar sticks to the bottom of the viewport
