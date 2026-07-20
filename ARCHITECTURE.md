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
| `app/panel/*` | Server-rendered panel pages: `connections`, `users` (admin-only), `profile`, `analytics` (multi-account charts/table/demographics), `scenarios` (admin-only AI agent core: tone, knowledge base, examples, sandbox, plus CM1's comment tone + moderation toggle), `leads` (admin+manager: status-filtered list of collected `Lead` records, "take into work"/"close" transitions), `inbox` (admin+manager: CM1's comment-reply review queue — pending drafts to approve/edit/regenerate, recent sent history). Each mutable page pairs with an `actions.ts` (server actions). |
| `lib/instagramOAuth.ts` | Pure, dependency-injected OAuth orchestration: `buildAuthorizeUrl`, `connectInstagramAccount`, `refreshAccountToken`, `daysUntilExpiry`. The real Instagram API calls are injected as an `InstagramApiClient`, so this is fully unit-tested without hitting the network. |
| `lib/instagramApiClient.ts` | The real `InstagramApiClient` implementation (`fetch` calls to `api.instagram.com` / `graph.instagram.com`). Not unit-tested — same boundary treatment as `prisma.ts`. |
| `lib/encryption.ts` | AES-256-GCM `encrypt`/`decrypt`, key passed as a parameter (never read from `process.env` inside the function) — used to store the Instagram access token. |
| `lib/verifyWebhookSignature.ts` | HMAC-SHA256 signature verification (`sha256=<hex>`, matching Meta's `X-Hub-Signature-256`). Built ahead of any real webhook endpoint, for the future Instagram Direct/Track B work. |
| `lib/rateLimiter.ts` | In-memory, fixed-window rate limiter (`Map`-based, per process). Not shared across replicas — revisit if `smm` ever scales beyond one. |
| `lib/verifyCredentials.ts`, `changePassword.ts`, `createUser.ts`, `setUserActive.ts` | Panel auth/user-management business logic, each paired with a `.test.ts`. |
| `lib/llm/router.ts` | Pure resolution of an interaction point (`agent_dialog`/`comment_reply`/`analytics`) to a `{provider, model}` pair, plus `resolveCredential`. Malformed config rows (unknown provider, blank model) fall back to `DEFAULT_ROUTES` rather than taking the agent offline. Fully unit-tested. |
| `lib/llm/structuredOutput.ts` | Pure helpers deciding **how** a given provider can be made to return a JSON object: `pickOutputMechanism` (`native_schema` / `json_mode` / `prompt`), the prompt-side instructions for models without schema support, `extractJsonObject` (brace-balanced scan that survives prose preambles and markdown fences), and `shouldRepairRetry` (exactly one repair attempt). Fully unit-tested. |
| `lib/llm/index.ts` | `complete()` — the one entry point every call site uses. Picks the mechanism, appends shape instructions only when the decoder can't enforce them, calls the provider adapter, validates with a caller-supplied parser, and retries once with a repair instruction. Returns the mechanism, retry count, latency and token usage alongside the value. Unit-tested through an injected `run` adapter. |
| `lib/llm/anthropic.ts`, `openAiCompatible.ts`, `openrouter.ts`, `deepseek.ts` | Provider adapters over `fetch`. Request-body builders are pure and unit-tested — `buildAnthropicBody` is asserted to reproduce the exact body the old Claude-only clients sent, which is what makes the migration a no-op until settings change. OpenRouter and DeepSeek share the OpenAI-compatible dialect. |
| `lib/llm/catalog.ts` | Fetches and caches each provider's `/models` list (1-hour in-process TTL, manual refresh). Also the source of OpenRouter's per-model `structured_outputs` capability. |
| `lib/llm/credentials.ts` | Pure, dependency-injected `connectProviderApiKey`: encrypts the key and records whether the provider accepted it. A failed verification is stored rather than rejected — a provider outage shouldn't block saving a good key. Fully unit-tested. |
| `lib/llm/resolve.ts` | The DB boundary: reads the route + credential rows, decrypts the key, and resolves OpenRouter's per-model capability. Call sites no longer read keys themselves, so a settings change actually takes effect. |
| `lib/modelComparison.ts` | Pure logic for the model comparison screen: `extractClientTurns` (only the client's lines form the replayable script), `planComparison` (turns × models = paid calls), and `summariseRun`/`summariseTarget` (per-model fields-collected, retries, failures, average latency, tokens). Fully unit-tested. |
| `lib/instagramPoller.ts` | Pure normalization functions for the content poller: `normalizeMedia`, `normalizeComment`, `flattenInsights`, `buildMetricSnapshot`, `isActiveStory`, `normalizeFollowerCount`, `shouldFetchDemographics`, `buildDemographicsMetrics`, `dailyHistory` (groups snapshots into one-per-calendar-day, also the fallback for expired stories). Fully unit-tested against fixture Graph API payloads — no network or DB. |
| `lib/instagramContentClient.ts` | The real Graph API calls (`graph.instagram.com/me/media`, `/{media-id}/comments`, `/me/insights`, `/{media-id}/insights`, `/me` for follower count, demographics breakdown insights, `POST /{comment-id}/replies` for CM1). Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/instagramApiError.ts` | `InstagramApiError` (carries HTTP status + the parsed Graph `error` object alongside the message) plus the pure predicates over it: `parseGraphError`, `isPermanentInsightsError`, `permanentInsightsErrorReason`. The permanent-error table is deliberately tiny — mis-classifying a transient failure as permanent silently stops a post's metrics forever, so anything unrecognised stays retryable. Fully unit-tested. |
| `lib/analyticsDashboard.ts` | Pure read-side functions for the analytics dashboard: `buildAccountMetricCharts`/`buildMetricSeries` (per-metric Recharts series from `dailyHistory()` output), `buildMediaTableRows` (attaches latest metric snapshot to each media row), `parseAgeGenderBreakdown`/`parseGeographyBreakdown` (unpack Meta's nested `total_value.breakdowns[].results[]` demographics shape into chart-ready bars). Fully unit-tested against fixture payloads — no network or DB, mirrors the poller/client split (`instagramPoller.ts` = write-side, this = read-side). |
| `lib/analyticsSummary.ts` | Pure media-engagement/pattern utilities, shared by the unified AI-разбор: `buildMediaEngagements`/`rankMedia` (FEED/REELS only, top/bottom-3 by `total_interactions`), `buildWeekdayPattern`/`buildTimeOfDayPattern` (gated at 3+ samples per bucket), `detectAnomalies` (day deviates >50% from the window average, gated at 4+ data points). No longer owns period selection or metric deltas — that moved to `accountInsights.ts`. Fully unit-tested, no DB access. |
| `lib/accountInsights.ts` | Pure functions for the unified AI-разбор (supersedes AN3/AN4/GROW1's separate `analysisReport.ts`/`growthInsights.ts`): `buildMediaFormatEngagements`/`buildFormatBreakdown` (engagement per media format, gated at 3+ samples), `buildMetricTrends` (first-half-vs-second-half split of a fixed 90-day window, generalized to **every** account metric — stock `followerCount` compared by last value per half, flow metrics by average per half — not just reach), `buildDemandSignal` (leads grouped by destination, `available: false` when empty), `buildInsightsPrompt`/`parseInsightsContent` (5-field schema: `summary`/`observations`/`gaps`/`direction`/`recommendations`), `shouldSkipManualInsights` (5-minute cooldown), `isInsightsDigestDue` (7-day gate). Fully unit-tested. |
| `lib/claudeInsightsClient.ts` | The analytics call, now issued through `llm/complete()` on the model configured for `analytics` (Anthropic/Sonnet by default) with the 5-field schema and a system prompt that forbids both fabrication and quoting raw JSON field names (`current`/`formatBreakdown`/`sufficientData`/etc.) in the output text. Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/agentPrompt.ts` | Pure functions for the AI agent core (AG1): `buildSystemPrompt` (assembles tone/rules + knowledge base documents + example dialogues into one system prompt; the no-prices/no-closing-deals rule is always baked in, not admin-editable), `buildConversationMessages` (dialogue turns → Claude's `user`/`assistant` message array). Fully unit-tested. |
| `lib/agentSandbox.ts` | Pure function `canSaveAsExample` (AG1): blocks saving a sandbox dialogue as a reusable example if any agent turn in it was rated 👎. Fully unit-tested. |
| `lib/agentClient.ts` | `respondAndExtractLead` (AG1+LEAD1): one structured call through `llm/complete()` on the model configured for `agent_dialog`, that returns both the reply text and the current full snapshot of lead fields in one round trip, replacing an earlier plain-text-only version. Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/leadFields.ts` | Pure functions for LEAD1: `isLeadComplete` (required: destination/people/dates/contact; optional: budget/wishes), `parseAgentReplyContent` (defensive validator for `agentClient.ts`'s structured response), and `mergeLeadFields` — the model returns a full snapshot every turn but does not reliably repeat what it already collected, so snapshots only ever add or correct: a real value wins, an empty one keeps what was known. Overwriting instead once silently dropped a confirmed destination mid-dialogue. The trade-off is that the agent cannot clear a field — deliberate, since a stale value costs the manager far less than a lost one. Fully unit-tested. |
| `lib/leadIntake.ts` | `saveLeadDraft(conversationId, fields, source)` (LEAD1/LEAD2): merges the incoming snapshot into the stored lead via `mergeLeadFields` (never a blind overwrite), then upserts a `Lead` by `conversationId`, distinguishing insert from update via an explicit `findUnique` first (an insert triggers a one-time Telegram notification; updates don't). Not unit-tested — DB + Telegram boundary, verified directly via a temporary script instead. |
| `lib/leadNotify.ts` | Pure function `buildLeadNotificationText` (LEAD2): formats a `Lead` into the Telegram message text. Fully unit-tested. |
| `lib/telegramBot.ts` | Pure, dependency-injected `connectTelegramBot` (LEAD2): verifies a bot token via an injected client, then encrypts it — mirrors `llm/credentials.ts`. Fully unit-tested. |
| `lib/telegramClient.ts` | The real Telegram Bot API calls (LEAD2): `verifyToken` (`getMe`) and `sendTelegramMessage` (`sendMessage`). Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/commentReply.ts` | Pure functions for CM1: `buildCommentReplySystemPrompt` (no lead-collection rules, explicitly forbids naming prices or asking for contact info — the reply is a public comment, not a private dialogue), `buildCommentUserMessage`, `parseCommentReplyContent` (simpler `{reply}`-only schema than `leadFields.ts`). Fully unit-tested. |
| `lib/commentReplyClient.ts` | `generateCommentReply` (CM1): one structured call through `llm/complete()` on the model configured for `comment_reply`. Not unit-tested, same boundary treatment as `agentClient.ts`. |
| `lib/prisma.ts` | Prisma client singleton, constructed with the `@prisma/adapter-pg` driver adapter. |
| `components/*` | Client components for panel interactivity (forms, toggles, nav) — thin, calling server actions via `useTransition`. |

## 4. Data model

Prisma models (`app/prisma/schema.prisma`):

- **`User`** — panel accounts (`email`, `passwordHash`, `role`, `isActive`).
- **`InstagramAccount`** — one row per connected Instagram account
  (`instagramUserId`, `username`, `accessToken` — encrypted, `tokenExpiresAt`,
  `connectedByUserId`). Designed for **multiple** accounts from the start, even
  though the first customer only needs one.
- **`LlmProviderCredential`** — one row per provider (`anthropic`,
  `openrouter`, `deepseek`) holding that provider's API key, encrypted, plus
  `verified`/`verifiedAt`. Global rather than per-user: these keys power
  server-side AI features, not a per-account external login like Instagram.
  Replaced the earlier Claude-only `ClaudeApiKeyConfig` singleton, whose row was
  migrated into the `anthropic` credential.
- **`LlmRouteConfig`** — one row per interaction point (`agent_dialog`,
  `comment_reply`, `analytics`) pointing at a `{provider, model}`. Seeded to the
  pre-existing behaviour (Haiku/Haiku/Sonnet on Anthropic), so switching to the
  model layer changed nothing until an admin edits a row. Analytics is a separate
  row on purpose: experimenting with the client-facing model must not disturb the
  weekly AI report.
- **`ModelComparisonRun`** / **`ModelComparisonResult`** — an append-only record
  of comparison runs: the replayed client script plus, per model and per turn, the
  reply, extracted lead fields, output mechanism, retries, latency and tokens.
- **`InstagramMedia`** / **`InstagramComment`** — one row per post/Reel/story
  and per comment, deduped by their Instagram ID. Current-state
  entities, not history — engagement counts are overwritten on each poll.
  `InstagramComment` also carries CM1's reply lifecycle: `replyStatus`
  (`pending`/`draft_ready`/`sent`/`skipped`/`failed`), `draftReply`,
  `repliedAt`, `sentReplyId` (the Instagram ID of the reply comment itself,
  since a reply is a brand-new public comment, not a sub-resource of the
  original). `InstagramMedia.insightsUnavailable` (+ `insightsUnavailableReason`)
  is a tombstone for media Meta will never return insights for — currently only
  posts published before the account was converted to a business account. The
  metrics poller sets it on the first such failure and skips the media from then
  on: retrying was burning rate-limit quota (Instagram's limit scales with
  impressions) and drowning real errors in log noise.
- **`InstagramMetricSnapshot`** — append-only: one row per poll per
  account/media, `scope` (`account`/`media`/`story`/`demographics`) + a
  `metrics` JSON blob + `capturedAt`. Raw timestamped snapshots;
  `dailyHistory()` turns these into one-per-day trend points on read, rather
  than this table itself being pre-aggregated history. `demographics`
  snapshots only exist once the account has 100+ followers (Meta's own
  threshold); follower growth is derived from day-over-day `followerCount`
  deltas in `account`-scope snapshots, not a separate metric.
- **`AgentConfig`** — a singleton row (`singleton: "agent"`) holding the AI
  agent's tone and rules as free text, plus CM1's `commentToneAndRules`
  (separate free text — public comment replies need different constraints
  than a private dialogue) and `commentModerationEnabled` (default `true`).
  One shared config, not per-channel in general — further channel-specific
  overlays are deferred to the tasks that wire up the remaining channels
  (`DM1`, `WEB5`).
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
  same shape as `LlmProviderCredential`.
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
- **CM1 (comment auto-replies) uses a separate, simpler generation function
  (`commentReplyClient.ts`), not `respondAndExtractLead`.** A comment reply
  is published as a brand-new **public** Instagram comment (there is no
  private-reply-to-comment endpoint — see the `postCommentReply` note
  below), so asking for a phone number or contact info the way the private
  sandbox/DM dialogue does would leak it publicly under the post. Lead
  collection in comments is out of scope for CM1 by design; a future `CM2`
  handles handing a comment thread off to DM.
- **`POST /{comment-id}/replies` creates a new top-level public comment**,
  it does not thread as a "reply" the way the term suggests — confirmed
  against Meta's own docs before building `postCommentReply`. CM1
  deliberately only uses this public-reply endpoint. UPD (`CM2` research):
  a separate **Private Reply** endpoint also exists —
  `POST /<IG_ID>/messages` with `recipient: {comment_id}` — sending one
  private DM tied to a comment, within 7 days, once per commenter, using
  the same already-granted `instagram_business_basic` +
  `instagram_business_manage_comments` scopes (no extra review). Reading
  the resulting conversation (for continuing the dialogue or detecting a
  "stop" reply) is a separate concern requiring
  `instagram_business_manage_messages` and polling
  `GET /{IG_ID}/conversations` — that's the actual reason `CM2` (comment →
  DM handoff, dedup, opt-out) is a separate roadmap item from CM1, not
  because no private-reply mechanism exists at all.
- **New `InstagramComment` rows are inserted via `create` + catch-`P2002`,
  not `upsert`.** The previous poller used `upsert` (`create` / no-op
  `update: {}`) purely for dedup; CM1 needs to know whether a row is
  genuinely new (to decide whether to generate a reply at all), and a
  `findUnique`-then-`create` check would race across overlapping poll
  cycles. Catching the unique-constraint violation on `create` keeps the
  same atomicity `upsert` had while still distinguishing "new" from
  "already seen" for the caller.
- **Existing comments are backfilled to `replyStatus: "skipped"` in the
  CM1 migration itself** (a plain `UPDATE` statement appended to the
  generated migration SQL), so the auto-reply feature never retroactively
  replies to a multi-month backlog the moment it ships — only comments
  collected after the migration runs get a real `pending`→`draft_ready`
  lifecycle.
- **CM1 replies to every new comment, unconditionally — no keyword/
  relevance filtering.** A hardcoded keyword list would be brittle against
  phrasing the agency can't predict in advance; letting Claude judge
  relevance per-comment was considered but rejected too, to keep the first
  version's behavior simple and predictable. Filtering can be layered on
  later if unconditional replies prove too noisy in practice.
- **Moderation queue (review-before-publish) is the default, with an
  admin-facing toggle to switch to fully automatic sending.** Comment
  replies are public and irreversible-looking once posted; starting with a
  human-in-the-loop step is the safer default given this session's own
  experience with model output quality, and the toggle exists specifically
  so it can be turned off once draft quality is trusted in practice — see
  `SMM Platform/decisions/cm1-comment-autoreply.md`.
- **The comment-review queue lives on the pre-existing `/panel/inbox`
  stub**, not a new page — its placeholder copy already described exactly
  this ("диалоги по директу, комментариям и чату сайта"), and `DM1` will
  extend the same page rather than fragment review UIs across channels.
- **A regenerate action, not a plain reject.** Rejecting a draft with no
  path forward would just leave staff to answer manually in the Instagram
  app; letting them ask Claude to try again (same comment, fresh call) was
  cheap to add and keeps the whole reply loop inside the panel.
- **A permission being requested in the OAuth scope string is not the same
  as it being usable.** CM1's `GET /{media-id}/comments` silently returned
  `{"data": []}` for every post in production — including posts already
  known to have comments — even though `instagram_business_manage_comments`
  was in `TRACK_A_SCOPES` and the token exchange succeeded. Root cause
  (found via the Meta App Dashboard, Сценарии использования → Разрешения
  и функции): the permission itself had never been **added** to the app's
  Instagram use case there (shown as "—" / "Добавить" instead of "Готово к
  тестированию", despite already-accumulating call counts). A second,
  distinct gate exists **as long as the app is unpublished
  ("Не опубликовано")**: Graph API only returns data tied to interactions
  from accounts that hold an *accepted* Instagram Tester role — visible
  under Роли в приложении → Роли as a "0 of N" counter even when a tester
  is listed, if their invite was never accepted from inside the Instagram
  app itself (Settings → Apps and websites → Приглашения для
  тестировщиков). Any future Instagram data-reading feature (`CM2`,
  `DM1`+) that stalls with an empty-but-200-OK response should check both
  of these before suspecting the application code.
