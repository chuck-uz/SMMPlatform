# Contributing / Development guide

How to build, run, and extend SMM Platform. For the system design read
[ARCHITECTURE.md](ARCHITECTURE.md); for product usage read [README.md](README.md).
Rules specific to working with Claude Code on this repo live in `CLAUDE.md`.

## Prerequisites

- Docker Desktop (the app and its Postgres database both run in containers).
- Node.js + pnpm are only needed if you want to run tooling (`vitest`,
  `tsc`) directly on the host instead of inside the container.

## Project layout

```
app/                 Next.js application — see ARCHITECTURE.md for the full layout
  src/                source (App Router, lib, components)
  prisma/              schema + migrations
  docker-compose.yml   local db + app
  Dockerfile           production image (multi-stage)
  Dockerfile.dev       local dev image
.github/workflows/    uptime monitoring (GitHub Actions)
MASTER-CONTEXT.md     single source of truth: concept, decisions, constraints, modules (Obsidian vault)
roadmap.json          tasks + statuses — shared by development and the roadmap site
decisions/            Obsidian vault: decision log (why something was built the way it was)
context/              Obsidian vault: per-module working notes
dockhost.yaml         local-only, gitignored — real DockHost project config/secrets
```

This repository doubles as an **Obsidian vault** (`MASTER-CONTEXT.md`,
`roadmap.json`, `decisions/`, `context/`) and the application's source code.
See [§ Working with the vault](#working-with-the-vault) below.

## Build & run

```sh
cd app
cp .env.example .env      # fill in real values
docker compose up
```

The app comes up at `http://localhost:3001` (Postgres exposed on `5433`).
Migrations and the admin seed run automatically on container start
(`entrypoint.sh` / the dev compose's equivalent).

Running tests and the type-checker (host or `docker exec app-app-1 ...`):

```sh
cd app
pnpm vitest run
pnpm tsc --noEmit
```

## Adding a feature — the usual shape

1. Pick **one** item from `roadmap.json` by id (e.g. `IG3`) — see
   [§ Working with the vault](#working-with-the-vault) for the full loop.
2. **Business logic** as a pure, dependency-injected function in `src/lib/`
   (see `changePassword.ts`, `instagramOAuth.ts`) — external calls (Prisma,
   third-party APIs) are passed in as parameters, not imported and called
   directly, so the function is unit-testable without a real DB or network.
3. **Test first.** Write the `.test.ts`, watch it fail for the right reason
   (missing module), then implement until green. Skip this step only for thin
   wrappers around an external API/DB (e.g. `instagramApiClient.ts`,
   `prisma.ts`) — there's nothing meaningful to unit-test there.
4. **Route/page** — a Route Handler under `src/app/api/*` or a server
   component under `src/app/panel/*`, paired with an `actions.ts` for
   mutations (server actions), following the existing pattern (see
   `panel/users/`).
5. **UI** — match the existing design tokens (`globals.css`: `--color-*`,
   `--radius-*`, `--shadow-*`), Heroicons `24/outline` for icons, the
   card/table patterns already used in `panel/users` and `panel/connections`.
6. **Verify in a browser** before calling it done — start the dev server,
   exercise the golden path and the obvious edge cases (empty state, error
   state), not just `tsc`/tests passing.
7. Commit in small, meaningful steps. Push to `dev` by default; `main` is
   updated only on explicit request.
8. Update `roadmap.json` status only once the task's `done_when` is actually
   verified — not before.

## Testing conventions

Vitest, colocated `*.test.ts` files. Dependency injection at the seams (DB
calls, external HTTP calls) is the standard way to keep logic unit-testable —
see `verifyCredentials.ts`/`.test.ts` or `instagramOAuth.ts`/`.test.ts` for the
pattern. There is no snapshot/E2E suite; UI changes are verified manually in a
real browser against the running dev container.

## Deploying

Production runs on [DockHost](https://dockhost.ru), container `smm`, repository
tracking the `main` branch.

```sh
dockhost repository build --name smm                 # rebuild the image from latest main
dockhost container update --name smm --image <new-image-tag>   # ⚠ see below
```

**⚠ `dockhost container update --image ...` replaces the container's full spec**
if `--variable`/`--port` are omitted — it does not patch just the image. Either:

- pass the complete `--variable NAME:value` list and `--port 3000/TCP` in the
  same call, or
- prefer the DockHost dashboard's container-edit screen for anything touching
  variables/ports, and only use the CLI for straightforward image-tag bumps
  once you've confirmed the full variable set is intact.

Required env vars for `smm` in production: `DATABASE_URL`, `NEXTAUTH_URL`,
`NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`,
`IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI`. See `app/.env.example` for
what each one is for.

## Working with the vault

This repository is also the project's Obsidian vault — its single source of
context across sessions.

**Access rule: all reads/writes to the vault go through the
`obsidian-mcp-connector`**, never by editing the files on disk directly (that
breaks Obsidian's index, links, and metadata). If the connector isn't
available, get it connected first rather than working around it.

- `MASTER-CONTEXT.md` — the single source of truth: concept, decisions,
  constraints, modules, the full roadmap narrative.
- `roadmap.json` — tasks and statuses; also read directly by the roadmap
  site (`roadmap-platform.oresh.in`).
- `context/` — working notes per module (what's known, how it's built, open
  questions). Read the relevant one before starting a task. Template:
  `context/_template.md`.
- `decisions/` — a log of what was built and why (architecture, chosen
  approach vs. alternatives). Append after finishing a task. Template:
  `decisions/_template.md`.

**Loop for every task:**

1. Before — read the relevant section of `MASTER-CONTEXT.md` and the matching
   note in `context/`.
2. Do the task, to the `done_when` criterion in `roadmap.json`.
3. After — append an entry to `decisions/<module>.md`, then update the task's
   `status` (and `note`/`updatedAt`) in `roadmap.json`.

Statuses: `todo` → `in_progress` → `done` (or `blocked`). This repo's
`roadmap.json` (git, read by the roadmap site) and the vault's copy can drift
if only one is updated — keep both in sync when marking a task done.

## Conventions

- Product-facing text (UI copy) is in Russian; identifiers and code comments
  in English. Developer docs (this file, `ARCHITECTURE.md`) are in English;
  `README.md` has a Russian original and an English translation.
- Small, frequent commits over one big commit per task.
- Secrets only in `.env` (gitignored) or the DockHost environment store —
  never in code or commit history.
