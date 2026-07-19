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
- **Documents dashboard** — a docked side panel (bottom sheet on mobile) of
  structured document cards, not a chat thread
- **Invoice generator** — form → AI-drafted copy → styled document → PDF
  export. Every edit is saved as a **new version**, never overwritten
- **Settings** — profile, light/dark/system appearance, default model, and
  OpenRouter API key management
- **Persistence** — conversations, messages, documents, and versions stored in
  SQLite on the server

## Architecture

```
client/   React 18 + Vite + Tailwind (TypeScript)
server/   Express (ESM) — OpenRouter SSE proxy, SQLite, PDF export
```

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
| OpenRouter API key | `.env` (`OPENROUTER_API_KEY`) or the Settings modal |
| Available models | `server/config/models.json` |
| Model used for invoice drafting | `DRAFT_MODEL` env var (default: `anthropic/claude-haiku-4.5`) |
| Chromium binary for PDF export | `CHROME_PATH` env var |
| Server port | `PORT` (default 3001) |

## Responsive behavior

Tested at 375px, 768px, and 1280px:

- Sidebar collapses to a hamburger-triggered drawer on mobile
- The Documents dashboard docks to the right on desktop and becomes a bottom
  sheet on narrow viewports
- The chat input bar sticks to the bottom of the viewport
