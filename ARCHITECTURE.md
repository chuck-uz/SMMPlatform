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
| `app/panel/*` | Server-rendered panel pages: `connections`, `users` (admin-only), `profile`, plus stubs for modules not yet built (`inbox`, `analytics`, `content`, `scenarios`). Each mutable page pairs with an `actions.ts` (server actions). |
| `lib/instagramOAuth.ts` | Pure, dependency-injected OAuth orchestration: `buildAuthorizeUrl`, `connectInstagramAccount`, `refreshAccountToken`, `daysUntilExpiry`. The real Instagram API calls are injected as an `InstagramApiClient`, so this is fully unit-tested without hitting the network. |
| `lib/instagramApiClient.ts` | The real `InstagramApiClient` implementation (`fetch` calls to `api.instagram.com` / `graph.instagram.com`). Not unit-tested — same boundary treatment as `prisma.ts`. |
| `lib/encryption.ts` | AES-256-GCM `encrypt`/`decrypt`, key passed as a parameter (never read from `process.env` inside the function) — used to store the Instagram access token. |
| `lib/verifyWebhookSignature.ts` | HMAC-SHA256 signature verification (`sha256=<hex>`, matching Meta's `X-Hub-Signature-256`). Built ahead of any real webhook endpoint, for the future Instagram Direct/Track B work. |
| `lib/rateLimiter.ts` | In-memory, fixed-window rate limiter (`Map`-based, per process). Not shared across replicas — revisit if `smm` ever scales beyond one. |
| `lib/verifyCredentials.ts`, `changePassword.ts`, `createUser.ts`, `setUserActive.ts` | Panel auth/user-management business logic, each paired with a `.test.ts`. |
| `lib/claudeApiKey.ts` | Pure, dependency-injected logic for saving the platform's Claude API key: verifies it against the real API, then encrypts it. The verification client is injected (`ClaudeApiClient`), so this is unit-tested without a real key or network call. |
| `lib/claudeApiClient.ts` | The real `ClaudeApiClient` implementation — calls Anthropic's `GET /v1/models` (cheap, no token cost) to check the key is valid. Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
| `lib/instagramPoller.ts` | Pure normalization functions for the content poller: `normalizeMedia`, `normalizeComment`, `flattenInsights`, `buildMetricSnapshot`, `isActiveStory`. Fully unit-tested against fixture Graph API payloads — no network or DB. |
| `lib/instagramContentClient.ts` | The real Graph API calls (`graph.instagram.com/me/media`, `/{media-id}/comments`, `/me/insights`, `/{media-id}/insights`). Not unit-tested, same boundary treatment as `instagramApiClient.ts`. |
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
  account/media, `scope` (`account`/`media`/`story`) + a `metrics` JSON blob +
  `capturedAt`. Raw timestamped snapshots; `AN1` builds trend history on top
  of these rather than this table itself being the history.

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
