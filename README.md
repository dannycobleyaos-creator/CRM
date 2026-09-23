# Hygge Pergola CRM

The one‑stop portal for Hygge Pergola agents. An agent signs in and does their
whole job in one place: their day's work, every customer conversation, every
order and the dates that matter on it, the parts we owe people — priced, ordered
and tracked to the doorstep — and what the company needs them to know.

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
| Management can't see call, chat and email volumes | A contact centre report: calls answered and missed, live chats, emails and reply times, time on the phone, the busiest hours of the day, and who handled what — per person, per team. |
| Order information lives in people's heads | Every order has its own record: key dates (survey, delivery, install, balance, aftercare call) each with an owner, notes, and one history of every call, email, case and part sent for it. |
| Spare parts have no prices, no bill of materials, no paperwork | An inventory with cost and selling prices, a bill of materials for every pergola, and parts orders that price themselves, print an order confirmation and create the warehouse dispatch in one step. |
| Parts get lost between the agent and the warehouse | A dispatch record from request → approval (or payment) → picking → carrier + tracking → delivered, with stock coming off the shelf through a ledger, a live low‑stock list and supplier purchase orders to buy it back in. |

## What's in it

- **My day** — progress against a daily target, the calls, chats and emails you have handled today, six urgency counters, a prioritised work queue, your order dates for the week, open cases, the unassigned pile, announcements and the dispatch queue.
- **Work board** — the Trello replacement. Filter by mine / team / everyone and by due date; move a card with one click.
- **Cases** — every channel as one queue, with SLA deadlines that go amber then red on their own. Claim, assign, change state, log an interaction and order parts from the case.
- **Customers** — contact details, orders, cases, tasks, parts orders, and the full interaction history.
- **Orders** — every pergola order with its status, value and next date, plus a two‑week diary of deliveries, installs, balance payments and aftercare calls across the business. Each order record has:
  - **key dates**, each with an owner — tick them off, move them (the old date and the reason stay in the history) or add new ones;
  - **notes and interactions** logged straight onto the order (and the customer);
  - **one history** of everything on the order, its cases, and every part sent for it;
  - the pergola's **bill of materials**, and a button to order parts from it.
- **Parts orders** — priced orders for spare parts, whether the customer pays, it is under warranty or it is goodwill. Pick parts from the pergola's bill of materials (the matt white version is chosen automatically for a white pergola) or search the catalogue; totals, delivery and VAT update as you go. Placing the order creates a printable **order confirmation** and the **warehouse dispatch** together. Paid orders go straight to the warehouse; unpaid ones are held and released the moment payment is recorded.
- **Parts dispatch** — the warehouse queue, carrier and tracking capture, stock control and reorder warnings.
- **Inventory** — management and the warehouse edit it; everyone can see it.
  - **Parts and stock**: cost and selling price, margin, supplier, lead time, bay, stock level and what is on order. Every stock change goes through a **ledger** — who, when, why and for which dispatch or delivery.
  - **Bills of materials**: the parts in each pergola, with the rolled‑up parts cost and margin.
  - **Purchasing**: supplier purchase orders — raised by hand, or drafted in one click for everything below its reorder level — marked sent, then received straight into stock.
- **Announcements** — pinned notices, per‑team audiences, and a record of who has read what.
- **Team directory** — roles, extensions, Aircall IDs and live workload.
- **Performance** — management only.
  - **Output and service**: opened vs resolved over time, case mix, service level, an individual league table and workload distribution.
  - **Calls, chats and emails**: calls answered and missed, answer rates, speed of answer, chats and chat waits, emails received and sent, reply time against a 4‑hour target, time on the phone, handled volume over time by channel, the hours customers try to reach a person, and who handled what — grouped by team with each person's channel mix.

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
>
> The seeded product range follows the models the site lists — the 3x3m, 4x3m,
> 4x4m and 3x6m aluminium pergolas with integrated lighting, the wall‑mounted
> pergola and the Prestige Series with louvres that open to 135°. The parts,
> prices, suppliers and bills of materials behind them are realistic
> placeholders, to be replaced with the real catalogue.

Chart colours are separate and validated: the UI greys are too low‑chroma to be
safe data marks, so `src/lib/chart-theme.ts` holds three brand‑adjacent colours —
calls, live chats and emails keep the same one on every chart — that pass
lightness, chroma, colour‑vision‑deficiency and contrast checks with every pair
compared.

Order confirmations and purchase orders print as clean documents: the portal's
navigation is hidden in print.

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET
npm run setup               # generate client, create the database, seed it
npm run dev                 # http://localhost:3000
```

`npm run setup` seeds a realistic quarter of trading — nine staff, 34 customers,
29 orders with 100‑odd key dates, 46 cases, 78 tasks, six products with full bills
of materials, 25 priced parts with a stock ledger, 26 parts orders and their
dispatches, five supplier purchase orders, and about 19,000 calls, chats and
emails across 95 days — so every screen has something true to show on first run.

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
moving a parts dispatch forward — then the order‑to‑shelf loop: pricing and
placing a parts order, taking payment, picking it off the shelf and seeing it in
the ledger, adding and ticking off an order's key date, and receiving a purchase
order into stock. 28 checks.

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
prisma/schema.prisma      Data model — users, customers, orders and their key
                          dates, cases, tasks, products and bills of materials,
                          parts and the stock ledger, parts orders, dispatches,
                          purchase orders, announcements, activities
prisma/seed.ts            Deterministic demo data
scripts/smoke.mjs         End-to-end smoke test

src/app/(portal)/         Every signed-in screen
src/app/login/            Sign-in
src/actions/              Server actions — the only place data is written
src/components/           UI primitives, status chips, work components, charts
src/lib/constants.ts      Every status value, its label and its colour, once
src/lib/pricing.ts        How a parts order is priced — shared by the form and the server
src/lib/stock.ts          The stock ledger: the only way a stock level changes
src/lib/metrics.ts        Dashboard, performance and contact-centre calculations
src/lib/auth.ts           Password hashing, signed session cookies, permissions
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
- **Stock moves when the work moves — once.** Parts come off the shelf the first
  time a dispatch is picked (or sent), go back if it is cancelled, and are
  booked in when a purchase order is received. Every one of those writes a
  ledger row with the balance it left, so the number on the shelf can always be
  explained. Picking more than the shelf holds is refused with the shortfall.
- **Prices are never trusted from the browser.** The order form prices as you
  type using the same function the server uses (`src/lib/pricing.ts`), but the
  server re-reads every price from the catalogue. Placed orders keep the price
  they were quoted even if the catalogue changes later.
- **Warranty has a cost too.** Free‑of‑charge orders still carry their parts at
  list price, discounted to zero, so the confirmation shows the customer what
  was covered and management can see what warranty and goodwill are costing.
- **Payment releases the parcel.** A chargeable order sits in the warehouse
  queue as "held" until it is marked paid; recording the payment approves the
  dispatch. Nobody emails the warehouse to say "they've paid".
- **Missed contacts belong to the company.** An unanswered call or chat has no
  person on it, so it counts against the answer rate, never against an agent.
- **Reports use whole days.** The 7/30/90‑day reports run to the end of
  yesterday, so a half‑finished today never drags a trend line down; "Today so
  far" is its own view and only shows the hours that have started.
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
   are `httpOnly`, `sameSite=lax` and `secure` in production. If an account is
   deactivated, its session is cleared on the next page load.
3. **Real accounts.** Replace the seeded users. Password hashing is `bcrypt` at
   cost 10; roles are `AGENT`, `TEAM_LEAD`, `MANAGER`, `ADMIN`. Management and
   the `Warehouse` team can change prices, stock, bills of materials and purchase
   orders; everybody else can see them and order parts.
4. **Time zone.** Dates and times are rendered on the server, so run it with
   `TZ=Europe/London` — otherwise a 9am install booked in October shows as 8am.
5. **Real catalogue.** Replace the seeded parts, prices, suppliers and bills of
   materials with the real ones (the Inventory screens, or a one‑off import), and
   do an opening stock take so the ledger starts from a true count.

## Bringing the other systems in

The `Activity` model already carries `sourceSystem` and `sourceRef`, so imported
records stay traceable to where they came from. The remaining work is the
ingestion side:

- **Aircall** — webhook on `call.ended` → create an `Activity` of type `CALL`
  with the recording reference and duration, matched to the customer by phone
  number. `User.aircallId` already maps an Aircall agent to a CRM user. Set
  `outcome` (`ANSWERED`, `MISSED` or `VOICEMAIL`) and `waitSec` (time in the
  queue) and the calls report fills itself in; a missed call carries no user.
- **tawk.to** — webhook on chat end → an `Activity` of type `CHAT` with the
  transcript in `body`, `waitSec` for how long the visitor waited, `outcome`
  `MISSED` when nobody answered, plus a new case when the visitor is unknown.
- **Email** — an inbound address piped to a route handler that opens or appends
  to a case by reference in the subject line. Replies go in as outbound `EMAIL`
  activities with `waitSec` set to the time since the customer's email, which is
  what the reply‑time figures are built from.
- **Slack** — outbound only. Post SLA breaches and urgent dispatches to a channel
  with a deep link back into the portal, so Slack becomes a notifier rather than
  a place where work hides.
- **Trello** — a one‑off import mapping each card to a `Task` with an owner and a
  due date. Cards without either are the ones worth reviewing before migrating.
