# SMM Platform

**A single platform for promoting a travel agency on Instagram and the web — with an AI agent, analytics, and lead capture.**

[Русская версия](README.md)

## Why

A travel agency's channels are scattered — Instagram, DMs, comments, the website, messengers — all handled by hand, in different places. SMM Platform brings this into one panel: connect Instagram through the official Meta login, and the platform keeps the connection alive, answers clients by scenario, and surfaces what to do next — based on real data, not guesswork.

Two core points: **(1)** consultation and lead capture, **(2)** promotion and account growth. Everything else serves those two goals.

## Features

- **Admin panel** — email/password login, roles (admin/manager), creating and deactivating users, self-service password change.
- **Instagram connection** — official OAuth login (Instagram API with Instagram Login, no raw account password ever handled); the access token is stored encrypted (AES-256-GCM) and renews itself before it expires, with no manual step; status and remaining validity are shown in the panel, with a warning when access is about to expire; disconnecting an account is one click.
- **API security** — rate limiting on every internal API route (a stricter limit specifically on the panel login, against password guessing); a webhook-signature-verification utility is already in place ahead of the future Instagram webhook integration.
- **Claude connection** — an admin enters the API key in the panel; it's stored encrypted and verified with a real request to the Anthropic API, with the verification status shown in the panel.
- **Instagram data collection** — connected accounts are polled in the background: media (posts/Reels/stories), comments, and metrics/insights (including follower growth, link taps, and audience demographics once 100+ followers) are fetched automatically on independent schedules, without duplicates; the last-poll status is visible in the panel.
- **Analytics dashboard** — an "Analytics" section with a switcher between connected accounts: trend charts for every collected account metric, a sortable publications table, and audience demographics (age/gender, top countries); low-data states show clear placeholders instead of empty charts.
- **AI-разбор (account analysis)** — over a fixed 90-day window the platform computes metric trends, best/worst publications, weekday/time-of-day patterns, anomalies, engagement by content format, and demand from leads; Claude (Sonnet) turns that into a summary, observations, gaps, growth direction, and prioritized recommendations on demand or automatically once a week, grounded only in the data actually collected, with no fabricated numbers.
- **AI agent core** — an admin sets the agent's tone/rules, a knowledge base of tours, and reference example dialogues; a sandbox lets you test replies (Claude Haiku) and rate them 👍/👎 before they reach real channels.
- **In-dialogue lead capture** — as the conversation unfolds, the agent naturally asks for one missing field at a time — destination, dates, group size, contact, wishes — without inventing anything the client didn't say.
- **Comment auto-replies** — every new Instagram comment gets a short public draft reply (Claude Haiku) that never quotes prices or asks for contact info; drafts wait for approval in the "Inbox" section (editable, send, or regenerate), or publish automatically via a toggle in the agent settings.
- **"Заявки" (Leads) section** — cards for every collected lead with a status (new/in progress/closed), source, and data completeness; a manager gets a Telegram notification on every new lead and can take it into work right from the panel.
- **Uptime monitoring** — an automated check every 10 minutes, with an email alert on downtime.

The full roadmap (Instagram analytics, an AI agent for DMs and comments, lead intake and tracking, content publishing, the agency's own website) lives on the interactive roadmap site: **[roadmap-platform.oresh.in](https://roadmap-platform.oresh.in)**.

## Stack

Next.js (App Router) + TypeScript + Prisma/PostgreSQL + NextAuth, deployed on DockHost. Details in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run locally

```sh
cd app
cp .env.example .env   # fill in the values
docker compose up
```

The app comes up at `http://localhost:3001` (Postgres on `5433`).

## Production

**[smm.oresh.in](https://smm.oresh.in)**

## For developers

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — stack, code layout, key decisions.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to build, run, add a feature, and deploy; project conventions; working with the Obsidian vault (context, roadmap, decision log).

## Security

Secrets live only in `.env` (never in code or commits). Instagram access tokens are encrypted before being stored. A separate Claude API key is used for this project with a spend cap. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Status

Actively in development (MVP stage). The first customer is a travel agency; once that vertical is fully built out, the platform is meant to generalize further.
