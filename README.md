# Bermi AI

A Claude-style AI chat interface with a docked document dashboard, powered by
[OpenRouter](https://openrouter.ai). Deep blue-purple identity (`#3B2FBF`),
light + dark mode, fully responsive from 375px up.

## Features

- **Streaming chat** — tokens render as they arrive over SSE, with full
  markdown (GFM tables, syntax-highlighted code blocks, lists)
- **Collapsible sidebar** — new chat, conversation search, recents grouped by
  date, profile row that opens Settings
- **Model selector** — pick from a configurable list of OpenRouter models
  (`server/config/models.json`)
- **Dashboard** — a docked side panel (bottom sheet on mobile) with stats and
  three tabs: versioned document cards, Brains, and connected Apps — not a
  chat thread
- **Company & Personal Brains** — two persistent knowledge stores, editable
  from the Dashboard, injected into every conversation while enabled
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
| OAuth redirect base | `PUBLIC_URL` env var (defaults to the request host) |
| Chromium binary for PDF export | `CHROME_PATH` env var |
| Server port | `PORT` (default 3001) |

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
