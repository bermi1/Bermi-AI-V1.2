# Bermi Life OS

Screens: **My Day**, **My Learning**, **My Money** (budget, savings plans, Idea lab), **My Wellbeing** (with the opt-in
**Period tracker** at `/my/cycle`), plus the assistant (companion) and the full chat at `/chat`.

## Principles

- Nothing is invented. Anything we can't measure says "unavailable".
- The assistant only *proposes*; the server validates and checks conflicts deterministically; the person confirms.
- Model output is untrusted: every item is sanitised per kind (`server/src/life/kinds.js`).
- Planned savings are plans, not money. AI credits are a usage allowance, not money.
- Administrators get aggregates only. Journals, money plans, ideas, health, faith, notes and cycle data are never shown,
  and those kinds are left out of adoption metrics.

## Data

One generic per-user table (`life_items`: user, id, kind, JSON data). Kinds: task, event, goal, saving, expense, budget,
mood, gratitude, reflection, habit, focus, reading, note, saved, skill, session, idea, cycle, profile,
wellbeing_prefs, notify_prefs.

**Supabase**: apply `server/migrations/001_life_os.sql` once (the DDL connector was blocked in the build session). Until
then the API answers `503 life_not_provisioned` and the UI says the section is being set up. SQLite creates its tables on start.

## Credits

Append-only ledger, idempotency keys, atomic reservation, refund on any provider failure, monthly top-ups, kill switch
and global daily cap (Bermi Control). Priced features: `companion_plan`, `study_materials`, `idea_shape`
(editable in Bermi Control). Deterministic features (scheduling, budgets, planner, flashcard review) are free.

## Free AI, agent and voice

- **Free-first providers**: Groq, Cerebras and NVIDIA NIM are tried before OpenRouter (whose models are billed). The NVIDIA key
  can be named `NVIDIA_API_KEY` or `NVIDIA_NIM`. Keys can also be added in Bermi Control without a redeploy.
- **Small tokens**: the companion uses the small `bermi-fast` model with a 700-token reply cap and at most 3 tool calls per request;
  tool results are truncated. Early-access plan: 150 credits a month (editable in Bermi Control).
- **Agent**: `server/src/life/agent.js`. The model may call read-only tools (`schedule`, `free_slots`, `money`) on the signed-in
  person's own data, then answers and/or *proposes* changes. It never writes: proposals still go through validation, conflict
  checks and the person's confirmation. Turning off "use my goals and schedule as context" disables the tools.
- **Voice**: on-device speech recognition when the browser has it (otherwise Bermi's transcription), English or Kiswahili.
  Voice mode sends what you say, reads the reply aloud and listens for "confirm" / "cancel". "Open my money" style commands run
  on the device with no AI and no credits.

## Audio that keeps playing

- **Audiobooks** (`audioPlayer.tsx`): Bermi's own player — chapters from the Internet Archive (`GET /api/life/audiobooks/:id/tracks`,
  cached, published books only), ±15/30 s, speed, sleep timer, per-book resume, lock-screen controls. One audio element lives at
  the top of the app, so it plays on while you move around.
- **Beats** (`beatsPlayer.tsx`): one YouTube player lives at the top of the app as a small visible card that grows into a panel;
  tracks change through the player API so it never restarts when you navigate. A generated ambient layer (hush / rain / air) can
  sit underneath, with a beat-vs-ambient balance. Starting a book pauses the beats and vice versa.
- **"Play me the best beat"** (`POST /api/life/audio/pick`, `life/dj.js`): type what you need ("study hard, balance the sound").
  Keyword rules (English + Kiswahili) pick a mood, a playlist, the beat volume and the ambient layer — free and instant. Only a
  request the rules can't read uses a 1-credit AI classification (refunded on failure); otherwise an honest default is used.
  The companion understands "play me something to focus" too.
- **Limits**: YouTube may pause when a phone locks its screen or the browser is backgrounded; audiobooks (plain audio) continue.
  Archive/YouTube availability can't be guaranteed.

## Content

- Books/concepts/verses/sessions are seeded and layered with admin overrides; only `published` items reach users.
  Concept texts are original explanations of public-domain works — **have them reviewed before wider launch**.
- **Focus audio**: 55 YouTube links in five moods (`server/src/life/playlist.js`) played in YouTube's own embedded player.
  They were found by search and are **not individually verified**; an unplayable one is reported in the player with a link out.
  Replace or remove any of them in Bermi Control → Content → audio.
- **Audiobooks**: ten public-domain LibriVox recordings played in the Internet Archive's player; covers are the images the
  archive item carries (generated cover as fallback). Identifiers were taken from search results — confirm each plays.
- No Qur'an text is shipped (needs a licensed, verified source). Christian verses are KJV (public domain in the USA).

## Period tracker

Opt-in, private, own rose palette. Predictions are plain averages of what the person logged and are labelled estimates;
ovulation is a rough guess and the UI says it is not a fertility or contraception tool. "Delete all" removes every entry in one request.

## Idea lab

A private diary of raw thoughts (business, investing, stocks, saving). "Turn it into something useful" (credits) returns
assumptions, small experiments, risks, first steps and questions. The prompt forbids predictions, prices, returns or
buy/sell advice; investing categories always show an educational-only notice.

## Not built / limits

- No push notifications or background reminders (needs VAPID keys and a per-minute scheduler; Vercel Hobby cron is daily).
- No payment provider, so revenue/conversion/churn show "unavailable".
- Large-document background queue is not implemented; uploads are converted to text and capped at 40,000 characters.
- Credit concurrency on Supabase uses an advisory-lock SQL function that has not been exercised against a live database.
- YouTube/Archive availability and cover loading depend on those hosts.

## Discover — the personal briefing (news, opportunities, reading)

Open **Discover** (`/my/discover`). Bermi turns who you are into a live, explainable feed.

**What it understands** — your profile interests and goals, the persona you pick ("Investor", "Medical student"…), topics you follow, free-text interests (any topic works), an ambition sentence, your country/city and language (English / Kiswahili / both). Code: `server/src/briefing/{topics,countries,plan}.js`. Faith topics appear only if you choose them.

**Where it looks**
- A registry of ~170 live RSS/Atom feeds plus ~25 official, link-only institutions (`briefing/sources.js`), each tagged by topic, region, language, kind and trust tier.
- Live search lanes that reach beyond the registry: Google News (local edition for your country, any interest), PubMed and arXiv (research), Open Library (books), Remotive (remote jobs), Tavily as a last resort for custom interests.
- Only headlines, a short snippet, a link and a thumbnail URL are kept. Full articles are never copied.

**How it ranks** (`briefing/rank.js`) — relevance to what you follow × freshness (per kind) × locality × source trust × language, with near-duplicate stories merged ("N outlets"), per-source diversity caps, closed opportunities removed, and deadlines shown only when the text states one. "Breaking" requires < 3 h old **and** a primary newsroom or multiple outlets. Every card says why it is there.

**Reliability** — one cache entry per source/lane, shared across users; failing feeds back off (10 min → 24 h) and fall back to their last good copy; a request refreshes stale data for at most ~9 s; the daily cron works through the whole registry within its own budget. Bermi Control → AI operations → *Briefing sources* shows which feeds actually answer and lets an admin check all feeds or disable one.

**Honesty** — feed URLs were written from publisher knowledge and are **not verified from the build environment**; the board shows the truth after deploy. If nothing can be reached the screen says so; nothing is invented.

**Credits** — reading the feed is free. "Brief me" (an AI summary of already-fetched headlines tied to your goals) costs 2 credits and refunds on failure.

**Focus guard** — during a focus session, the Focus timer records how long you leave the app (Page Visibility). It cannot see what you do elsewhere; it only notes that you stepped away, and shows "% focused". Switch it off in the timer.
