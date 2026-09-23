/**
 * Seeds the portal with a realistic quarter of Hygge Pergola trading so every
 * screen — dashboards, boards, orders, inventory, dispatch, performance — has
 * something true to show on first run. Deterministic: re-seeding produces the
 * same portal (relative to the day it is run).
 */
import { PrismaClient } from '@prisma/client';
import type { Customer, Order, Part, Prisma, Product, Ticket, User } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { lineTotal, priceOrder } from '../src/lib/pricing';

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
const daysAhead = (d: number) => hoursAhead(d * 24);
const plusDays = (date: Date, d: number) => new Date(date.getTime() + d * 864e5);
const plusHours = (date: Date, h: number) => new Date(date.getTime() + h * 3600_000);
/**
 * The team works Monday to Friday. A weekend time moves on to Monday — or back
 * to Friday when Monday has not happened yet — so staff activity never lands
 * on a closed day.
 */
const onWorkingDay = (date: Date) => {
  const day = date.getDay();
  if (day !== 0 && day !== 6) return date;
  const forward = plusDays(date, day === 6 ? 2 : 1);
  return forward <= NOW ? forward : plusDays(date, day === 6 ? -1 : -2);
};
/**
 * Phones and live chat are staffed 8am to 6pm on working days, so anything a
 * person answered happened inside those hours.
 */
const duringOpeningHours = (date: Date) => {
  let d = onWorkingDay(date);
  const hour = d.getHours();
  if (hour < 8 || hour > 17) {
    d = new Date(d);
    d.setHours(hour < 8 ? 8 : 17);
  }
  if (d > NOW) d = onWorkingDay(plusDays(d, -1));
  return d;
};
/** A working-hours time on the given day, so dates read like real bookings. */
const atHour = (date: Date, hour: number) => {
  const d = new Date(date);
  d.setHours(hour, pick([0, 0, 15, 30, 30, 45]), 0, 0);
  return d;
};

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

/* ---- Suppliers and the parts catalogue ------------------------------ */

const NORTHGATE = 'Northgate Aluminium Ltd';
const DRIVECRAFT = 'Drivecraft Motors';
const LUMENLINE = 'Lumenline Components';
const WEATHERSCREEN = 'Weatherscreen Textiles';
const ANCHORFIX = 'Anchorfix Supplies';

type PartDef = {
  sku: string; name: string; category: string; stock: number; reorder: number; reorderQty: number;
  cost: number; price: number; location: string; supplier: string; lead: number;
};

// `stock` is the level the shelf should end up at once the seeded picks and
// deliveries have been replayed through the stock ledger.
const PARTS: PartDef[] = [
  { sku: 'HP-LVR-3000-GY', name: 'Roof louvre blade 3.0m — matt grey', category: 'LOUVRE', stock: 46, reorder: 12, reorderQty: 40, cost: 38.5, price: 79, location: 'A1-04', supplier: NORTHGATE, lead: 28 },
  { sku: 'HP-LVR-3000-WH', name: 'Roof louvre blade 3.0m — matt white', category: 'LOUVRE', stock: 18, reorder: 10, reorderQty: 30, cost: 38.5, price: 79, location: 'A1-07', supplier: NORTHGATE, lead: 28 },
  { sku: 'HP-LVR-4000-GY', name: 'Roof louvre blade 4.0m — matt grey', category: 'LOUVRE', stock: 31, reorder: 10, reorderQty: 30, cost: 47, price: 96, location: 'A1-05', supplier: NORTHGATE, lead: 28 },
  { sku: 'HP-LVR-4000-WH', name: 'Roof louvre blade 4.0m — matt white', category: 'LOUVRE', stock: 6, reorder: 10, reorderQty: 30, cost: 47, price: 96, location: 'A1-06', supplier: NORTHGATE, lead: 28 },
  { sku: 'HP-PST-2500-GY', name: 'Corner post 2.5m — matt grey', category: 'STRUCTURE', stock: 12, reorder: 4, reorderQty: 10, cost: 88, price: 179, location: 'F1-01', supplier: NORTHGATE, lead: 35 },
  { sku: 'HP-PST-2500-WH', name: 'Corner post 2.5m — matt white', category: 'STRUCTURE', stock: 5, reorder: 4, reorderQty: 10, cost: 88, price: 179, location: 'F1-02', supplier: NORTHGATE, lead: 35 },
  { sku: 'HP-BM-3000-GY', name: 'Gutter beam 3.0m — matt grey', category: 'STRUCTURE', stock: 9, reorder: 4, reorderQty: 8, cost: 72, price: 149, location: 'F2-01', supplier: NORTHGATE, lead: 35 },
  { sku: 'HP-BM-4000-GY', name: 'Gutter beam 4.0m — matt grey', category: 'STRUCTURE', stock: 7, reorder: 4, reorderQty: 8, cost: 91, price: 189, location: 'F2-02', supplier: NORTHGATE, lead: 35 },
  { sku: 'HP-MTR-24V', name: 'Louvre drive motor 24V', category: 'MOTOR', stock: 14, reorder: 6, reorderQty: 10, cost: 112, price: 229, location: 'B2-01', supplier: DRIVECRAFT, lead: 21 },
  { sku: 'HP-MTR-BRKT', name: 'Motor mounting bracket set', category: 'FIXING', stock: 58, reorder: 15, reorderQty: 30, cost: 18.25, price: 39, location: 'B2-02', supplier: DRIVECRAFT, lead: 21 },
  { sku: 'HP-CTRL-HUB', name: 'Control box and receiver', category: 'MOTOR', stock: 9, reorder: 5, reorderQty: 10, cost: 64, price: 139, location: 'B2-04', supplier: DRIVECRAFT, lead: 21 },
  { sku: 'HP-RAIN-SNS', name: 'Rain sensor', category: 'MOTOR', stock: 11, reorder: 5, reorderQty: 10, cost: 29, price: 65, location: 'B2-05', supplier: DRIVECRAFT, lead: 21 },
  { sku: 'HP-LED-STRIP-3M', name: 'LED strip 3m warm/RGB', category: 'LED', stock: 27, reorder: 10, reorderQty: 20, cost: 54, price: 115, location: 'C1-03', supplier: LUMENLINE, lead: 14 },
  { sku: 'HP-LED-STRIP-4M', name: 'LED strip 4m warm/RGB', category: 'LED', stock: 16, reorder: 8, reorderQty: 20, cost: 66, price: 139, location: 'C1-02', supplier: LUMENLINE, lead: 14 },
  { sku: 'HP-LED-PSU', name: 'LED driver + PSU 100W', category: 'LED', stock: 19, reorder: 8, reorderQty: 15, cost: 42, price: 89, location: 'C1-04', supplier: LUMENLINE, lead: 14 },
  { sku: 'HP-LED-REMOTE', name: 'LED remote handset', category: 'LED', stock: 3, reorder: 12, reorderQty: 30, cost: 16.5, price: 35, location: 'C1-06', supplier: LUMENLINE, lead: 14 },
  { sku: 'HP-BLD-3000-GY', name: 'Windproof blind 3.0m — matt grey', category: 'BLIND', stock: 11, reorder: 5, reorderQty: 8, cost: 268, price: 549, location: 'D3-02', supplier: WEATHERSCREEN, lead: 30 },
  { sku: 'HP-BLD-4000-GY', name: 'Windproof blind 4.0m — matt grey', category: 'BLIND', stock: 4, reorder: 4, reorderQty: 6, cost: 312, price: 639, location: 'D3-03', supplier: WEATHERSCREEN, lead: 30 },
  { sku: 'HP-BLD-CRANK', name: 'Blind crank handle', category: 'BLIND', stock: 40, reorder: 10, reorderQty: 25, cost: 12, price: 26, location: 'D3-05', supplier: WEATHERSCREEN, lead: 30 },
  { sku: 'HP-GSK-EDGE-5M', name: 'Louvre edge gasket 5m roll', category: 'GASKET', stock: 22, reorder: 8, reorderQty: 20, cost: 21, price: 45, location: 'E1-01', supplier: ANCHORFIX, lead: 10 },
  { sku: 'HP-LVR-PIN-SET', name: 'Louvre pivot pin and bush set (10)', category: 'FIXING', stock: 64, reorder: 15, reorderQty: 50, cost: 6.2, price: 14.5, location: 'B1-02', supplier: ANCHORFIX, lead: 10 },
  { sku: 'HP-FIX-POST-KIT', name: 'Post base fixing kit (4 post)', category: 'FIXING', stock: 35, reorder: 10, reorderQty: 20, cost: 29.9, price: 59, location: 'B1-07', supplier: ANCHORFIX, lead: 10 },
  { sku: 'HP-FIX-WALL-KIT', name: 'Wall mount fixing kit', category: 'FIXING', stock: 24, reorder: 8, reorderQty: 15, cost: 33.4, price: 69, location: 'B1-08', supplier: ANCHORFIX, lead: 10 },
  { sku: 'HP-DRN-CORNER', name: 'Drainage corner downpipe', category: 'SPARE', stock: 17, reorder: 6, reorderQty: 12, cost: 26.75, price: 55, location: 'E2-03', supplier: NORTHGATE, lead: 28 },
  { sku: 'HP-CAP-POST-GY', name: 'Post cap — matt grey (pair)', category: 'SPARE', stock: 52, reorder: 12, reorderQty: 40, cost: 8.4, price: 18, location: 'E2-06', supplier: NORTHGATE, lead: 28 },
];

/* ---- Products and their bills of materials -------------------------- */

type ProductDef = {
  code: string; name: string; sizeSpec: string; basePrice: number; description: string;
  bom: [sku: string, qty: number][];
};

const CONTROL_KIT: [string, number][] = [
  ['HP-MTR-24V', 1], ['HP-MTR-BRKT', 1], ['HP-CTRL-HUB', 1], ['HP-RAIN-SNS', 1],
  ['HP-LED-PSU', 1], ['HP-LED-REMOTE', 1],
];

const PRODUCTS: ProductDef[] = [
  {
    code: 'HP-PG-3X3', name: 'Hygge™ Aluminium Pergola 3x3m', sizeSpec: '3m x 3m, freestanding, 4 posts', basePrice: 5495,
    description: 'Motorised louvred roof with integrated LED lighting and drainage through the posts.',
    bom: [['HP-PST-2500-GY', 4], ['HP-BM-3000-GY', 4], ['HP-LVR-3000-GY', 15], ['HP-LVR-PIN-SET', 2], ...CONTROL_KIT, ['HP-LED-STRIP-3M', 4], ['HP-GSK-EDGE-5M', 3], ['HP-FIX-POST-KIT', 1], ['HP-DRN-CORNER', 2], ['HP-CAP-POST-GY', 2]],
  },
  {
    code: 'HP-PG-4X3', name: 'Hygge™ Aluminium Pergola 4x3m', sizeSpec: '4m x 3m, freestanding, 4 posts', basePrice: 6495,
    description: 'The most popular size — room for a six-seat dining set under a fully closable roof.',
    bom: [['HP-PST-2500-GY', 4], ['HP-BM-4000-GY', 2], ['HP-BM-3000-GY', 2], ['HP-LVR-3000-GY', 20], ['HP-LVR-PIN-SET', 2], ...CONTROL_KIT, ['HP-LED-STRIP-4M', 2], ['HP-LED-STRIP-3M', 2], ['HP-GSK-EDGE-5M', 4], ['HP-FIX-POST-KIT', 1], ['HP-DRN-CORNER', 2], ['HP-CAP-POST-GY', 2]],
  },
  {
    code: 'HP-PG-4X4', name: 'Hygge™ Aluminium Pergola 4x4m', sizeSpec: '4m x 4m, freestanding, 4 posts', basePrice: 7495,
    description: 'Square footprint with 4.0m louvres — the size most often paired with blinds on all sides.',
    bom: [['HP-PST-2500-GY', 4], ['HP-BM-4000-GY', 4], ['HP-LVR-4000-GY', 20], ['HP-LVR-PIN-SET', 2], ...CONTROL_KIT, ['HP-LED-STRIP-4M', 4], ['HP-GSK-EDGE-5M', 4], ['HP-FIX-POST-KIT', 1], ['HP-DRN-CORNER', 2], ['HP-CAP-POST-GY', 2]],
  },
  {
    code: 'HP-PG-3X6', name: 'Hygge™ Aluminium Pergola 3x6m', sizeSpec: '3m x 6m, freestanding, 6 posts', basePrice: 9495,
    description: 'Long-span layout for terraces and pool sides, with two drive motors.',
    bom: [['HP-PST-2500-GY', 6], ['HP-BM-3000-GY', 6], ['HP-LVR-3000-GY', 30], ['HP-LVR-PIN-SET', 3], ['HP-MTR-24V', 2], ['HP-MTR-BRKT', 2], ['HP-CTRL-HUB', 1], ['HP-RAIN-SNS', 1], ['HP-LED-PSU', 2], ['HP-LED-REMOTE', 1], ['HP-LED-STRIP-3M', 6], ['HP-GSK-EDGE-5M', 6], ['HP-FIX-POST-KIT', 2], ['HP-DRN-CORNER', 2], ['HP-CAP-POST-GY', 3]],
  },
  {
    code: 'HP-PG-WM-3X3', name: 'Hygge™ Wall Mounted Pergola 3x3m', sizeSpec: '3m x 3m, wall mounted, 2 posts', basePrice: 4995,
    description: 'Fixes to the house wall on one side — two posts, same louvred roof and lighting.',
    bom: [['HP-PST-2500-GY', 2], ['HP-BM-3000-GY', 3], ['HP-LVR-3000-GY', 15], ['HP-LVR-PIN-SET', 2], ...CONTROL_KIT, ['HP-LED-STRIP-3M', 3], ['HP-GSK-EDGE-5M', 3], ['HP-FIX-WALL-KIT', 1], ['HP-DRN-CORNER', 1], ['HP-CAP-POST-GY', 1]],
  },
  {
    code: 'HP-PG-PRE-4X4', name: 'Hygge™ Pergola Prestige Series 4x4m', sizeSpec: '4m x 4m, freestanding, 135° louvres', basePrice: 8995,
    description: 'Louvres open through 135° so the shade can follow the sun all afternoon.',
    bom: [['HP-PST-2500-GY', 4], ['HP-BM-4000-GY', 4], ['HP-LVR-4000-GY', 20], ['HP-LVR-PIN-SET', 2], ['HP-MTR-24V', 2], ['HP-MTR-BRKT', 2], ['HP-CTRL-HUB', 1], ['HP-RAIN-SNS', 1], ['HP-LED-PSU', 1], ['HP-LED-REMOTE', 1], ['HP-LED-STRIP-4M', 4], ['HP-GSK-EDGE-5M', 4], ['HP-FIX-POST-KIT', 1], ['HP-DRN-CORNER', 2], ['HP-CAP-POST-GY', 2]],
  },
];

const EXTRAS = [
  { label: 'Standard configuration — LED lighting included', add: 0 },
  { label: 'LED lighting + 2 windproof blinds', add: 1298 },
  { label: 'LED lighting + 3 windproof blinds', add: 1947 },
  { label: 'LED lighting + integrated drainage upgrade', add: 395 },
  { label: 'LED lighting, 4 windproof blinds + drainage', add: 2991 },
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

const ORDER_NOTES: { type: string; direction: string | null; summary: string; body?: string }[] = [
  { type: 'NOTE', direction: null, summary: 'Customer confirmed the patio base is level and ready', body: 'Sent photos — slab is 150mm concrete, fine for the post base fixings.' },
  { type: 'CALL', direction: 'OUTBOUND', summary: 'Called to confirm the delivery window', body: 'Pallet delivery AM. Customer will be in; neighbour can sign if not.' },
  { type: 'EMAIL', direction: 'OUTBOUND', summary: 'Sent the balance invoice and delivery guide' },
  { type: 'NOTE', direction: null, summary: 'Access is via the side gate — 90cm wide', body: 'Pallet will need splitting at the kerb. Flagged to the carrier on the booking.' },
  { type: 'CALL', direction: 'INBOUND', summary: 'Customer asked whether the install can move a week later', body: 'Checked the installations diary — moved without affecting anyone else.' },
  { type: 'EMAIL', direction: 'INBOUND', summary: 'Customer sent photos of the finished base' },
  { type: 'NOTE', direction: null, summary: 'Wants the LED set to warm white by default', body: 'Installer to pair the remote on the day and show them the scene buttons.' },
  { type: 'CALL', direction: 'OUTBOUND', summary: 'Aftercare call — very happy, may add blinds in spring' },
];

/* ---- Contact centre profiles ---------------------------------------- */

/**
 * Average daily volumes and habits per person. Different on purpose — the
 * manager's report is only worth reading if people genuinely differ.
 */
type Profile = {
  callsIn: number; callsOut: number; chats: number; emails: number;
  callMins: number; replyMins: number;
};
const PROFILES: Record<string, Profile> = {
  'ruth.alderton@hyggepergola.co.uk': { callsIn: 3, callsOut: 2, chats: 1, emails: 5, callMins: 8, replyMins: 240 },
  'marcus.idowu@hyggepergola.co.uk': { callsIn: 9, callsOut: 3, chats: 5, emails: 8, callMins: 6.2, replyMins: 110 },
  'priya.raval@hyggepergola.co.uk': { callsIn: 14, callsOut: 5, chats: 9, emails: 12, callMins: 5.4, replyMins: 65 },
  'tom.hargreaves@hyggepergola.co.uk': { callsIn: 11, callsOut: 3, chats: 6, emails: 9, callMins: 7.8, replyMins: 190 },
  'sophie.bennett@hyggepergola.co.uk': { callsIn: 8, callsOut: 9, chats: 6, emails: 10, callMins: 9.5, replyMins: 85 },
  'ollie.nash@hyggepergola.co.uk': { callsIn: 7, callsOut: 8, chats: 7, emails: 8, callMins: 8.4, replyMins: 150 },
  'dean.whitlock@hyggepergola.co.uk': { callsIn: 3, callsOut: 4, chats: 0, emails: 5, callMins: 6.5, replyMins: 300 },
  'karolina.nowak@hyggepergola.co.uk': { callsIn: 2, callsOut: 2, chats: 0, emails: 6, callMins: 4, replyMins: 200 },
  'danny.cobley@hyggepergola.co.uk': { callsIn: 1, callsOut: 1, chats: 0, emails: 3, callMins: 10, replyMins: 420 },
};

/** When customers get in touch, 8am to 6pm. Mid-morning and after lunch peak. */
const HOUR_WEIGHTS: [number, number][] = [
  [8, 0.6], [9, 1.2], [10, 1.45], [11, 1.3], [12, 0.85], [13, 1.0], [14, 1.25], [15, 1.1], [16, 0.9], [17, 0.55],
];
const HOUR_TOTAL = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);
const pickHour = () => {
  let r = rand() * HOUR_TOTAL;
  for (const [h, w] of HOUR_WEIGHTS) {
    r -= w;
    if (r <= 0) return h;
  }
  return 17;
};
const PEAK_HOURS = new Set([10, 11, 14]);

const CALL_IN_SUMMARIES = ['Inbound call — delivery date query', 'Inbound call — installation question', 'Inbound call — new enquiry about a 4x3m', 'Inbound call — warranty question', 'Inbound call — chasing parts tracking', 'Inbound call — finance options', 'Inbound call — blind operation question'];
const CALL_OUT_SUMMARIES = ['Outbound call — confirmed delivery slot', 'Outbound call — quote follow-up', 'Outbound call — booked installation date', 'Outbound call — parts tracking update', 'Outbound call — aftercare check-in'];
const CHAT_SUMMARIES = ['Live chat — lead times for matt white', 'Live chat — sizes for a small garden', 'Live chat — does it need planning permission?', 'Live chat — LED remote not pairing', 'Live chat — delivery tracking', 'Live chat — comparing 3x3m and 4x3m'];
const EMAIL_OUT_SUMMARIES = ['Replied — delivery guide and prep checklist', 'Replied — quote with blind options', 'Replied — warranty claim next steps', 'Replied — balance invoice', 'Replied — fitting instructions'];
const EMAIL_IN_SUMMARIES = ['Email received — delivery query', 'Email received — new quote request', 'Email received — photos of an issue', 'Email received — invoice question'];

/* ------------------------------------------------------------------ */
/* Seed                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('Clearing existing data…');
  await db.activity.deleteMany();
  await db.partsOrderLine.deleteMany();
  await db.partsOrder.deleteMany();
  await db.partRequestLine.deleteMany();
  await db.partRequest.deleteMany();
  await db.stockMove.deleteMany();
  await db.purchaseOrderLine.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.bomLine.deleteMany();
  await db.orderDate.deleteMany();
  await db.task.deleteMany();
  await db.ticket.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
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
  const installer = byEmail('dean.whitlock@hyggepergola.co.uk');

  console.log('Creating parts catalogue and bills of materials…');
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
          reorderQty: p.reorderQty,
          unitCost: p.cost,
          unitPrice: p.price,
          supplier: p.supplier,
          leadTimeDays: p.lead,
          location: p.location,
        },
      }),
    );
  }
  const partBySku = (sku: string) => parts.find((p) => p.sku === sku)!;

  const products: Product[] = [];
  for (const def of PRODUCTS) {
    products.push(
      await db.product.create({
        data: {
          code: def.code,
          name: def.name,
          sizeSpec: def.sizeSpec,
          basePrice: def.basePrice,
          description: def.description,
          createdAt: daysAgo(120),
          bom: {
            create: def.bom.map(([sku, qty]) => ({ partId: partBySku(sku).id, qty })),
          },
        },
      }),
    );
  }

  console.log('Creating customers, orders and key dates…');
  const customers: Customer[] = [];
  const orders: Order[] = [];
  const tickets: Ticket[] = [];
  const orderDates: Prisma.OrderDateCreateManyInput[] = [];
  const orderNotes: Prisma.ActivityCreateManyInput[] = [];
  let customerNo = 1040;
  let orderNo = 2210;
  let caseNo = 4180;
  // Balance chasing and aftercare calls are Customer Care's, shared in turn.
  let careTurn = 0;
  const nextCareAgent = () => careAgents[careTurn++ % careAgents.length]!.id;

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
    if (['LEAD', 'LOST'].includes(stage)) continue;

    orderNo += int(1, 3);
    const orderStatus =
      stage === 'QUOTED' ? 'QUOTE'
      : stage === 'WON' ? pick(['DEPOSIT_PAID', 'IN_PRODUCTION'] as const)
      : stage === 'IN_PRODUCTION' ? pick(['IN_PRODUCTION', 'READY', 'SCHEDULED', 'DELIVERED'] as const)
      : pick(['INSTALLED', 'INSTALLED', 'INSTALLED'] as const);

    // Work the calendar backwards from where the order is today, so a
    // delivered order was delivered in the past and a booked install is ahead.
    let orderedAt: Date;
    let deliveryDue: Date | null = null;
    let installAt: Date | null = null;
    let installedAt: Date | null = null;
    switch (orderStatus) {
      case 'QUOTE':
        orderedAt = daysAgo(int(2, 20));
        break;
      case 'DEPOSIT_PAID':
        orderedAt = daysAgo(int(3, 15));
        deliveryDue = atHour(daysAhead(int(21, 50)), 9);
        break;
      case 'IN_PRODUCTION':
        orderedAt = daysAgo(int(15, 40));
        deliveryDue = atHour(daysAhead(int(7, 30)), 9);
        break;
      case 'READY':
        orderedAt = daysAgo(int(30, 55));
        deliveryDue = atHour(daysAhead(int(1, 12)), 9);
        break;
      case 'SCHEDULED':
        orderedAt = daysAgo(int(35, 60));
        deliveryDue = atHour(daysAhead(int(0, 6)), 9);
        installAt = atHour(plusDays(deliveryDue, int(1, 4)), 8);
        break;
      case 'DELIVERED':
        orderedAt = daysAgo(int(40, 70));
        deliveryDue = atHour(daysAgo(int(1, 8)), 9);
        installAt = atHour(daysAhead(int(0, 6)), 8);
        break;
      default: // INSTALLED
        installedAt = atHour(daysAgo(int(3, 60)), 8);
        deliveryDue = atHour(plusDays(installedAt, -int(2, 7)), 9);
        orderedAt = plusDays(deliveryDue, -int(28, 50));
        installAt = installedAt;
    }

    const product = pick(products);
    const extra = pick(EXTRAS);
    const order = await db.order.create({
      data: {
        ref: `HP-ORD-${orderNo}`,
        customerId: customer.id,
        productId: product.id,
        productLine: product.name,
        sizeSpec: product.sizeSpec,
        colour: chance(0.72) ? 'MATT_GREY' : 'MATT_WHITE',
        extras: extra.label,
        value: product.basePrice + extra.add,
        status: orderStatus,
        ownerId: customer.ownerId,
        orderedAt,
        deliveryDue,
        installedAt,
        installerRef: installedAt ? `INST-${int(400, 899)}` : null,
      },
    });
    orders.push(order);

    // ---- Key dates. Past ones are done; a few are deliberately left overdue.
    const ownerId = customer.ownerId ?? owner.id;
    const addDate = (
      kind: string,
      label: string,
      dueAt: Date,
      who: string,
      opts: { canSlip?: boolean; note?: string } = {},
    ) => {
      const past = dueAt < NOW;
      const slipped = past && opts.canSlip && chance(0.2);
      orderDates.push({
        orderId: order.id,
        kind,
        label,
        note: opts.note ?? null,
        dueAt,
        doneAt: past && !slipped ? plusHours(dueAt, int(0, 6)) : null,
        ownerId: who,
        createdById: ownerId,
        createdAt: orderedAt,
      });
    };

    if (orderStatus === 'QUOTE') {
      addDate('FOLLOW_UP', 'Chase the quote', atHour(plusDays(orderedAt, 7), 10), ownerId, { canSlip: true });
    } else {
      addDate('SURVEY', 'Site survey', atHour(plusDays(orderedAt, int(4, 9)), 10), ownerId, {
        note: 'Check the base, access and the wall if wall mounted.',
      });
      if (deliveryDue) {
        addDate('PAYMENT', 'Balance due before delivery', atHour(plusDays(deliveryDue, -7), 12), nextCareAgent(), { canSlip: true });
        addDate('DELIVERY', 'Pallet delivery', deliveryDue, warehouse.id, { note: 'AM slot. Carrier to call 30 minutes before arrival.' });
      }
      if (installAt) {
        addDate('INSTALL', 'Installation', installAt, installer.id, { note: 'Two fitters, full day.' });
      } else if (deliveryDue) {
        addDate('INSTALL', 'Installation — provisional', atHour(plusDays(deliveryDue, int(3, 8)), 8), installer.id);
      }
      if (installedAt) {
        addDate('FOLLOW_UP', 'Aftercare call — how is it going?', atHour(plusDays(installedAt, 14), 14), nextCareAgent(), { canSlip: true });
      }
    }

    // ---- A few notes against the order, so its timeline reads like a real one.
    for (let n = int(0, 3); n > 0; n -= 1) {
      const note = pick(ORDER_NOTES);
      const span = Math.max(1, NOW.getTime() - orderedAt.getTime());
      orderNotes.push({
        type: note.type,
        direction: note.direction,
        summary: note.summary,
        body: note.body ?? null,
        customerId: customer.id,
        orderId: order.id,
        userId: ownerId,
        sourceSystem: note.type === 'CALL' ? 'AIRCALL' : note.type === 'EMAIL' ? 'EMAIL' : 'CRM',
        durationSec: note.type === 'CALL' ? int(90, 600) : null,
        occurredAt: duringOpeningHours(new Date(orderedAt.getTime() + rand() * span)),
      });
    }
    orderNotes.push({
      type: 'STATUS_CHANGE',
      summary: `Order ${order.ref} placed — ${product.name}`,
      customerId: customer.id,
      orderId: order.id,
      userId: ownerId,
      sourceSystem: 'CRM',
      occurredAt: orderedAt,
    });
  }

  await db.orderDate.createMany({ data: orderDates });
  await db.activity.createMany({ data: orderNotes });

  // ---- Cases -------------------------------------------------------------
  console.log('Creating cases, tasks and parts orders…');
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
    const channel = pick(['PHONE', 'PHONE', 'CHAT', 'EMAIL', 'EMAIL', 'WHATSAPP', 'SOCIAL'] as const);
    // Customers write whenever they like; calls and chats reach us in opening hours.
    const arrived = resolvedCase ? daysAgo(int(1, 28)) : hoursAgo(int(1, 90));
    const openedAt = channel === 'PHONE' || channel === 'CHAT' ? duringOpeningHours(arrived) : arrived;
    const status = resolvedCase
      ? pick(['RESOLVED', 'CLOSED', 'CLOSED'] as const)
      : pick(['NEW', 'NEW', 'OPEN', 'OPEN', 'OPEN', 'WAITING_CUSTOMER', 'WAITING_SUPPLIER'] as const);

    const assignee = status === 'NEW' && chance(0.35) ? null : pick(category === 'SALES_ENQUIRY' ? salesAgents : careAgents);

    // First response lands inside SLA most of the time — but not always. It
    // happens on a working day, and never later than now.
    const respondedMinutes = chance(0.78) ? int(5, Math.max(10, slaMinutes - 20)) : slaMinutes + int(20, 600);
    const respondedAt = new Date(openedAt.getTime() + respondedMinutes * 60000);
    let firstResponseAt: Date | null = null;
    if (status !== 'NEW') {
      const shifted = onWorkingDay(respondedAt);
      firstResponseAt = shifted < openedAt ? respondedAt : shifted;
      if (firstResponseAt > NOW) {
        firstResponseAt = new Date(Math.max(openedAt.getTime() + 60000, NOW.getTime() - int(5, 30) * 60000));
      }
    }
    let resolvedAt: Date | null = null;
    if (resolvedCase && firstResponseAt) {
      const planned = new Date(openedAt.getTime() + int(respondedMinutes + 30, respondedMinutes + 4000) * 60000);
      const earliest = firstResponseAt.getTime() + 60000;
      resolvedAt = new Date(Math.max(earliest, Math.min(planned.getTime(), NOW.getTime() - 10 * 60000)));
    }

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
          waitSec: channel === 'PHONE' ? null : Math.round((firstResponseAt.getTime() - openedAt.getTime()) / 1000),
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
    const customerOrder = orders.find((o) => o.customerId === customerId);
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
        // Install and dispatch work hangs off the order it is for.
        orderId: ['INSTALL', 'DISPATCH', 'ADMIN'].includes(tpl.category) ? customerOrder?.id ?? null : null,
        dueAt,
        startedAt: status === 'TODO' ? null : new Date(createdAt.getTime() + int(1, 40) * 3600_000),
        completedAt: done ? new Date(createdAt.getTime() + int(2, 90) * 3600_000) : null,
        blockedNote: status === 'BLOCKED' ? pick(['Waiting on supplier ETA for the replacement blade.', 'Customer not answering — third attempt made.', 'Needs manager approval before we can ship free of charge.']) : null,
        position: i,
        createdAt,
      },
    });
  }

  // ---- Parts orders, each generating its warehouse dispatch ---------------
  type StockEvent = { partId: string; at: Date; change: number; reason: string; ref: string; note?: string; userId: string };
  const stockEvents: StockEvent[] = [];

  const REASONS: Record<string, string[]> = {
    WARRANTY: [
      'Shortfall against the packing list — confirmed by the installer on site.',
      'Warranty replacement, photos on the case.',
      'Transit damage noted on the delivery note.',
    ],
    GOODWILL: ['Goodwill replacement agreed by the team lead.', 'Out of warranty, replaced free as a gesture — long-standing customer.'],
    CHARGEABLE: ['Customer buying a spare remote handset.', 'Replacement after accidental damage — chargeable.', 'Adding a windproof blind to an existing pergola.', 'Spare LED strip for the second pergola.'],
  };

  const partsTickets = tickets.filter((t) => ['MISSING_PARTS', 'DAMAGE', 'WARRANTY'].includes(t.category));
  let dispatchNo = 3060;
  let partsOrderNo = 5000;

  for (let i = 0; i < 26; i += 1) {
    // The first two are paid-for spares still waiting on the customer's payment,
    // so the "mark as paid" hand-off to the warehouse has something to show.
    const awaitingPayment = i < 2;
    const billing = awaitingPayment || chance(0.25) ? 'CHARGEABLE' : chance(0.2) ? 'GOODWILL' : 'WARRANTY';
    const ticket = partsTickets.length ? pick(partsTickets) : pick(tickets);
    const customer = customers.find((c) => c.id === ticket.customerId)!;
    const order = orders.find((o) => o.customerId === customer.id);
    const requester = pick(careAgents);

    const status = awaitingPayment
      ? 'REQUESTED'
      : pick([
          'REQUESTED', 'REQUESTED', 'APPROVED', 'APPROVED', 'PICKING',
          'AWAITING_STOCK', 'DISPATCHED', 'DISPATCHED', 'DELIVERED', 'DELIVERED',
        ] as const);
    const requestedAt = awaitingPayment ? hoursAgo(int(3, 30)) : daysAgo(int(0, 18));
    const dispatched = ['DISPATCHED', 'DELIVERED'].includes(status);
    const dispatchedAt = dispatched ? new Date(requestedAt.getTime() + int(6, 90) * 3600_000) : null;
    // Stock leaves the shelf when picking starts. Short-on-stock here means the
    // warehouse found the gap before picking, so nothing was taken.
    const picked = ['PICKING', 'DISPATCHED', 'DELIVERED'].includes(status);
    const pickedAt = picked
      ? dispatchedAt
        ? new Date(Math.max(requestedAt.getTime() + 3600_000, dispatchedAt.getTime() - int(1, 5) * 3600_000))
        : plusHours(requestedAt, int(2, 20))
      : null;

    // Chargeable orders are only released to the warehouse once paid.
    const paid = billing === 'CHARGEABLE' && status !== 'REQUESTED';
    const paymentStatus = billing !== 'CHARGEABLE' ? 'NOT_REQUIRED' : paid ? 'PAID' : 'AWAITING';

    const lines: { part: Part; qty: number }[] = [];
    for (let l = int(1, 3); l > 0; l -= 1) {
      const part = pick(parts);
      if (lines.some((x) => x.part.id === part.id)) continue;
      lines.push({ part, qty: billing === 'CHARGEABLE' ? int(1, 2) : int(1, 3) });
    }

    dispatchNo += int(1, 3);
    partsOrderNo += int(1, 2);
    const dspRef = `DSP-${dispatchNo}`;
    const spRef = `SP-${partsOrderNo}`;
    const reason = pick(REASONS[billing]!);

    const request = await db.partRequest.create({
      data: {
        ref: dspRef,
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket.id,
        requestedById: requester.id,
        status,
        priority: pick(['NORMAL', 'NORMAL', 'HIGH', 'HIGH', 'URGENT'] as const),
        reason,
        carrier: dispatched ? pick(['DPD', 'Royal Mail', 'Palletways', 'Parcelforce']) : null,
        trackingRef: dispatched ? `${pick(['DPD', 'RM', 'PW', 'PF'])}${int(10000000, 99999999)}` : null,
        shipToName: customer.name,
        shipToLine1: customer.addressL1,
        shipToCity: customer.city,
        shipToPost: customer.postcode,
        requestedAt,
        dueAt: new Date(requestedAt.getTime() + int(24, 120) * 3600_000),
        pickedAt,
        dispatchedAt,
        deliveredAt: status === 'DELIVERED' && dispatchedAt ? new Date(dispatchedAt.getTime() + int(18, 72) * 3600_000) : null,
        notes: chance(0.4) ? 'Customer has asked for a text before the courier arrives.' : null,
        lines: { create: lines.map((l) => ({ partId: l.part.id, qty: l.qty })) },
      },
    });

    if (pickedAt) {
      for (const l of lines) {
        stockEvents.push({ partId: l.part.id, at: pickedAt, change: -l.qty, reason: 'PICKED', ref: dspRef, userId: warehouse.id });
      }
    }

    const priced = lines.map((l) => ({ qty: l.qty, unitPrice: l.part.unitPrice }));
    const totals = priceOrder({
      lines: priced,
      billing,
      deliveryCharge: billing === 'CHARGEABLE' ? 9.95 : 0,
    });

    const partsOrder = await db.partsOrder.create({
      data: {
        ref: spRef,
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket.id,
        createdById: requester.id,
        billing,
        paymentStatus,
        paymentRef: paid ? pick(['Card — ending 4821', 'Card — ending 0937', 'BACS — HP' + int(1000, 9999)]) : null,
        ...totals,
        shipToName: customer.name,
        shipToLine1: customer.addressL1,
        shipToCity: customer.city,
        shipToPost: customer.postcode,
        customerNote: billing === 'CHARGEABLE' ? null : 'Supplied free of charge under your Hygge Pergola warranty.',
        internalNote: reason,
        placedAt: requestedAt,
        paidAt: paid ? plusHours(requestedAt, int(0, 20)) : null,
        dispatchId: request.id,
        lines: {
          create: lines.map((l) => ({
            partId: l.part.id,
            sku: l.part.sku,
            description: l.part.name,
            qty: l.qty,
            unitPrice: l.part.unitPrice,
            lineTotal: lineTotal({ qty: l.qty, unitPrice: l.part.unitPrice }),
          })),
        },
      },
    });

    await db.activity.create({
      data: {
        type: 'DISPATCH',
        summary: `Parts order ${spRef} placed by ${requester.name} — ${
          billing === 'CHARGEABLE' ? `£${totals.total.toFixed(2)}` : `no charge (${billing.toLowerCase()})`
        }`,
        body: reason,
        customerId: customer.id,
        ticketId: ticket.id,
        orderId: order?.id ?? null,
        partRequestId: request.id,
        partsOrderId: partsOrder.id,
        userId: requester.id,
        sourceSystem: 'CRM',
        occurredAt: requestedAt,
      },
    });

    if (dispatchedAt) {
      await db.activity.create({
        data: {
          type: 'DISPATCH',
          summary: `Parts dispatched via ${request.carrier} (${request.trackingRef})`,
          body: 'Tracking sent to the customer by email and logged against the case.',
          customerId: customer.id,
          ticketId: ticket.id,
          orderId: order?.id ?? null,
          partRequestId: request.id,
          partsOrderId: partsOrder.id,
          userId: warehouse.id,
          sourceSystem: 'CRM',
          occurredAt: dispatchedAt,
        },
      });
    }
  }

  // ---- Purchasing ----------------------------------------------------------
  console.log('Creating purchase orders and the stock ledger…');
  const PURCHASES = [
    { ref: 'PUR-1001', supplier: NORTHGATE, status: 'RECEIVED', created: 34, sent: 33, expected: 19, received: 20, lines: [['HP-LVR-3000-GY', 30], ['HP-CAP-POST-GY', 40], ['HP-BM-3000-GY', 6]] },
    { ref: 'PUR-1002', supplier: LUMENLINE, status: 'RECEIVED', created: 21, sent: 21, expected: 8, received: 9, lines: [['HP-LED-STRIP-3M', 20], ['HP-LED-PSU', 10]] },
    { ref: 'PUR-1003', supplier: NORTHGATE, status: 'SENT', created: 7, sent: 6, expected: -15, received: null, lines: [['HP-LVR-4000-WH', 30], ['HP-PST-2500-WH', 10]] },
    { ref: 'PUR-1004', supplier: LUMENLINE, status: 'SENT', created: 3, sent: 2, expected: -8, received: null, lines: [['HP-LED-REMOTE', 30]] },
    { ref: 'PUR-1005', supplier: WEATHERSCREEN, status: 'DRAFT', created: 0.2, sent: null, expected: null, received: null, lines: [['HP-BLD-4000-GY', 6], ['HP-BLD-CRANK', 25]] },
  ] as const;

  for (const po of PURCHASES) {
    const lines = po.lines.map(([sku, qty]) => ({ part: partBySku(sku), qty }));
    const receivedAt = po.received === null ? null : atHour(daysAgo(po.received), 11);
    await db.purchaseOrder.create({
      data: {
        ref: po.ref,
        supplier: po.supplier,
        status: po.status,
        total: lines.reduce((s, l) => s + l.qty * l.part.unitCost, 0),
        createdById: warehouse.id,
        createdAt: daysAgo(po.created),
        sentAt: po.sent === null ? null : daysAgo(po.sent),
        expectedAt: po.expected === null ? null : atHour(daysAgo(po.expected), 12),
        receivedAt,
        notes: po.status === 'SENT' ? 'Confirmed by the supplier — delivery to the Leeds unit, goods-in door 2.' : null,
        lines: { create: lines.map((l) => ({ partId: l.part.id, qty: l.qty, unitCost: l.part.unitCost })) },
      },
    });
    if (receivedAt) {
      for (const l of lines) {
        stockEvents.push({ partId: l.part.id, at: receivedAt, change: l.qty, reason: 'RECEIVED', ref: po.ref, userId: warehouse.id });
      }
    }
  }

  // ---- The stock ledger ----------------------------------------------------
  // Replay every pick and delivery from an opening count, so the level on each
  // part is exactly explained by its history.
  const moves: Prisma.StockMoveCreateManyInput[] = [];
  const openingAt = atHour(daysAgo(40), 8);
  for (const def of PARTS) {
    const part = partBySku(def.sku);
    const events = stockEvents
      .filter((e) => e.partId === part.id)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    let opening = def.stock - events.reduce((s, e) => s + e.change, 0);
    // Never let the replay dip below zero — top up the opening count instead.
    let running = opening;
    let lowest = opening;
    for (const e of events) {
      running += e.change;
      lowest = Math.min(lowest, running);
    }
    if (lowest < 0) opening -= lowest;
    opening = Math.max(0, opening);

    let balance = opening;
    moves.push({ partId: part.id, change: opening, balance, reason: 'STOCK_TAKE', note: 'Opening count when stock moved into the CRM', userId: warehouse.id, createdAt: openingAt });
    for (const e of events) {
      balance += e.change;
      moves.push({ partId: part.id, change: e.change, balance, reason: e.reason, ref: e.ref, note: e.note ?? null, userId: e.userId, createdAt: e.at });
    }
    await db.part.update({ where: { id: part.id }, data: { stockQty: balance } });
  }
  await db.stockMove.createMany({ data: moves });

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
      body: 'We are down to six 4.0m matt white blades with the next container three weeks out. Before you promise a dispatch date on a white pergola, check the inventory and flag it to Karolina.',
      category: 'URGENT',
      author: ruth,
      pinned: true,
      publishedAt: daysAgo(1),
    },
    {
      title: 'Spare parts are now ordered, priced and invoiced in one place',
      body: 'Use Parts orders for anything going out to a customer — warranty, goodwill or paid. Pick the parts (or pull them straight from the pergola’s bill of materials), and the order confirmation and the warehouse dispatch are created together.\n\nChargeable orders are released to the warehouse as soon as they are marked paid. No more emailing Karolina a list.',
      category: 'PROCESS',
      author: ruth,
      pinned: false,
      publishedAt: hoursAgo(20),
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
      body: 'Care can see install dates directly on the order record, so we can stop pinging Installations on Slack to ask. If a date needs moving, change it on the order’s key dates and it lands in Dean’s list.',
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
      body: 'The Prestige Series opens to 135 degrees and lands in the configurator next month. Sales briefing is Thursday at 9am; the bill of materials is already in the inventory.',
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
        occurredAt: duringOpeningHours(hoursAgo(int(2, 600))),
      },
    });
  }

  // ---- Ninety days of calls, chats and emails -------------------------------
  // What Aircall, tawk.to and the shared inbox would have fed in: every contact
  // with its channel, direction, outcome, length and wait. Most callers are not
  // matched to a customer record, exactly as in real life.
  console.log('Creating 90 days of calls, chats and emails…');
  const contacts: Prisma.ActivityCreateManyInput[] = [];
  const at = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, int(0, 59), int(0, 59), 0);
    return d;
  };
  const maybeCustomer = () => (chance(0.05) ? pick(customers).id : null);
  const WEEKDAY_FACTOR = [0, 1.2, 1.08, 1, 0.98, 0.88, 0];

  // A few days more than the longest report window, so its first week is whole.
  const HISTORY_DAYS = 95;
  for (let d = HISTORY_DAYS - 1; d >= 0; d -= 1) {
    const day = new Date(NOW);
    day.setDate(day.getDate() - d);
    day.setHours(0, 0, 0, 0);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    // The season tails off gently from summer into autumn.
    const season = 0.95 + 0.22 * (d / (HISTORY_DAYS - 1));
    const factor = season * WEEKDAY_FACTOR[weekday]!;
    const count = (base: number) => Math.max(0, Math.round(base * factor * (0.72 + rand() * 0.56)));
    const push = (row: Prisma.ActivityCreateManyInput) => {
      if ((row.occurredAt as Date) <= NOW) contacts.push(row);
    };

    let answeredIn = 0;
    let chatsHandled = 0;
    let emailsSent = 0;

    for (const u of users) {
      const p = PROFILES[u.email];
      if (!p || chance(0.045)) continue; // annual leave, training, the odd sick day

      for (let n = count(p.callsIn); n > 0; n -= 1) {
        const hour = pickHour();
        answeredIn += 1;
        push({
          type: 'CALL', direction: 'INBOUND', outcome: 'ANSWERED',
          summary: pick(CALL_IN_SUMMARIES), userId: u.id, customerId: maybeCustomer(),
          sourceSystem: 'AIRCALL', sourceRef: `call_${int(1000000, 9999999)}`,
          durationSec: Math.max(30, Math.round(p.callMins * 60 * (0.35 + rand() * 1.3))),
          waitSec: int(5, 55) + (PEAK_HOURS.has(hour) ? int(0, 70) : 0),
          occurredAt: at(day, hour),
        });
      }
      for (let n = count(p.callsOut); n > 0; n -= 1) {
        const reached = chance(0.8);
        push({
          type: 'CALL', direction: 'OUTBOUND', outcome: reached ? 'ANSWERED' : 'VOICEMAIL',
          summary: reached ? pick(CALL_OUT_SUMMARIES) : 'Outbound call — no answer, left a voicemail',
          userId: u.id, customerId: maybeCustomer(),
          sourceSystem: 'AIRCALL', sourceRef: `call_${int(1000000, 9999999)}`,
          durationSec: reached ? Math.max(30, Math.round(p.callMins * 60 * (0.3 + rand() * 0.9))) : int(15, 45),
          occurredAt: at(day, pickHour()),
        });
      }
      for (let n = count(p.chats); n > 0; n -= 1) {
        const hour = pickHour();
        chatsHandled += 1;
        push({
          type: 'CHAT', direction: 'INBOUND', outcome: 'ANSWERED',
          summary: pick(CHAT_SUMMARIES), userId: u.id, customerId: maybeCustomer(),
          sourceSystem: 'TAWK', sourceRef: `chat_${int(100000, 999999)}`,
          durationSec: int(3, 16) * 60 + int(0, 59),
          waitSec: int(8, 70) + (PEAK_HOURS.has(hour) ? int(0, 60) : 0),
          occurredAt: at(day, hour),
        });
      }
      for (let n = count(p.emails); n > 0; n -= 1) {
        emailsSent += 1;
        push({
          type: 'EMAIL', direction: 'OUTBOUND',
          summary: pick(EMAIL_OUT_SUMMARIES), userId: u.id, customerId: maybeCustomer(),
          sourceSystem: 'EMAIL', sourceRef: `msg_${int(100000, 999999)}`,
          waitSec: Math.round(p.replyMins * 60 * (0.2 + rand() * 1.6)),
          occurredAt: at(day, pickHour()),
        });
      }
    }

    // Contacts nobody picked up — these belong to the team, not to a person.
    const missRate = 0.045 + rand() * 0.06;
    const missedCalls = Math.round((answeredIn * missRate) / (1 - missRate));
    for (let n = missedCalls; n > 0; n -= 1) {
      const hour = chance(0.6) ? pick([10, 11, 14]) : pickHour();
      push({
        type: 'CALL', direction: 'INBOUND', outcome: 'MISSED',
        summary: 'Missed call — caller hung up in the queue', userId: null, customerId: maybeCustomer(),
        sourceSystem: 'AIRCALL', sourceRef: `call_${int(1000000, 9999999)}`,
        waitSec: int(25, 190), occurredAt: at(day, hour),
      });
    }
    const missedChats = Math.round(chatsHandled * (0.025 + rand() * 0.04));
    for (let n = missedChats; n > 0; n -= 1) {
      push({
        type: 'CHAT', direction: 'INBOUND', outcome: 'MISSED',
        summary: 'Live chat — visitor left before anyone answered', userId: null, customerId: null,
        sourceSystem: 'TAWK', sourceRef: `chat_${int(100000, 999999)}`,
        waitSec: int(60, 300), occurredAt: at(day, pickHour()),
      });
    }
    for (let n = Math.round(emailsSent * (1 + rand() * 0.25)); n > 0; n -= 1) {
      push({
        type: 'EMAIL', direction: 'INBOUND',
        summary: pick(EMAIL_IN_SUMMARIES), userId: null, customerId: maybeCustomer(),
        sourceSystem: 'EMAIL', sourceRef: `msg_${int(100000, 999999)}`,
        occurredAt: at(day, chance(0.2) ? pick([7, 18, 19, 21]) : pickHour()),
      });
    }
  }

  for (let i = 0; i < contacts.length; i += 1000) {
    await db.activity.createMany({ data: contacts.slice(i, i + 1000) });
  }

  const counts = {
    users: await db.user.count(),
    customers: await db.customer.count(),
    orders: await db.order.count(),
    keyDates: await db.orderDate.count(),
    cases: await db.ticket.count(),
    tasks: await db.task.count(),
    products: await db.product.count(),
    parts: await db.part.count(),
    partsOrders: await db.partsOrder.count(),
    dispatches: await db.partRequest.count(),
    purchaseOrders: await db.purchaseOrder.count(),
    stockMoves: await db.stockMove.count(),
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
