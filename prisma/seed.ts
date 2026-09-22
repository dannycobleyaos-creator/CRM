/**
 * Seeds the portal with a realistic month of Hygge Pergola trading so every
 * screen — dashboards, boards, dispatch, performance — has something true to
 * show on first run. Deterministic: re-seeding produces the same portal.
 */
import { PrismaClient } from '@prisma/client';
import type { Customer, Order, Part, Ticket, User } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-randomness                                      */
/* ------------------------------------------------------------------ */

let seed = 20240917;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;

const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

/* ------------------------------------------------------------------ */
/* Reference data                                                       */
/* ------------------------------------------------------------------ */

const PASSWORD = 'hygge2024';

const USERS = [
  { name: 'Danny Cobley', email: 'danny.cobley@hyggepergola.co.uk', role: 'ADMIN', team: 'Sales', jobTitle: 'Managing Director', tone: 'ember', ext: '100', target: 8 },
  { name: 'Ruth Alderton', email: 'ruth.alderton@hyggepergola.co.uk', role: 'MANAGER', team: 'Customer Care', jobTitle: 'Head of Customer Care', tone: 'sky', ext: '110', target: 10 },
  { name: 'Marcus Idowu', email: 'marcus.idowu@hyggepergola.co.uk', role: 'TEAM_LEAD', team: 'Customer Care', jobTitle: 'Customer Care Team Lead', tone: 'moss', ext: '111', target: 14 },
  { name: 'Priya Raval', email: 'priya.raval@hyggepergola.co.uk', role: 'AGENT', team: 'Customer Care', jobTitle: 'Customer Care Agent', tone: 'amber', ext: '112', target: 16 },
  { name: 'Tom Hargreaves', email: 'tom.hargreaves@hyggepergola.co.uk', role: 'AGENT', team: 'Customer Care', jobTitle: 'Customer Care Agent', tone: 'clay', ext: '113', target: 16 },
  { name: 'Sophie Bennett', email: 'sophie.bennett@hyggepergola.co.uk', role: 'AGENT', team: 'Sales', jobTitle: 'Senior Sales Consultant', tone: 'ember', ext: '120', target: 14 },
  { name: 'Ollie Nash', email: 'ollie.nash@hyggepergola.co.uk', role: 'AGENT', team: 'Sales', jobTitle: 'Sales Consultant', tone: 'sky', ext: '121', target: 14 },
  { name: 'Karolina Nowak', email: 'karolina.nowak@hyggepergola.co.uk', role: 'AGENT', team: 'Warehouse', jobTitle: 'Dispatch Coordinator', tone: 'anthracite', ext: '130', target: 18 },
  { name: 'Dean Whitlock', email: 'dean.whitlock@hyggepergola.co.uk', role: 'TEAM_LEAD', team: 'Installations', jobTitle: 'Installations Manager', tone: 'moss', ext: '140', target: 10 },
] as const;

const FIRST = ['James', 'Olivia', 'Harry', 'Amelia', 'Jack', 'Isla', 'George', 'Ava', 'Noah', 'Freya', 'Oscar', 'Poppy', 'Leo', 'Ivy', 'Arthur', 'Florence', 'Henry', 'Willow', 'Theo', 'Daisy', 'Reuben', 'Nadia', 'Callum', 'Bethan', 'Marek', 'Sian', 'Dev', 'Rosie', 'Errol', 'Jo'];
const LAST = ['Whitaker', 'Bramley', 'Okonkwo', 'Fairhurst', 'Pendleton', 'Mistry', 'Halloran', 'Verity', 'Ashworth', 'Kowalski', 'Trevelyan', 'Nkemelu', 'Bowes', 'Lindqvist', 'Rashid', 'Cartwright', 'Delaney', 'Sowande', 'Hartley', 'Quinn', 'Ferris', 'Adeyemi', 'Brightwell', 'Mackie', 'Oyelaran', 'Prosser', 'Stanhope', 'Tamblyn', 'Ellery', 'Vaughan'];
const TOWNS = [
  ['Harrogate', 'North Yorkshire', 'HG1'], ['Ilkley', 'West Yorkshire', 'LS29'], ['Altrincham', 'Greater Manchester', 'WA14'],
  ['Solihull', 'West Midlands', 'B91'], ['Sevenoaks', 'Kent', 'TN13'], ['Guildford', 'Surrey', 'GU1'],
  ['Cheltenham', 'Gloucestershire', 'GL50'], ['Bath', 'Somerset', 'BA1'], ['Chester', 'Cheshire', 'CH1'],
  ['Norwich', 'Norfolk', 'NR2'], ['Exeter', 'Devon', 'EX4'], ['Edinburgh', 'Midlothian', 'EH3'],
  ['Cardiff', 'South Glamorgan', 'CF11'], ['Nottingham', 'Nottinghamshire', 'NG1'], ['Richmond', 'Greater London', 'TW9'],
] as const;
const STREETS = ['Beech Grove', 'Kingsway', 'Manor Rise', 'Willow Bank', 'The Paddocks', 'Chapel Lane', 'Orchard Close', 'Elmfield Road', 'Sycamore Drive', 'Harewood Avenue'];

const PRODUCT_LINES = [
  'Hygge™ Aluminium Pergola 3x3m',
  'Hygge™ Aluminium Pergola 4x3m',
  'Hygge™ Aluminium Pergola 4x4m',
  'Hygge™ Aluminium Pergola 6x4m',
  'Hygge™ Wall Mounted Pergola 3.6x3m',
  'Hygge™ Pergola Prestige Series 5x4m',
];
const EXTRAS = [
  'LED lighting system',
  'LED lighting + 2 windproof blinds',
  'LED lighting + 3 windproof blinds',
  'LED lighting + integrated drainage',
  'LED lighting, 4 windproof blinds + drainage',
  'Standard configuration',
];

const PARTS = [
  { sku: 'HP-LVR-3000-GY', name: 'Roof louvre blade 3.0m — matt grey', category: 'LOUVRE', stock: 46, reorder: 12, cost: 38.5, location: 'A1-04' },
  { sku: 'HP-LVR-4000-GY', name: 'Roof louvre blade 4.0m — matt grey', category: 'LOUVRE', stock: 31, reorder: 10, cost: 47.0, location: 'A1-05' },
  { sku: 'HP-LVR-4000-WH', name: 'Roof louvre blade 4.0m — matt white', category: 'LOUVRE', stock: 6, reorder: 10, cost: 47.0, location: 'A1-06' },
  { sku: 'HP-MTR-24V', name: 'Louvre drive motor 24V', category: 'MOTOR', stock: 14, reorder: 6, cost: 112.0, location: 'B2-01' },
  { sku: 'HP-MTR-BRKT', name: 'Motor mounting bracket set', category: 'FIXING', stock: 58, reorder: 15, cost: 18.25, location: 'B2-02' },
  { sku: 'HP-LED-STRIP-3M', name: 'LED strip 3m warm/RGB', category: 'LED', stock: 27, reorder: 10, cost: 54.0, location: 'C1-03' },
  { sku: 'HP-LED-PSU', name: 'LED driver + PSU 100W', category: 'LED', stock: 19, reorder: 8, cost: 42.0, location: 'C1-04' },
  { sku: 'HP-LED-REMOTE', name: 'LED remote handset', category: 'LED', stock: 3, reorder: 12, cost: 16.5, location: 'C1-06' },
  { sku: 'HP-BLD-3000-GY', name: 'Windproof blind 3.0m — matt grey', category: 'BLIND', stock: 11, reorder: 5, cost: 268.0, location: 'D3-02' },
  { sku: 'HP-BLD-CRANK', name: 'Blind crank handle', category: 'BLIND', stock: 40, reorder: 10, cost: 12.0, location: 'D3-05' },
  { sku: 'HP-GSK-EDGE-5M', name: 'Louvre edge gasket 5m roll', category: 'GASKET', stock: 22, reorder: 8, cost: 21.0, location: 'E1-01' },
  { sku: 'HP-FIX-POST-KIT', name: 'Post base fixing kit (4 post)', category: 'FIXING', stock: 35, reorder: 10, cost: 29.9, location: 'B1-07' },
  { sku: 'HP-FIX-WALL-KIT', name: 'Wall mount fixing kit', category: 'FIXING', stock: 24, reorder: 8, cost: 33.4, location: 'B1-08' },
  { sku: 'HP-DRN-CORNER', name: 'Drainage corner downpipe', category: 'SPARE', stock: 17, reorder: 6, cost: 26.75, location: 'E2-03' },
  { sku: 'HP-CAP-POST-GY', name: 'Post cap — matt grey (pair)', category: 'SPARE', stock: 52, reorder: 12, cost: 8.4, location: 'E2-06' },
];

const TICKET_TEMPLATES: Record<string, { subjects: string[]; bodies: string[] }> = {
  MISSING_PARTS: {
    subjects: ['Missing post cap from delivery', 'Two louvre blades short on order', 'Fixing kit not in the pallet', 'LED remote missing from box'],
    bodies: ['Customer has unpacked the pallet and the item is not present. Checked packing list against delivery note.', 'Installer on site confirmed the shortfall before starting. Install paused until replacement arrives.'],
  },
  WARRANTY: {
    subjects: ['Louvre motor not responding after 8 months', 'LED strip section failed', 'Powder coat blemish on front beam', 'Blind will not retract fully'],
    bodies: ['Within the 10 year structural warranty. Photos received and attached to the case.', 'Customer reports intermittent fault. Asked for a short video of the fault occurring.'],
  },
  DAMAGE: {
    subjects: ['Transit damage to corner post', 'Scratch to beam noted on delivery', 'Cracked end cap on arrival'],
    bodies: ['Damage noted on the delivery note at the point of handover. Carrier claim reference to follow.', 'Photos taken before unpacking. Replacement part required to complete the install.'],
  },
  INSTALL_SUPPORT: {
    subjects: ['Installer needs bracket spacing guidance', 'Wall fixing query on rendered wall', 'Levelling issue on sloping patio'],
    bodies: ['Needs a call back from the installations team before continuing on site.', 'Sent the fitting guide; customer would like to talk it through with someone.'],
  },
  DELIVERY: {
    subjects: ['Delivery slot change requested', 'No access for pallet lorry', 'Delivery running late — customer chasing'],
    bodies: ['Customer has asked to move the booked slot. Needs re-booking with the carrier.', 'Narrow lane access. Needs a smaller vehicle or a kerbside drop agreed.'],
  },
  SALES_ENQUIRY: {
    subjects: ['Quote request — 4x3m with blinds', 'Comparing matt grey vs matt white', 'Asking about lead times for May'],
    bodies: ['Came in through the website configurator. Wants a call to talk through options.', 'Live chat enquiry picked up from the website. Keen but price sensitive.'],
  },
  BILLING: {
    subjects: ['Balance invoice query', 'Deposit receipt not received', 'VAT invoice needed for business purchase'],
    bodies: ['Accounts query — needs the paperwork reissuing to a different address.', 'Customer paid by card but has not had the confirmation email.'],
  },
  OTHER: {
    subjects: ['General aftercare question', 'Cleaning and maintenance advice', 'Adding blinds to an existing pergola'],
    bodies: ['Straightforward advice request, no fault reported.', 'Potential upsell — existing customer wants to extend their setup.'],
  },
};

const TASK_TEMPLATES = [
  { title: 'Call back about delivery slot', category: 'CALLBACK' },
  { title: 'Send replacement parts tracking to customer', category: 'DISPATCH' },
  { title: 'Chase supplier on louvre blade ETA', category: 'SUPPLIER' },
  { title: 'Book installation date with customer', category: 'INSTALL' },
  { title: 'Follow up on quote sent last week', category: 'SALES' },
  { title: 'Raise carrier damage claim', category: 'ADMIN' },
  { title: 'Escalate to installations manager', category: 'ESCALATION' },
  { title: 'Send fitting guide and video link', category: 'ADMIN' },
  { title: 'Confirm balance payment before dispatch', category: 'ADMIN' },
  { title: 'Arrange engineer visit for motor fault', category: 'INSTALL' },
  { title: 'Update customer on warranty claim progress', category: 'CALLBACK' },
  { title: 'Check stock before promising a date', category: 'DISPATCH' },
  { title: 'Reply to live chat transcript follow-up', category: 'CALLBACK' },
  { title: 'Send VAT invoice to accounts contact', category: 'ADMIN' },
  { title: 'Photo review of reported powder coat defect', category: 'ESCALATION' },
];

/* ------------------------------------------------------------------ */
/* Seed                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('Clearing existing data…');
  await db.activity.deleteMany();
  await db.partRequestLine.deleteMany();
  await db.partRequest.deleteMany();
  await db.task.deleteMany();
  await db.ticket.deleteMany();
  await db.order.deleteMany();
  await db.customer.deleteMany();
  await db.announcementRead.deleteMany();
  await db.announcement.deleteMany();
  await db.part.deleteMany();
  await db.user.deleteMany();

  console.log('Creating team…');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: User[] = [];
  for (const u of USERS) {
    users.push(
      await db.user.create({
        data: {
          name: u.name,
          email: u.email,
          passwordHash,
          role: u.role,
          team: u.team,
          jobTitle: u.jobTitle,
          phoneExt: u.ext,
          avatarTone: u.tone,
          dailyTarget: u.target,
          aircallId: `AC-${u.ext}`,
          lastLoginAt: hoursAgo(int(1, 40)),
        },
      }),
    );
  }

  const byEmail = (email: string) => users.find((u) => u.email === email)!;
  const careAgents = users.filter((u) => u.team === 'Customer Care');
  const salesAgents = users.filter((u) => u.team === 'Sales');
  const assignable = users.filter((u) => u.role !== 'ADMIN');
  const warehouse = byEmail('karolina.nowak@hyggepergola.co.uk');

  console.log('Creating parts catalogue…');
  const parts: Part[] = [];
  for (const p of PARTS) {
    parts.push(
      await db.part.create({
        data: {
          sku: p.sku,
          name: p.name,
          category: p.category,
          stockQty: p.stock,
          reorderLevel: p.reorder,
          unitCost: p.cost,
          location: p.location,
        },
      }),
    );
  }

  console.log('Creating customers, orders, cases, tasks and dispatches…');
  const customers: Customer[] = [];
  const orders: Order[] = [];
  const tickets: Ticket[] = [];
  let customerNo = 1040;
  let orderNo = 2210;
  let caseNo = 4180;
  let dispatchNo = 3060;

  for (let i = 0; i < 34; i += 1) {
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7) % LAST.length]!;
    const name = `${first} ${last}`;
    const [city, county, postPrefix] = pick(TOWNS);
    const stage = pick(['LEAD', 'LEAD', 'QUOTED', 'QUOTED', 'WON', 'IN_PRODUCTION', 'INSTALLED', 'INSTALLED', 'AFTERCARE', 'LOST'] as const);
    const owner = pick(stage === 'LEAD' || stage === 'QUOTED' ? salesAgents : assignable);
    customerNo += int(1, 4);

    const customer = await db.customer.create({
      data: {
        ref: `HP-0${customerNo}`,
        name,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.co.uk`,
        phone: `07${int(100, 999)} ${int(100000, 999999)}`,
        addressL1: `${int(1, 120)} ${pick(STREETS)}`,
        city,
        county,
        postcode: `${postPrefix} ${int(1, 9)}${pick(['AA', 'BJ', 'DR', 'HL', 'PQ'])}`,
        source: pick(['WEBSITE', 'WEBSITE', 'AIRCALL', 'TAWK', 'REFERRAL', 'SHOWROOM', 'SOCIAL'] as const),
        stage,
        ownerId: owner.id,
        tags: chance(0.25) ? pick(['vip', 'repeat', 'trade', 'reviewer']) : null,
        notes: chance(0.3) ? 'Prefers contact after 5pm. Gate code on file with installations.' : null,
        createdAt: daysAgo(int(3, 120)),
      },
    });
    customers.push(customer);

    // Orders for anyone past the lead stage.
    if (!['LEAD', 'LOST'].includes(stage)) {
      orderNo += int(1, 3);
      const orderStatus =
        stage === 'QUOTED' ? 'QUOTE'
        : stage === 'WON' ? pick(['DEPOSIT_PAID', 'IN_PRODUCTION'] as const)
        : stage === 'IN_PRODUCTION' ? pick(['IN_PRODUCTION', 'READY', 'SCHEDULED'] as const)
        : pick(['DELIVERED', 'INSTALLED', 'INSTALLED'] as const);
      const orderedAt = daysAgo(int(5, 100));

      const order = await db.order.create({
        data: {
          ref: `HP-ORD-${orderNo}`,
          customerId: customer.id,
          productLine: pick(PRODUCT_LINES),
          sizeSpec: pick(['Freestanding', 'Wall mounted', 'Freestanding, 4 post', 'Wall mounted, left drop']),
          colour: chance(0.72) ? 'MATT_GREY' : 'MATT_WHITE',
          extras: pick(EXTRAS),
          value: int(38, 145) * 100,
          status: orderStatus,
          ownerId: customer.ownerId,
          orderedAt,
          deliveryDue: ['QUOTE'].includes(orderStatus) ? null : new Date(orderedAt.getTime() + int(14, 56) * 864e5),
          installedAt: orderStatus === 'INSTALLED' ? new Date(orderedAt.getTime() + int(20, 70) * 864e5) : null,
          installerRef: orderStatus === 'INSTALLED' ? `INST-${int(400, 899)}` : null,
        },
      });
      orders.push(order);
    }
  }

  // ---- Cases -------------------------------------------------------------
  const categories = Object.keys(TICKET_TEMPLATES);
  for (let i = 0; i < 46; i += 1) {
    const customer = pick(customers);
    const customerOrder = orders.find((o) => o.customerId === customer.id);
    const category = pick(categories);
    const tpl = TICKET_TEMPLATES[category]!;
    const priority = pick(['LOW', 'NORMAL', 'NORMAL', 'NORMAL', 'HIGH', 'HIGH', 'URGENT'] as const);
    const slaMinutes = { URGENT: 60, HIGH: 240, NORMAL: 480, LOW: 1440 }[priority];

    // Two thirds resolved, so performance reporting has real history.
    const resolvedCase = chance(0.62);
    const openedAt = resolvedCase ? daysAgo(int(1, 28)) : hoursAgo(int(1, 90));
    const status = resolvedCase
      ? pick(['RESOLVED', 'CLOSED', 'CLOSED'] as const)
      : pick(['NEW', 'NEW', 'OPEN', 'OPEN', 'OPEN', 'WAITING_CUSTOMER', 'WAITING_SUPPLIER'] as const);

    const channel = pick(['PHONE', 'PHONE', 'CHAT', 'EMAIL', 'EMAIL', 'WHATSAPP', 'SOCIAL'] as const);
    const assignee = status === 'NEW' && chance(0.35) ? null : pick(category === 'SALES_ENQUIRY' ? salesAgents : careAgents);

    // First response lands inside SLA most of the time — but not always.
    const respondedMinutes = chance(0.78) ? int(5, Math.max(10, slaMinutes - 20)) : slaMinutes + int(20, 600);
    const firstResponseAt = status === 'NEW' ? null : new Date(openedAt.getTime() + respondedMinutes * 60000);
    const resolvedAt = resolvedCase ? new Date(openedAt.getTime() + int(respondedMinutes + 30, respondedMinutes + 4000) * 60000) : null;

    caseNo += int(1, 3);
    const ticket = await db.ticket.create({
      data: {
        ref: `CASE-${caseNo}`,
        subject: pick(tpl.subjects),
        body: pick(tpl.bodies),
        customerId: customer.id,
        orderId: customerOrder?.id ?? null,
        channel,
        category,
        priority,
        status,
        assigneeId: assignee?.id ?? null,
        openedAt,
        firstResponseAt,
        resolvedAt,
        dueAt: new Date(openedAt.getTime() + slaMinutes * 60000),
        slaMinutes,
        reopenCount: chance(0.12) ? 1 : 0,
        satisfaction: resolvedCase && chance(0.7) ? pick([3, 4, 4, 5, 5, 5]) : null,
      },
    });
    tickets.push(ticket);

    // Timeline for the case: how it arrived, then what was done about it.
    await db.activity.create({
      data: {
        type: channel === 'PHONE' ? 'CALL' : channel === 'CHAT' ? 'CHAT' : 'EMAIL',
        direction: 'INBOUND',
        summary:
          channel === 'PHONE' ? `Inbound call — ${customer.name}`
          : channel === 'CHAT' ? `Live chat started — ${customer.name}`
          : `Email received — ${customer.name}`,
        body: ticket.body,
        customerId: customer.id,
        ticketId: ticket.id,
        // Inbound: it came from the customer, so no agent is credited with it.
        userId: null,
        sourceSystem: channel === 'PHONE' ? 'AIRCALL' : channel === 'CHAT' ? 'TAWK' : 'EMAIL',
        sourceRef: channel === 'PHONE' ? `call_${int(100000, 999999)}` : channel === 'CHAT' ? `chat_${int(10000, 99999)}` : `msg_${int(10000, 99999)}`,
        durationSec: channel === 'PHONE' ? int(45, 960) : channel === 'CHAT' ? int(120, 1400) : null,
        occurredAt: openedAt,
      },
    });

    if (firstResponseAt && assignee) {
      await db.activity.create({
        data: {
          type: channel === 'PHONE' ? 'CALL' : 'EMAIL',
          direction: 'OUTBOUND',
          summary: `${assignee.name} responded to the customer`,
          body: 'Acknowledged the enquiry, confirmed next steps and set expectations on timing.',
          customerId: customer.id,
          ticketId: ticket.id,
          userId: assignee.id,
          sourceSystem: 'CRM',
          durationSec: channel === 'PHONE' ? int(60, 700) : null,
          occurredAt: firstResponseAt,
        },
      });
    }

    if (resolvedAt && assignee) {
      await db.activity.create({
        data: {
          type: 'STATUS_CHANGE',
          summary: `Case marked ${status === 'CLOSED' ? 'closed' : 'resolved'} by ${assignee.name}`,
          body: 'Customer confirmed they were happy with the outcome.',
          customerId: customer.id,
          ticketId: ticket.id,
          userId: assignee.id,
          sourceSystem: 'CRM',
          occurredAt: resolvedAt,
        },
      });
    }
  }

  // ---- Tasks -------------------------------------------------------------
  for (let i = 0; i < 78; i += 1) {
    const tpl = pick(TASK_TEMPLATES);
    const ticket = chance(0.65) ? pick(tickets) : null;
    const customerId = ticket ? ticket.customerId : pick(customers).id;
    const assignee = pick(assignable);
    const creator = pick([byEmail('ruth.alderton@hyggepergola.co.uk'), byEmail('marcus.idowu@hyggepergola.co.uk'), assignee]);

    const status = pick([
      'TODO', 'TODO', 'TODO', 'IN_PROGRESS', 'IN_PROGRESS',
      'BLOCKED', 'AWAITING_OTHERS', 'DONE', 'DONE', 'DONE', 'DONE',
    ] as const);
    const createdAt = daysAgo(int(0, 21));
    const done = status === 'DONE';

    // A deliberate mix of overdue, due today and later — the dashboard needs both.
    const dueAt = done
      ? new Date(createdAt.getTime() + int(1, 5) * 864e5)
      : chance(0.3) ? hoursAgo(int(2, 60))
      : chance(0.45) ? hoursAhead(int(1, 9))
      : hoursAhead(int(24, 200));

    await db.task.create({
      data: {
        title: tpl.title,
        details: chance(0.55) ? 'Raised from the case timeline. Everything needed is on the customer record.' : null,
        status,
        priority: pick(['LOW', 'NORMAL', 'NORMAL', 'HIGH', 'HIGH', 'URGENT'] as const),
        category: tpl.category,
        assigneeId: assignee.id,
        createdById: creator.id,
        customerId,
        ticketId: ticket?.id ?? null,
        dueAt,
        startedAt: status === 'TODO' ? null : new Date(createdAt.getTime() + int(1, 40) * 3600_000),
        completedAt: done ? new Date(createdAt.getTime() + int(2, 90) * 3600_000) : null,
        blockedNote: status === 'BLOCKED' ? pick(['Waiting on supplier ETA for the replacement blade.', 'Customer not answering — third attempt made.', 'Needs manager approval before we can ship free of charge.']) : null,
        position: i,
        createdAt,
      },
    });
  }

  // ---- Parts dispatch ----------------------------------------------------
  const partsTickets = tickets.filter((t) => ['MISSING_PARTS', 'DAMAGE', 'WARRANTY'].includes(t.category));
  for (let i = 0; i < 26; i += 1) {
    const ticket = partsTickets.length ? pick(partsTickets) : pick(tickets);
    const customer = customers.find((c) => c.id === ticket.customerId)!;
    const order = orders.find((o) => o.customerId === customer.id);
    const requester = pick(careAgents);

    const status = pick([
      'REQUESTED', 'REQUESTED', 'APPROVED', 'APPROVED', 'PICKING',
      'AWAITING_STOCK', 'DISPATCHED', 'DISPATCHED', 'DELIVERED', 'DELIVERED',
    ] as const);
    const requestedAt = daysAgo(int(0, 18));
    const dispatched = ['DISPATCHED', 'DELIVERED'].includes(status);
    const dispatchedAt = dispatched ? new Date(requestedAt.getTime() + int(6, 90) * 3600_000) : null;

    dispatchNo += int(1, 3);
    const request = await db.partRequest.create({
      data: {
        ref: `DSP-${dispatchNo}`,
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket.id,
        requestedById: requester.id,
        status,
        priority: pick(['NORMAL', 'NORMAL', 'HIGH', 'HIGH', 'URGENT'] as const),
        reason: pick([
          'Shortfall against the packing list — confirmed by the installer on site.',
          'Warranty replacement, photos on the case.',
          'Transit damage noted on the delivery note.',
          'Goodwill replacement agreed by the team lead.',
        ]),
        carrier: dispatched ? pick(['DPD', 'Royal Mail', 'Palletways', 'Parcelforce']) : null,
        trackingRef: dispatched ? `${pick(['DPD', 'RM', 'PW', 'PF'])}${int(10000000, 99999999)}` : null,
        shipToName: customer.name,
        shipToLine1: customer.addressL1,
        shipToCity: customer.city,
        shipToPost: customer.postcode,
        requestedAt,
        dueAt: new Date(requestedAt.getTime() + int(24, 120) * 3600_000),
        dispatchedAt,
        deliveredAt: status === 'DELIVERED' && dispatchedAt ? new Date(dispatchedAt.getTime() + int(18, 72) * 3600_000) : null,
        notes: chance(0.4) ? 'Customer has asked for a text before the courier arrives.' : null,
      },
    });

    const lineCount = int(1, 3);
    const used = new Set<string>();
    for (let l = 0; l < lineCount; l += 1) {
      const part = pick(parts);
      if (used.has(part.id)) continue;
      used.add(part.id);
      await db.partRequestLine.create({
        data: { partRequestId: request.id, partId: part.id, qty: int(1, 4) },
      });
    }

    if (dispatchedAt) {
      await db.activity.create({
        data: {
          type: 'DISPATCH',
          summary: `Parts dispatched via ${request.carrier} (${request.trackingRef})`,
          body: 'Tracking sent to the customer by email and logged against the case.',
          customerId: customer.id,
          ticketId: ticket.id,
          partRequestId: request.id,
          userId: warehouse.id,
          sourceSystem: 'CRM',
          occurredAt: dispatchedAt,
        },
      });
    }
  }

  // ---- Announcements -----------------------------------------------------
  console.log('Creating announcement board…');
  const ruth = byEmail('ruth.alderton@hyggepergola.co.uk');
  const danny = byEmail('danny.cobley@hyggepergola.co.uk');
  const dean = byEmail('dean.whitlock@hyggepergola.co.uk');

  const announcements = [
    {
      title: 'Everything moves into the CRM from Monday',
      body: 'From Monday morning the Trello boards are read-only. Every case, callback and parts request lives in the portal. If it is not in here, it did not happen — that is how we finally get one version of the truth.\n\nYour daily list is on the dashboard when you log in. Work top to bottom.',
      category: 'PROCESS',
      author: danny,
      pinned: true,
      publishedAt: daysAgo(2),
    },
    {
      title: 'Matt white louvre blades — low stock',
      body: 'We are down to six 4.0m matt white blades with the next container three weeks out. Before you promise a dispatch date on a white pergola, check the parts catalogue and flag it to Karolina.',
      category: 'URGENT',
      author: ruth,
      pinned: true,
      publishedAt: daysAgo(1),
    },
    {
      title: 'New SLA targets for first response',
      body: 'Urgent cases: 1 hour. High: 4 hours. Normal: same working day. Low: 24 hours.\n\nThe clock starts when the case is created, not when you open it. The deadline chip on every case tells you where you stand.',
      category: 'PROCESS',
      author: ruth,
      pinned: false,
      publishedAt: daysAgo(5),
    },
    {
      title: 'Installations diary now shared with Customer Care',
      body: 'Care can see install dates directly on the order record, so we can stop pinging Installations on Slack to ask. If a date needs moving, raise a task against the order and it lands in Dean’s queue.',
      category: 'COMPANY',
      author: dean,
      pinned: false,
      publishedAt: daysAgo(8),
    },
    {
      title: '1,000 Trustpilot reviews — thank you',
      body: 'We passed a thousand reviews this week and held our rating. That is the aftercare team as much as it is sales. Drinks are on the company on Friday.',
      category: 'CELEBRATION',
      author: danny,
      pinned: false,
      publishedAt: daysAgo(12),
    },
    {
      title: 'Prestige Series launch — briefing pack',
      body: 'The Prestige Series opens to 135 degrees and lands in the configurator next month. Sales briefing is Thursday at 9am; the spec sheet is on the product record.',
      category: 'PRODUCT',
      author: danny,
      pinned: false,
      publishedAt: daysAgo(16),
    },
  ] as const;

  for (const a of announcements) {
    const created = await db.announcement.create({
      data: {
        title: a.title,
        body: a.body,
        category: a.category,
        authorId: a.author.id,
        pinned: a.pinned,
        publishedAt: a.publishedAt,
      },
    });
    // Most of the team has read the older posts; the newest ones are unread.
    for (const u of users) {
      if (chance(a.pinned ? 0.35 : 0.8)) {
        await db.announcementRead.create({
          data: { announcementId: created.id, userId: u.id, readAt: hoursAgo(int(1, 60)) },
        });
      }
    }
  }

  // ---- A few standalone customer notes so timelines feel lived in ---------
  for (let i = 0; i < 30; i += 1) {
    const customer = pick(customers);
    await db.activity.create({
      data: {
        type: pick(['NOTE', 'CALL', 'CHAT', 'EMAIL', 'SMS'] as const),
        direction: chance(0.5) ? 'INBOUND' : 'OUTBOUND',
        summary: pick([
          'Left a voicemail asking for a callback',
          'Customer confirmed the patio is ready for install',
          'Sent the brochure and finance options',
          'Chat: asked about lead times for matt white',
          'Texted the courier window for tomorrow',
          'Discussed adding blinds at a later date',
        ]),
        customerId: customer.id,
        userId: pick(assignable).id,
        sourceSystem: pick(['AIRCALL', 'TAWK', 'EMAIL', 'CRM'] as const),
        durationSec: chance(0.4) ? int(40, 600) : null,
        occurredAt: hoursAgo(int(2, 600)),
      },
    });
  }

  const counts = {
    users: await db.user.count(),
    customers: await db.customer.count(),
    orders: await db.order.count(),
    cases: await db.ticket.count(),
    tasks: await db.task.count(),
    dispatches: await db.partRequest.count(),
    parts: await db.part.count(),
    announcements: await db.announcement.count(),
    activities: await db.activity.count(),
  };
  console.log('Seed complete:', counts);
  console.log(`\nSign in with any team email and the password: ${PASSWORD}`);
  console.log(`e.g. ${USERS[1].email} (manager) or ${USERS[3].email} (agent)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
