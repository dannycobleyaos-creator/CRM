# Hygge Pergola CRM

The one‑stop portal for Hygge Pergola agents. An agent signs in and does their
whole job in one place: their day's work, every customer conversation, the parts
we owe people, and what the company needs them to know.

Built to retire the sprawl — Trello, Slack, Aircall, tawk.to and the knowledge
that currently only lives in people's heads.

---

## The problems this is built to solve

| Pain point | How the portal answers it |
| --- | --- |
| Information is everywhere — Trello, Slack, people, Aircall, tawk | One customer record with a single timeline. Calls, live chats, emails, texts, notes, status changes and dispatches all land on the same spine, each stamped with the system it came from. |
| Trello data is cluttered | The **Actioned** column shows the last 7 days only. Finished work stops competing for attention the moment it stops mattering. |
| We don't know what's completed | Five task states with one meaning each — **To action, Actioning, Blocked, Awaiting others, Actioned** — and the same colour language everywhere in the portal. |
| We can't navigate properly | A fixed left‑hand nav with live counts, one global search across customers, cases, orders and dispatches, and every filter encoded in the URL so views can be bookmarked and shared. |
| People don't know what's actioned or what needs actioning | Every task has an owner and a due date — the form will not submit without them. **My day** lists an agent's work overdue‑first, then due‑today, then by urgency. |
| Management can't track performance | A performance view built from work people already do: resolved cases, first‑response times, SLA hit rate, tasks actioned, live workload per person. No timesheets. |
| Parts get lost between the agent and the warehouse | A dispatch record from request → approval → picking → carrier + tracking → delivered, with stock coming off the shelf automatically at picking and a live low‑stock list. |

## What's in it

- **My day** — progress against a daily target, six urgency counters, a prioritised work queue, open cases, the unassigned pile, announcements and the dispatch queue.
- **Work board** — the Trello replacement. Filter by mine / team / everyone and by due date; move a card with one click.
- **Cases** — every channel as one queue, with SLA deadlines that go amber then red on their own. Claim, assign, change state and log an interaction from the case.
- **Customers** — contact details, orders, cases, tasks, parts sent, and the full interaction history.
- **Parts dispatch** — the warehouse queue, carrier and tracking capture, stock control and reorder warnings.
- **Announcements** — pinned notices, per‑team audiences, and a record of who has read what.
- **Team directory** — roles, extensions, Aircall IDs and live workload.
- **Performance** — management only. Opened vs resolved over time, case mix, service level, an individual league table and workload distribution.

## Branding

The design system mirrors the Hygge Pergola look: matt anthracite aluminium,
warm Nordic neutrals (linen, sand, stone) and a single ember accent that echoes
the integrated LED lighting. Display type is a geometric grotesque; UI type is a
neutral sans.

Every colour lives in two files — `tailwind.config.ts` and the `:root` block in
`src/app/globals.css` — so the whole portal re‑skins from one place if the brand
team supplies exact hex values.

> **Note:** `hyggepergola.co.uk` is blocked by this environment's network egress
> policy, so the palette was derived from the brand's known styling (matt grey /
> matt white pergolas, Scandinavian "hygge" warmth) rather than sampled from the
> live site. Swap the two files above to match the brand guidelines exactly.

Chart colours are separate and validated: the UI greys are too low‑chroma to be
safe data marks, so `src/lib/chart-theme.ts` holds a brand‑adjacent pair that
passes lightness, chroma, colour‑vision‑deficiency and contrast checks.

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET
npm run setup               # generate client, create the database, seed it
npm run dev                 # http://localhost:3000
```

`npm run setup` seeds a realistic month of trading — nine staff, 34 customers,
27 orders, 46 cases, 78 tasks, 26 dispatches and a full interaction history — so
every screen has something true to show on first run.

### Demo sign‑ins

All seeded accounts use the password `hygge2024`.

| Role | Email |
| --- | --- |
| Admin / MD | `danny.cobley@hyggepergola.co.uk` |
| Manager | `ruth.alderton@hyggepergola.co.uk` |
| Team lead | `marcus.idowu@hyggepergola.co.uk` |
| Agent | `priya.raval@hyggepergola.co.uk` |
| Warehouse | `karolina.nowak@hyggepergola.co.uk` |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | Next/ESLint |
| `npm run db:seed` | Re‑seed the database |
| `npm run db:reset` | Delete, recreate and re‑seed the database |
| `npm run test:smoke` | End‑to‑end smoke test against a running server |

### Smoke test

`scripts/smoke.mjs` drives a real browser through the paths that matter: signing
in (including a wrong password), role separation, moving work across the board,
raising a task, claiming a case, logging an interaction, search, signing out and
moving a parts dispatch forward.

```bash
npx playwright install chromium      # one-off
npm run build && npm start -- -p 3100
npm run test:smoke
```

Playwright is intentionally not a project dependency, so `npm install` does not
pull a browser down for everyone. The script writes to the database — run it
against a seeded development database, never production.

## How it is put together

```
prisma/schema.prisma      Data model — users, customers, orders, cases, tasks,
                          parts, dispatches, announcements, activities
prisma/seed.ts            Deterministic demo data
scripts/smoke.mjs         End-to-end smoke test

src/app/(portal)/         Every signed-in screen
src/app/login/            Sign-in
src/actions/              Server actions — the only place data is written
src/components/           UI primitives, status chips, work components, charts
src/lib/constants.ts      Every status value, its label and its colour, once
src/lib/metrics.ts        Dashboard and performance calculations
src/lib/auth.ts           Password hashing and signed session cookies
src/middleware.ts         Route protection at the edge
```

**Stack:** Next.js 15 (App Router, React 19), TypeScript, Tailwind CSS,
Prisma + SQLite, `bcryptjs` + `jose` for sessions.

### A few deliberate decisions

- **Status values are declared once.** `src/lib/constants.ts` holds every allowed
  value with the label agents see and the colour it is painted in. A status can
  only be one of these, and it looks the same on every screen.
- **The URL is the view.** Filters are links, not client state, so an agent can
  bookmark "my breached cases" and a manager can send someone a link to exactly
  what they are looking at.
- **Mutations are server actions.** Most controls are plain `<form>` posts, so
  the portal keeps working on a weak connection and on older devices.
- **SLA figures maintain themselves.** Logging a customer‑facing interaction on a
  case stamps the first response time. Nobody has to remember to update a field
  for the reporting to be true.
- **Stock moves when the work moves.** Parts come off the shelf when picking
  starts, not when somebody remembers to adjust a spreadsheet.
- **Nothing typed is lost to a validation error.** React clears an uncontrolled
  form as soon as its action settles, so every action hands back what was
  submitted and the form restores it — mistype your password and your email
  address is still there.

## Moving to production

1. **Database.** SQLite ships by default so the portal runs anywhere with no
   extra services. Switch `datasource db` in `prisma/schema.prisma` to
   `postgresql`, point `DATABASE_URL` at the instance and run
   `npx prisma migrate deploy`. No application code changes.
2. **Secrets.** Generate `AUTH_SECRET` with `openssl rand -base64 48`. Sessions
   are `httpOnly`, `sameSite=lax` and `secure` in production.
3. **Real accounts.** Replace the seeded users. Password hashing is `bcrypt` at
   cost 10; roles are `AGENT`, `TEAM_LEAD`, `MANAGER`, `ADMIN`.

## Bringing the other systems in

The `Activity` model already carries `sourceSystem` and `sourceRef`, so imported
records stay traceable to where they came from. The remaining work is the
ingestion side:

- **Aircall** — webhook on `call.ended` → create an `Activity` of type `CALL`
  with the recording reference and duration, matched to the customer by phone
  number. `User.aircallId` already maps an Aircall agent to a CRM user.
- **tawk.to** — webhook on chat end → an `Activity` of type `CHAT` with the
  transcript in `body`, plus a new case when the visitor is unknown.
- **Email** — an inbound address piped to a route handler that opens or appends
  to a case by reference in the subject line.
- **Slack** — outbound only. Post SLA breaches and urgent dispatches to a channel
  with a deep link back into the portal, so Slack becomes a notifier rather than
  a place where work hides.
- **Trello** — a one‑off import mapping each card to a `Task` with an owner and a
  due date. Cards without either are the ones worth reviewing before migrating.
