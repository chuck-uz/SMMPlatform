# SMM Platform — Architecture

Technical documentation for developers. It explains how the platform is
structured, how each subsystem works, and the design decisions behind it. For
product/usage docs see [README.md](README.md); for the dev workflow see
[CONTRIBUTING.md](CONTRIBUTING.md).

- **Platform:** Next.js 16 (App Router, Turbopack), TypeScript, deployed as a
  standalone Docker image on DockHost.
- **Size:** ~2k lines of TypeScript across `app/src`, one Postgres database,
  one container.
- **Philosophy:** *spec-first, one roadmap item at a time*. Every feature is
  built against an explicit `done_when` criterion tracked in `roadmap.json`,
  with business logic developed test-first (Vitest) wherever it isn't a thin
  wrapper around an external API or the database.

---

## 1. High-level flow

```
Browser ──► proxy.ts (rate limit + auth gate) ──► Next.js route / page
                                                        │
                     ┌──────────────────────────────────┼──────────────────────────┐
                     ▼                                  ▼                          ▼
              NextAuth (Credentials)              Panel pages (RSC)      /api/instagram/*
              src/auth.ts                         src/app/panel/*        authorize + callback
                     │                                  │                          │
                     ▼                                  ▼                          ▼
                 Prisma ──────────────────────────► Postgres  ◄────────── instagramApiClient.ts
                 src/lib/prisma.ts                  (users, instagram_accounts)   (graph.instagram.com)
                                                                                    │
                                                                                    ▼
                                                                        src/instrumentation.ts
                                                                        (auto-renews tokens <7d from expiry)
```

The unit of work is a **roadmap task** (`F1`, `IG2`, …). Each one lands as a
small set of commits on `dev`, gets merged to `main` on explicit request, and
is marked `done` in `roadmap.json` only once its `done_when` is verified.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript | Server components for panel pages, Route Handlers for API/OAuth |
| Auth | NextAuth v5 (Auth.js), Credentials provider, JWT sessions | Email/password login for panel staff; `trustHost: true` required behind DockHost's reverse proxy |
| Database | PostgreSQL via Prisma (`prisma-client` generator, driver adapter `@prisma/adapter-pg`) | Prisma 7 requires an explicit driver adapter — no implicit connection via the schema `url` |
| Styling | Tailwind CSS v4, Inter (Cyrillic-supporting) | Design tokens in `globals.css` (`--color-*`, `--radius-*`, `--shadow-*`) |
| Testing | Vitest | Pure business logic tested via dependency injection at the seams (DB calls, external API calls injected, not mocked in-place) |
| Instagram integration | Instagram API with Instagram Login (OAuth), Graph API for token exchange/refresh | No Facebook Login/page linkage needed for a single account |
| Deployment | Docker (multi-stage: builder, prisma-tools, runner) on DockHost | Standalone Next.js output; `entrypoint.sh` runs `prisma migrate deploy` + conditional seed on every boot |
| Uptime | Scheduled GitHub Actions workflow (`.github/workflows/uptime-smm.yml`) | Pings prod every 10 min; a failed run triggers GitHub's built-in failure email — no extra infra |
| Auto-renewal | In-process `setInterval` in `src/instrumentation.ts` | The Next.js standalone server is already a long-lived process; avoids standing up a second scheduler for one job |
| Content polling | Several independent `setInterval`s in `src/instrumentation.ts` (media 15min, comments 5min, metrics 2h, story metrics 1h) | Instagram webhooks aren't reliably delivered in dev; same "no extra scheduler" reasoning as token auto-renewal, one interval per data cadence |

## 3. Source layout

All application code lives in `app/src`.

| Path | Responsibility |
|---|---|
| `proxy.ts` | Next.js 16 middleware-equivalent. Rate-limits every `/api/*` request (global 100/min, stricter 10/min on the credentials login callback); delegates `/panel/*` auth gating to NextAuth's `authorized` callback. |
| `auth.ts` | NextAuth config: Credentials provider, Prisma adapter, JWT session callbacks, `trustHost: true`. |
| `instrumentation.ts` | Runs once on server boot: starts a 6-hour interval that refreshes any `InstagramAccount` token expiring within 7 days. |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth's own route handlers. |
| `app/api/instagram/authorize/route.ts` | Redirects to Instagram's OAuth authorize URL (Track A scopes only), sets a CSRF `state` cookie. |
| `app/api/instagram/callback/route.ts` | Validates `state`, exchanges the code for a long-lived token via `instagramOAuth.ts`, stores it encrypted. |
| `app/panel/*` | Server-rendered panel pages: `connections`, `users` (admin-only), `profile`, `analytics` (multi-account charts/table/demographics), `scenarios` (admin-only AI agent core: tone, knowledge base, examples, sandbox), `leads` (admin+manager: status-filtered list of collected `Lead` records, "take into work"/"close" transitions), plus a stub for the module not yet built (`inbox`, now scoped to dialogue history only — lead cards moved to `leads`). Each mutable page pairs with an `actions.ts` (server actions). |
| `lib/instagramOAuth.ts` | Pure, dependency-injected OAuth orchestration: `buildAuthorizeUrl`, `connectInstagramAccount`, `refreshAccountToken`, `daysUntilExpiry`. The real Instagram API calls are injected as an `InstagramApiClient`, so this is fully unit-tested without hitting the network. |
| `lib/instagramApiClient.ts` | The real `InstagramApiClient` implementation (`fetch` calls to `api.instagram.com` / `graph.instagram.com`). Not unit-tested — same boundary treatment as `prisma.ts`. |
| `lib/encryption.ts` | AES-256-GCM `encrypt`/`decrypt`, key passed as a parameter (never read from `process.env` inside the function) — used to store the Instagram access token. |
| `lib/verifyWebhookSignature.ts` | HMAC-SHA256 signature verification (`sha256=<hex>`, matching Meta's `X-Hub-Signature-256`). Built ahead of any real webhook endpoint, for the future Instagram Direct/Track B work. |
| `lib/rateLimiter.ts` | In-memory, fixed-window rate limiter (`Map`-based, per process). Not shared across replicas — revisit if `smm` ever scales beyond one. |
| `lib/verifyCredentials.ts`, `changePassword.ts`, `createUser.ts`, `setUserActive.ts` | Panel auth/user-management business logic, each paired with a `.test.ts`. |
| `lib/claudeApiKey.ts` | Pure, dependency-injected logic for saving the platform's Claude API key: verifies it against the real API, then encrypts it. The verification client is injected (`ClaudeApiClient`), so this is unit-tested without a real key or network call. |
| `lib/claudeApiClient.ts` | The real `ClaudeApiClient` implementation — calls Anthropic's `GET /v1/models` (cheap, no token cost) to check the key is valid. Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/instagramPoller.ts` | Pure normalization functions for the content poller: `normalizeMedia`, `normalizeComment`, `flattenInsights`, `buildMetricSnapshot`, `isActiveStory`, `normalizeFollowerCount`, `shouldFetchDemographics`, `buildDemographicsMetrics`, `dailyHistory` (groups snapshots into one-per-calendar-day, also the fallback for expired stories). Fully unit-tested against fixture Graph API payloads — no network or DB. |
| `lib/instagramContentClient.ts` | The real Graph API calls (`graph.instagram.com/me/media`, `/{media-id}/comments`, `/me/insights`, `/{media-id}/insights`, `/me` for follower count, demographics breakdown insights). Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/analyticsDashboard.ts` | Pure read-side functions for the analytics dashboard: `buildAccountMetricCharts`/`buildMetricSeries` (per-metric Recharts series from `dailyHistory()` output), `buildMediaTableRows` (attaches latest metric snapshot to each media row), `parseAgeGenderBreakdown`/`parseGeographyBreakdown` (unpack Meta's nested `total_value.breakdowns[].results[]` demographics shape into chart-ready bars). Fully unit-tested against fixture payloads — no network or DB, mirrors the poller/client split (`instagramPoller.ts` = write-side, this = read-side). |
| `lib/analyticsSummary.ts` | Pure media-engagement/pattern utilities, shared by the unified AI-разбор: `buildMediaEngagements`/`rankMedia` (FEED/REELS only, top/bottom-3 by `total_interactions`), `buildWeekdayPattern`/`buildTimeOfDayPattern` (gated at 3+ samples per bucket), `detectAnomalies` (day deviates >50% from the window average, gated at 4+ data points). No longer owns period selection or metric deltas — that moved to `accountInsights.ts`. Fully unit-tested, no DB access. |
| `lib/accountInsights.ts` | Pure functions for the unified AI-разбор (supersedes AN3/AN4/GROW1's separate `analysisReport.ts`/`growthInsights.ts`): `buildMediaFormatEngagements`/`buildFormatBreakdown` (engagement per media format, gated at 3+ samples), `buildMetricTrends` (first-half-vs-second-half split of a fixed 90-day window, generalized to **every** account metric — stock `followerCount` compared by last value per half, flow metrics by average per half — not just reach), `buildDemandSignal` (leads grouped by destination, `available: false` when empty), `buildInsightsPrompt`/`parseInsightsContent` (5-field schema: `summary`/`observations`/`gaps`/`direction`/`recommendations`), `shouldSkipManualInsights` (5-minute cooldown), `isInsightsDigestDue` (7-day gate). Fully unit-tested. |
| `lib/claudeInsightsClient.ts` | The real call to `claude-sonnet-5` with `output_config.format` (the 5-field schema above) and a system prompt that forbids both fabrication and quoting raw JSON field names (`current`/`formatBreakdown`/`sufficientData`/etc.) in the output text. Not unit-tested, same boundary treatment as `claudeApiClient.ts`. |
| `lib/agentPrompt.ts` | Pure functions for the AI agent core (AG1): `buildSystemPrompt` (assembles tone/rules + knowledge base documents + example dialogues into one system prompt; the no-prices/no-closing-deals rule is always baked in, not admin-editable), `buildConversationMessages` (dialogue turns → Claude's `user`/`assistant` message array). Fully unit-tested. |
| `lib/agentSandbox.ts` | Pure function `canSaveAsExample` (AG1): blocks saving a sandbox dialogue as a reusable example if any agent turn in it was rated 👎. Fully unit-tested. |
| `lib/agentClient.ts` | `respondAndExtractLead` (AG1+LEAD1): one structured `POST /v1/messages` call to `claude-haiku-4-5-20251001` (`output_config.format`) that returns both the reply text and the current full snapshot of lead fields in one round trip, replacing an earlier plain-text-only version. Not unit-tested, same boundary treatment as `claudeAnalysisClient.ts`. |
| `lib/leadFields.ts` | Pure functions for LEAD1: `isLeadComplete` (required: destination/people/dates/contact; optional: budget/wishes), `parseAgentReplyContent` (defensive validator for `agentClient.ts`'s structured response, mirrors `parseAnalysisContent`). Fully unit-tested. |
| `lib/leadIntake.ts` | `saveLeadDraft(conversationId, fields, source)` (LEAD1/LEAD2): upserts a `Lead` by `conversationId`, distinguishing insert from update via an explicit `findUnique` first (an insert triggers a one-time Telegram notification; updates don't). Not unit-tested — DB + Telegram boundary, verified directly via a temporary script instead. |
| `lib/leadNotify.ts` | Pure function `buildLeadNotificationText` (LEAD2): formats a `Lead` into the Telegram message text. Fully unit-tested. |
| `lib/telegramBot.ts` | Pure, dependency-injected `connectTelegramBot` (LEAD2): verifies a bot token via an injected client, then encrypts it — mirrors `claudeApiKey.ts`. Fully unit-tested. |
| `lib/telegramClient.ts` | The real Telegram Bot API calls (LEAD2): `verifyToken` (`getMe`) and `sendTelegramMessage` (`sendMessage`). Not unit-tested, same boundary treatment as `claudeApiClient.ts`. |
| `lib/prisma.ts` | Prisma client singleton, constructed with the `@prisma/adapter-pg` driver adapter. |
| `components/*` | Client components for panel interactivity (forms, toggles, nav) — thin, calling server actions via `useTransition`. |

## 4. Data model

Prisma models (`app/prisma/schema.prisma`):

- **`User`** — panel accounts (`email`, `passwordHash`, `role`, `isActive`).
- **`InstagramAccount`** — one row per connected Instagram account
  (`instagramUserId`, `username`, `accessToken` — encrypted, `tokenExpiresAt`,
  `connectedByUserId`). Designed for **multiple** accounts from the start, even
  though the first customer only needs one.
- **`ClaudeApiKeyConfig`** — a singleton row (`singleton: "claude"`) holding
  the platform's own Claude API key, encrypted, plus `verified`/`verifiedAt`.
  Global rather than per-user: the key powers server-side AI features (analytics,
  content, auto-replies), not a per-account external login like Instagram.
- **`InstagramMedia`** / **`InstagramComment`** — one row per post/Reel/story
  and per comment, deduped by their Instagram ID (upsert on poll). Current-state
  entities, not history — engagement counts are overwritten on each poll.
- **`InstagramMetricSnapshot`** — append-only: one row per poll per
  account/media, `scope` (`account`/`media`/`story`/`demographics`) + a
  `metrics` JSON blob + `capturedAt`. Raw timestamped snapshots;
  `dailyHistory()` turns these into one-per-day trend points on read, rather
  than this table itself being pre-aggregated history. `demographics`
  snapshots only exist once the account has 100+ followers (Meta's own
  threshold); follower growth is derived from day-over-day `followerCount`
  deltas in `account`-scope snapshots, not a separate metric.
- **`AgentConfig`** — a singleton row (`singleton: "agent"`) holding the AI
  agent's tone and rules as free text. One shared config, not per-channel —
  channel-specific overlays are deferred to the tasks that actually wire up
  a channel (`CM1`, `DM1`, `WEB5`).
- **`AgentKnowledgeDocument`** — freeform `title`+`body` documents (tour
  catalog, conditions, FAQs). No search/RAG — at this scale every document
  is concatenated straight into the system prompt.
- **`AgentExampleDialogue`** — full multi-turn dialogues (`turns` JSON:
  `{role, content}[]`) used as few-shot examples in the system prompt.
  Promoted from a sandbox session once every agent turn in it has been
  rated 👍 (or left unrated) — never if any turn was rated 👎.
- **`AgentSandboxSession`** — a draft conversation (`turns` JSON, per-turn
  `rating`, `status`: `draft`/`saved`, `leadFields` JSON — the latest
  extracted-field snapshot for the LEAD1 preview panel) persisted to the DB
  from the first message, not just client-side React state — a page reload
  doesn't lose test progress.
- **`Lead`** — one row per `conversationId`, all client-facing fields
  (`destination`/`people`/`dates`/`budget`/`contact`/`wishes`) as
  `string | null` rather than typed/structured, since the data is inherently
  approximate and natural-language. Two independent status dimensions that
  used to collide under one field name: `completeness` (`partial`/`complete`,
  set by the agent from what's been said) and `status`
  (`new`/`in_progress`/`closed`, changed by staff in `/panel/leads`) — a lead
  can be data-complete and still `new` if nobody's picked it up yet, which a
  single field couldn't represent. `source` (`sandbox`/`direct`/`comment`/
  `site`) records which channel it came from.
- **`TelegramBotConfig`** — a singleton row (`singleton: "telegram"`) holding
  the notification bot's token, encrypted, plus `verified`/`verifiedAt` —
  same shape as `ClaudeApiKeyConfig`.
- **`TelegramNotificationRecipient`** — a manually-entered whitelist of
  `chatId`s (+ optional `label`) that get a message on every new `Lead`.
- **`AccountInsightReport`** — append-only, one row per AI-разбор run
  (`trigger`: `manual`/`digest`, `content` JSON: `summary`/`observations`/
  `gaps`/`direction`/`recommendations`, `periodFrom`/`periodTo`, always a
  fixed 90-day window). Replaces the earlier separate `AiAnalysisReport`
  (AN4) and `GrowthInsightReport` (GROW1) tables, dropped in the same
  migration that added this one — see Key Decisions below.

## 5. Key decisions

- **Polling over webhooks for now.** Instagram webhooks aren't reliably delivered
  in development mode, and the roadmap's `IG3` is explicitly a poller. Webhook
  signature verification (`verifyWebhookSignature.ts`) was still built early
  (`F3`) as a reusable primitive, ahead of the endpoint that will eventually use it.
- **In-memory rate limiting, not Redis.** The app runs a single replica on
  DockHost; adding a shared store now would be premature. Documented as a thing
  to revisit if `smm` ever scales horizontally.
- **`--docker-file` in DockHost is relative to the repo root, not
  `--docker-context`** — the opposite of what the flag names suggest, and the
  root cause of a long deploy outage. When `dockerContext: app`, the flag must
  be `app/Dockerfile`, not `Dockerfile`.
- **`dockhost container update --image ...` replaces the full container spec**
  if `--variable`/`--port` are omitted, not just the image. Always pass the
  complete variable list and port when updating an existing container via the
  CLI, or use the dashboard's per-field edit instead.
- **DockHost auto-rebuilds `smm` on every push to `main`** — no need to run
  `dockhost repository build` manually; just push and check
  `dockhost container list`/`dockhost container logs smm` after a minute or two.
- **Instagram API with Instagram Login addresses the token's own account via
  `/me`, not its own ID.** `GET /{instagramUserId}/media` and `/insights`
  return a `code 100 / subcode 33` "object does not exist" error even with a
  valid token; `GET /me/media` and `/me/insights` work. Found by deploying the
  IG3 poller against a real connected account — media-level and comment-level
  calls (`/{media-id}/...`) are unaffected since they address the object's own
  ID, not the account's.
- **Graph API metric names drift between versions without notice.** A live
  deploy of AN1's Reels insights call failed with `metric[5] must be one of
  the following values: ...` — `plays` had been renamed to `views`. The error
  message lists the full valid metric set for that media type, which is the
  fastest way to fix it; treat any new insights metric added here as
  unverified until it's been exercised against a real account at least once.
- **Recharts for the analytics dashboard.** First charting dependency in the
  project (React 19 compatible). Chosen over hand-rolled SVG for the built-in
  tooltips/responsive containers that `AN2`'s "one chart per collected metric"
  scope needed.
- **Read-side data shaping lives in `lib/analyticsDashboard.ts`, separate from
  the poller's write-side `lib/instagramPoller.ts`.** Same pure-function/DI
  pattern, just facing the other direction: takes already-queried Prisma rows
  and reshapes them for the UI, never touches the database itself.
- **Meta's demographics breakdown shape, confirmed on real data.** AN1 stored
  the raw `total_value.breakdowns[].results[]` structure without ever
  rendering it; `AN2`'s parsers assumed the documented shape and were verified
  against the real `@chuck_uz` response after deploy — it matched, no fix
  needed.
- **Format dates in a fixed timezone (UTC), never the ambient one.**
  `MediaTable` (a client component, browser-rendered) and `SummaryPanel` (a
  server component, container-rendered) both called `toLocaleDateString`
  without a `timeZone` option and showed *different calendar dates for the
  same publication* — one used the browser's local timezone, the other the
  container's. Fixed by passing `timeZone: "UTC"` explicitly in both places,
  matching `dailyHistory()`'s and the weekday/time-of-day bucketing's
  existing UTC convention. Any new date-formatting call in this codebase
  should do the same.
- **Structured output over free-form text for the AI-разбор.**
  `claudeInsightsClient.ts` uses `output_config.format` (JSON Schema) instead
  of asking Claude for markdown and parsing it — guarantees a shape that maps
  directly onto `AccountInsightReport.content`, with `parseInsightsContent()`
  as a defensive fallback in case a response still doesn't validate.
- **No day/time pinning for the digest.** Rather than a cron-like
  "every Monday 9am", the digest interval in `instrumentation.ts` just checks
  every 6 hours whether the last `digest` report for an account is 7+ days
  old — same "no extra scheduler" reasoning as the other pollers, and avoids
  timezone/DST edge cases for a single weekly email-equivalent.
- **The AI agent (AG1) replies with a single plain `messages.create` call,
  no tool use.** The whole context (system prompt + full conversation
  history) is sent on every turn; there's no need for the model to fetch
  anything mid-turn since the knowledge base is small enough to live in the
  prompt directly.
- **Full multi-turn dialogues as examples, not single exchange pairs.**
  A deliberate choice during AG1's design: storing the whole dialogue (not
  just one client-message/agent-reply pair) preserves conversational flow
  as a few-shot pattern, at the cost of per-turn (not per-dialogue) 👍/👎
  rating to decide whether the dialogue is eligible to be saved at all.
- **`/panel/scenarios` (the AI agent core) is admin-only**, same as
  `/panel/users` — it's a system-wide configuration of the bot's behavior,
  not a manager's day-to-day tool. The nav item was moved out of the shared
  module list into the admin-gated section of `PanelNav`.
- **One structured Claude call does both the reply and field extraction
  (LEAD1).** `respondAndExtractLead` returns `{reply, fields}` from a single
  `output_config.format` call rather than a separate "reply" call plus a
  second "extract fields" call — half the cost and latency, and the model
  always sees the full conversation so it can just re-derive the complete
  field snapshot each turn instead of us maintaining a diff/merge.
- **The sandbox previews extracted lead fields but never creates a real
  `Lead`.** Decided during LEAD1's design: with no live channel (`CM1`/`DM1`/
  `WEB5`) wired up yet, letting an admin's own sandbox testing write real
  `Lead` rows would pollute the one measurable output the whole platform is
  built around. `saveLeadDraft` exists and is verified directly (a temporary
  script, deleted after use — same pattern as verifying paid-API guard
  clauses elsewhere), but nothing calls it until a real channel does.
- **`completeness` and `status` are separate fields on `Lead`, not one.**
  They looked like the same "status" concept at first glance but track two
  independent facts — whether the agent has enough data, and whether staff
  have picked the lead up — and a lead is very commonly complete-but-`new`
  at the same time. Collapsing them into one field would silently lose
  whichever fact changed last.
- **Telegram notifications use a manually-entered chat_id whitelist, not an
  incoming webhook.** Building a webhook receiver just so the bot could
  auto-discover a recipient's chat_id (by watching for their `/start`) would
  mean standing up a public endpoint + signature verification for one
  one-way, admin-configured notification list. Recipients get their own
  chat_id externally (e.g. `@userinfobot`) and paste it in; the bot only
  ever sends, never receives.
- **A lead notification fires once, on insert, not on every field update.**
  `saveLeadDraft` calls `findUnique` before writing specifically to tell
  insert from update apart — a single conversation upserts the same `Lead`
  row on every turn as the agent extracts more fields, and notifying on each
  of those would spam every whitelisted recipient once per message.
- **A Telegram bot must be messaged first before it can message back.**
  A configured, verified bot token still failed to deliver a test message
  until the recipient sent `/start` to the bot at least once — a standard
  Telegram Bot API constraint, not a bug. The "Отправить тестовое сообщение"
  button in `/panel/connections` exists specifically because there's no
  live channel yet to prove end-to-end delivery any other way.
- **AN3 (period-selector summary), AN4 (AI analysis), and GROW1 (growth
  insights) were later unified into a single AI-разбор** on explicit user
  request, after having shipped as three separate mechanisms (GROW1 even
  went through an initial independent-entity design before this). One
  Claude call, one `AccountInsightReport`, one prompt (`accountInsights.ts`
  + `claudeInsightsClient.ts`); the earlier `analysisReport.ts`/
  `claudeAnalysisClient.ts`/`growthInsights.ts`/`claudeGrowthClient.ts` and
  their tables were deleted in the same change (see
  `SMM Platform/decisions/analytics-insights-unification.md` in the vault).
- **The unified AI-разбор always analyzes a fixed 90-day window, with no
  manual period selector.** Comparing to a separate "previous period" (the
  original AN3/AN4 approach) is nearly always empty for an account this
  young; a first-half-vs-second-half split of one 90-day window (the
  approach GROW1 originally used only for reach) produces a usable trend
  signal much sooner, and was generalized in `buildMetricTrends` to every
  account metric, not just reach.
- **Raw computed numbers (metric trends, top/bottom posts, patterns,
  anomalies, format breakdown, demand signal) render automatically on the
  AI-разбор tab — no button required.** Only the actual Claude call needs
  an explicit trigger (it costs real tokens); the data underneath it is
  free to compute on every page load. This also incidentally fixed a real
  bug: the old manual period-selector form silently failed to submit when
  "Свой диапазон" was picked with empty (but `required`) date fields —
  removing the manual period step eliminated the failure mode entirely
  rather than patching it.
- **`buildDemandSignal` degrades to an explicit "no data yet" flag
  (`available: false`) instead of a partial/empty computation.** There is no
  live lead-generating channel yet (`CM1`/`DM1`/`WEB5` are all `todo`), and
  the sandbox deliberately never creates real `Lead` rows (see LEAD1), so
  `leads` is empty in production today. The system prompt tells Claude to
  say so plainly rather than reason about an empty destination list as if
  it meant "no demand."
- **The system prompt explicitly forbids quoting raw JSON field names**
  (`current`/`previous`/`formatBreakdown`/`sufficientData`/`demandSignal.
  available`/etc.) **in the output text.** AN4 and GROW1 each hit this bug
  independently in production before the fix was folded into the single
  remaining prompt — telling Claude to ground its answer in the input JSON
  isn't enough; it will parrot the field names back unless told not to.
