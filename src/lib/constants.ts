/**
 * Every status value in the portal is declared once, here, together with the
 * label agents see and the tone it is painted in. This is what stops the
 * "nobody knows what's actioned" problem: a status can only be one of these,
 * and it always looks the same wherever it appears.
 */

export type Tone =
  | 'ember'
  | 'moss'
  | 'sky'
  | 'amber'
  | 'clay'
  | 'slate'
  | 'anthracite';

export type StatusMeta<T extends string> = Record<
  T,
  { label: string; tone: Tone; hint?: string }
>;

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

export const ROLES = ['AGENT', 'TEAM_LEAD', 'MANAGER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: StatusMeta<Role> = {
  AGENT: { label: 'Agent', tone: 'slate' },
  TEAM_LEAD: { label: 'Team lead', tone: 'sky' },
  MANAGER: { label: 'Manager', tone: 'ember' },
  ADMIN: { label: 'Admin', tone: 'anthracite' },
};

/** Roles allowed to see company-wide performance and manage announcements. */
export const MANAGEMENT_ROLES: Role[] = ['TEAM_LEAD', 'MANAGER', 'ADMIN'];

export const TEAMS = [
  'Sales',
  'Customer Care',
  'Installations',
  'Warehouse',
] as const;
export type Team = (typeof TEAMS)[number];

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export const CUSTOMER_STAGES = [
  'LEAD',
  'QUOTED',
  'WON',
  'IN_PRODUCTION',
  'INSTALLED',
  'AFTERCARE',
  'LOST',
] as const;
export type CustomerStage = (typeof CUSTOMER_STAGES)[number];

export const CUSTOMER_STAGE_META: StatusMeta<CustomerStage> = {
  LEAD: { label: 'Lead', tone: 'slate' },
  QUOTED: { label: 'Quoted', tone: 'sky' },
  WON: { label: 'Won', tone: 'ember' },
  IN_PRODUCTION: { label: 'In production', tone: 'amber' },
  INSTALLED: { label: 'Installed', tone: 'moss' },
  AFTERCARE: { label: 'Aftercare', tone: 'moss' },
  LOST: { label: 'Lost', tone: 'clay' },
};

export const SOURCES = [
  'WEBSITE',
  'AIRCALL',
  'TAWK',
  'REFERRAL',
  'SHOWROOM',
  'SOCIAL',
  'TRADE',
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_META: StatusMeta<Source> = {
  WEBSITE: { label: 'Website', tone: 'slate' },
  AIRCALL: { label: 'Aircall', tone: 'sky' },
  TAWK: { label: 'Live chat', tone: 'ember' },
  REFERRAL: { label: 'Referral', tone: 'moss' },
  SHOWROOM: { label: 'Showroom', tone: 'amber' },
  SOCIAL: { label: 'Social', tone: 'sky' },
  TRADE: { label: 'Trade', tone: 'anthracite' },
};

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUSES = [
  'QUOTE',
  'DEPOSIT_PAID',
  'IN_PRODUCTION',
  'READY',
  'SCHEDULED',
  'DELIVERED',
  'INSTALLED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: StatusMeta<OrderStatus> = {
  QUOTE: { label: 'Quote sent', tone: 'slate' },
  DEPOSIT_PAID: { label: 'Deposit paid', tone: 'sky' },
  IN_PRODUCTION: { label: 'In production', tone: 'amber' },
  READY: { label: 'Ready to ship', tone: 'ember' },
  SCHEDULED: { label: 'Install booked', tone: 'ember' },
  DELIVERED: { label: 'Delivered', tone: 'moss' },
  INSTALLED: { label: 'Installed', tone: 'moss' },
  CANCELLED: { label: 'Cancelled', tone: 'clay' },
};

export const PERGOLA_COLOURS = ['MATT_GREY', 'MATT_WHITE'] as const;
export type PergolaColour = (typeof PERGOLA_COLOURS)[number];
export const PERGOLA_COLOUR_META: Record<PergolaColour, { label: string; swatch: string }> = {
  MATT_GREY: { label: 'Matt grey', swatch: '#3B4448' },
  MATT_WHITE: { label: 'Matt white', swatch: '#F3F1ED' },
};

/** Order statuses where the order is still being worked towards installation. */
export const ORDER_ACTIVE_STATUSES: OrderStatus[] = [
  'DEPOSIT_PAID',
  'IN_PRODUCTION',
  'READY',
  'SCHEDULED',
  'DELIVERED',
];

export const ORDER_DATE_KINDS = [
  'SURVEY',
  'DELIVERY',
  'INSTALL',
  'PAYMENT',
  'FOLLOW_UP',
  'OTHER',
] as const;
export type OrderDateKind = (typeof ORDER_DATE_KINDS)[number];

export const ORDER_DATE_META: StatusMeta<OrderDateKind> = {
  SURVEY: { label: 'Site survey', tone: 'slate' },
  DELIVERY: { label: 'Delivery', tone: 'sky' },
  INSTALL: { label: 'Installation', tone: 'ember' },
  PAYMENT: { label: 'Payment due', tone: 'amber' },
  FOLLOW_UP: { label: 'Follow-up', tone: 'moss' },
  OTHER: { label: 'Other', tone: 'anthracite' },
};

/* -------------------------------------------------------------------------- */
/* Cases                                                                      */
/* -------------------------------------------------------------------------- */

export const TICKET_STATUSES = [
  'NEW',
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_SUPPLIER',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_META: StatusMeta<TicketStatus> = {
  NEW: { label: 'Needs action', tone: 'clay', hint: 'Nobody has touched this yet' },
  OPEN: { label: 'In progress', tone: 'ember', hint: 'Being worked on right now' },
  WAITING_CUSTOMER: { label: 'Waiting on customer', tone: 'amber', hint: 'Ball is in their court' },
  WAITING_SUPPLIER: { label: 'Waiting on supplier', tone: 'sky', hint: 'Blocked outside the team' },
  RESOLVED: { label: 'Resolved', tone: 'moss', hint: 'Fixed — pending close' },
  CLOSED: { label: 'Closed', tone: 'slate', hint: 'Done and filed' },
};

/** Statuses that still need somebody to do something. */
export const TICKET_ACTIVE_STATUSES: TicketStatus[] = [
  'NEW',
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_SUPPLIER',
];

/** Statuses where the clock is on us, not on somebody else. */
export const TICKET_ON_US_STATUSES: TicketStatus[] = ['NEW', 'OPEN'];

export const TICKET_CHANNELS = [
  'PHONE',
  'CHAT',
  'EMAIL',
  'WHATSAPP',
  'SOCIAL',
  'INTERNAL',
] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const TICKET_CHANNEL_META: StatusMeta<TicketChannel> = {
  PHONE: { label: 'Phone (Aircall)', tone: 'sky' },
  CHAT: { label: 'Live chat (tawk)', tone: 'ember' },
  EMAIL: { label: 'Email', tone: 'slate' },
  WHATSAPP: { label: 'WhatsApp', tone: 'moss' },
  SOCIAL: { label: 'Social', tone: 'amber' },
  INTERNAL: { label: 'Internal', tone: 'anthracite' },
};

export const TICKET_CATEGORIES = [
  'WARRANTY',
  'MISSING_PARTS',
  'DAMAGE',
  'INSTALL_SUPPORT',
  'DELIVERY',
  'SALES_ENQUIRY',
  'BILLING',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_META: StatusMeta<TicketCategory> = {
  WARRANTY: { label: 'Warranty', tone: 'sky' },
  MISSING_PARTS: { label: 'Missing parts', tone: 'ember' },
  DAMAGE: { label: 'Damage', tone: 'clay' },
  INSTALL_SUPPORT: { label: 'Install support', tone: 'amber' },
  DELIVERY: { label: 'Delivery', tone: 'slate' },
  SALES_ENQUIRY: { label: 'Sales enquiry', tone: 'moss' },
  BILLING: { label: 'Billing', tone: 'anthracite' },
  OTHER: { label: 'Other', tone: 'slate' },
};

/* -------------------------------------------------------------------------- */
/* Priority — shared by cases, tasks and dispatches                           */
/* -------------------------------------------------------------------------- */

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: StatusMeta<Priority> = {
  LOW: { label: 'Low', tone: 'slate' },
  NORMAL: { label: 'Normal', tone: 'sky' },
  HIGH: { label: 'High', tone: 'amber' },
  URGENT: { label: 'Urgent', tone: 'clay' },
};

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/** Default SLA in minutes, by priority. Drives the due date on new cases. */
export const SLA_MINUTES: Record<Priority, number> = {
  URGENT: 60,
  HIGH: 240,
  NORMAL: 8 * 60,
  LOW: 24 * 60,
};

/* -------------------------------------------------------------------------- */
/* Tasks — the Trello replacement                                             */
/* -------------------------------------------------------------------------- */

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'AWAITING_OTHERS',
  'DONE',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_META: StatusMeta<TaskStatus> = {
  TODO: { label: 'To action', tone: 'clay', hint: 'Not started — needs picking up' },
  IN_PROGRESS: { label: 'Actioning', tone: 'ember', hint: 'Someone is on it now' },
  BLOCKED: { label: 'Blocked', tone: 'amber', hint: 'Cannot progress — reason required' },
  AWAITING_OTHERS: { label: 'Awaiting others', tone: 'sky', hint: 'Handed off, waiting on a reply' },
  DONE: { label: 'Actioned', tone: 'moss', hint: 'Finished and evidenced' },
};

/** The board columns, left to right. */
export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'AWAITING_OTHERS',
  'DONE',
];

export const TASK_CATEGORIES = [
  'CALLBACK',
  'ADMIN',
  'DISPATCH',
  'INSTALL',
  'SALES',
  'ESCALATION',
  'SUPPLIER',
  'OTHER',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_META: StatusMeta<TaskCategory> = {
  CALLBACK: { label: 'Callback', tone: 'sky' },
  ADMIN: { label: 'Admin', tone: 'slate' },
  DISPATCH: { label: 'Dispatch', tone: 'ember' },
  INSTALL: { label: 'Install', tone: 'amber' },
  SALES: { label: 'Sales', tone: 'moss' },
  ESCALATION: { label: 'Escalation', tone: 'clay' },
  SUPPLIER: { label: 'Supplier', tone: 'anthracite' },
  OTHER: { label: 'Other', tone: 'slate' },
};

/* -------------------------------------------------------------------------- */
/* Parts dispatch                                                             */
/* -------------------------------------------------------------------------- */

export const DISPATCH_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'PICKING',
  'AWAITING_STOCK',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const DISPATCH_STATUS_META: StatusMeta<DispatchStatus> = {
  REQUESTED: { label: 'Requested', tone: 'clay', hint: 'Waiting for a manager to approve' },
  APPROVED: { label: 'Approved', tone: 'ember', hint: 'Cleared — warehouse to pick' },
  PICKING: { label: 'Picking', tone: 'amber', hint: 'Being picked and packed' },
  AWAITING_STOCK: { label: 'Awaiting stock', tone: 'sky', hint: 'Short — on order from supplier' },
  DISPATCHED: { label: 'Dispatched', tone: 'moss', hint: 'On its way to the customer' },
  DELIVERED: { label: 'Delivered', tone: 'moss', hint: 'Confirmed received' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

/** Dispatches still needing warehouse or manager action. */
export const DISPATCH_OPEN_STATUSES: DispatchStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PICKING',
  'AWAITING_STOCK',
];

export const DISPATCH_BOARD_COLUMNS: DispatchStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PICKING',
  'AWAITING_STOCK',
  'DISPATCHED',
  'DELIVERED',
];

export const CARRIERS = ['DPD', 'Royal Mail', 'Palletways', 'Parcelforce', 'Own van'] as const;

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

export const PART_CATEGORIES = [
  'LOUVRE',
  'STRUCTURE',
  'FIXING',
  'MOTOR',
  'LED',
  'BLIND',
  'GASKET',
  'SPARE',
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

/** Catalogue order — the way a pergola goes together, not the alphabet. */
export const partCategoryRank = (category: string) => {
  const i = (PART_CATEGORIES as readonly string[]).indexOf(category);
  return i === -1 ? PART_CATEGORIES.length : i;
};

export const byCatalogueOrder = <T extends { category: string; name: string }>(a: T, b: T) =>
  partCategoryRank(a.category) - partCategoryRank(b.category) || a.name.localeCompare(b.name);

export const PART_CATEGORY_META: StatusMeta<PartCategory> = {
  LOUVRE: { label: 'Louvres', tone: 'anthracite' },
  STRUCTURE: { label: 'Posts & beams', tone: 'slate' },
  FIXING: { label: 'Fixings', tone: 'slate' },
  MOTOR: { label: 'Motors & control', tone: 'sky' },
  LED: { label: 'Lighting', tone: 'amber' },
  BLIND: { label: 'Blinds', tone: 'moss' },
  GASKET: { label: 'Seals & gaskets', tone: 'slate' },
  SPARE: { label: 'Other spares', tone: 'slate' },
};

export const STOCK_MOVE_REASONS = [
  'PICKED',
  'RECEIVED',
  'RETURNED',
  'ADJUSTMENT',
  'STOCK_TAKE',
] as const;
export type StockMoveReason = (typeof STOCK_MOVE_REASONS)[number];

export const STOCK_MOVE_META: StatusMeta<StockMoveReason> = {
  PICKED: { label: 'Picked for dispatch', tone: 'ember' },
  RECEIVED: { label: 'Received from supplier', tone: 'moss' },
  RETURNED: { label: 'Returned to shelf', tone: 'sky' },
  ADJUSTMENT: { label: 'Manual adjustment', tone: 'amber' },
  STOCK_TAKE: { label: 'Stock take', tone: 'slate' },
};

/** Reasons a person can pick when correcting stock by hand. */
export const MANUAL_STOCK_REASONS: StockMoveReason[] = ['ADJUSTMENT', 'STOCK_TAKE', 'RETURNED'];

/* -------------------------------------------------------------------------- */
/* Parts orders — priced orders that generate a dispatch                      */
/* -------------------------------------------------------------------------- */

/** UK standard rate. Parts are priced ex VAT; VAT is added once, at the end. */
export const VAT_RATE = 0.2;

/** Standard courier charge for a parcel of spares, ex VAT. Editable per order. */
export const DEFAULT_PARTS_DELIVERY = 9.95;

export const BILLING_TYPES = ['CHARGEABLE', 'WARRANTY', 'GOODWILL'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const BILLING_META: StatusMeta<BillingType> = {
  CHARGEABLE: { label: 'Chargeable', tone: 'ember', hint: 'The customer pays for these parts' },
  WARRANTY: { label: 'Warranty', tone: 'sky', hint: 'No charge — covered by the warranty' },
  GOODWILL: { label: 'Goodwill', tone: 'moss', hint: 'No charge — agreed as a gesture' },
};

export const PAYMENT_STATUSES = ['AWAITING', 'PAID', 'NOT_REQUIRED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_META: StatusMeta<PaymentStatus> = {
  AWAITING: { label: 'Awaiting payment', tone: 'amber', hint: 'Will not be picked until paid' },
  PAID: { label: 'Paid', tone: 'moss' },
  NOT_REQUIRED: { label: 'No charge', tone: 'slate' },
};

export const PARTS_ORDER_STATUSES = ['PLACED', 'CANCELLED'] as const;
export type PartsOrderStatus = (typeof PARTS_ORDER_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Purchasing                                                                 */
/* -------------------------------------------------------------------------- */

export const PURCHASE_ORDER_STATUSES = ['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_ORDER_STATUS_META: StatusMeta<PurchaseOrderStatus> = {
  DRAFT: { label: 'Draft', tone: 'slate', hint: 'Not yet sent to the supplier' },
  SENT: { label: 'On order', tone: 'sky', hint: 'Sent — waiting for delivery' },
  RECEIVED: { label: 'Received', tone: 'moss', hint: 'Booked into stock' },
  CANCELLED: { label: 'Cancelled', tone: 'clay' },
};

/** Purchase orders still expected to bring stock in. */
export const PURCHASE_OPEN_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'SENT'];

/* -------------------------------------------------------------------------- */
/* Announcements                                                              */
/* -------------------------------------------------------------------------- */

export const ANNOUNCEMENT_CATEGORIES = [
  'COMPANY',
  'PROCESS',
  'PRODUCT',
  'URGENT',
  'CELEBRATION',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORY_META: StatusMeta<AnnouncementCategory> = {
  COMPANY: { label: 'Company', tone: 'anthracite' },
  PROCESS: { label: 'Process change', tone: 'sky' },
  PRODUCT: { label: 'Product', tone: 'ember' },
  URGENT: { label: 'Urgent', tone: 'clay' },
  CELEBRATION: { label: 'Good news', tone: 'moss' },
};

/* -------------------------------------------------------------------------- */
/* Timeline                                                                   */
/* -------------------------------------------------------------------------- */

export const ACTIVITY_TYPES = [
  'CALL',
  'CHAT',
  'EMAIL',
  'SMS',
  'NOTE',
  'STATUS_CHANGE',
  'TASK',
  'DISPATCH',
  'SYSTEM',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_META: StatusMeta<ActivityType> = {
  CALL: { label: 'Call', tone: 'sky' },
  CHAT: { label: 'Live chat', tone: 'ember' },
  EMAIL: { label: 'Email', tone: 'slate' },
  SMS: { label: 'SMS', tone: 'moss' },
  NOTE: { label: 'Note', tone: 'anthracite' },
  STATUS_CHANGE: { label: 'Status change', tone: 'amber' },
  TASK: { label: 'Task', tone: 'ember' },
  DISPATCH: { label: 'Dispatch', tone: 'moss' },
  SYSTEM: { label: 'System', tone: 'slate' },
};

export const SOURCE_SYSTEMS = ['AIRCALL', 'TAWK', 'EMAIL', 'CRM', 'SLACK'] as const;

/** How a call or chat ended. Missed contacts are the ones nobody picked up. */
export const CONTACT_OUTCOMES = ['ANSWERED', 'MISSED', 'VOICEMAIL'] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

/**
 * The three conversation channels the contact report counts, in a fixed order
 * so each one keeps its colour on every chart and in every legend.
 */
export const CONTACT_CHANNELS = ['CALL', 'CHAT', 'EMAIL'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CHANNEL_META: Record<ContactChannel, { label: string; plural: string }> = {
  CALL: { label: 'Call', plural: 'Calls' },
  CHAT: { label: 'Live chat', plural: 'Live chats' },
  EMAIL: { label: 'Email', plural: 'Emails' },
};
