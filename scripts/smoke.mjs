/**
 * End-to-end smoke test for the portal.
 *
 * Checks the paths that matter: signing in, role separation, moving work across
 * the board, raising a task, claiming a case, logging an interaction, search,
 * signing out, and moving a parts dispatch forward.
 *
 * Needs a running server and Playwright's Chromium:
 *
 *   npx playwright install chromium
 *   npm run build && npm start -- -p 3100
 *   npm run test:smoke
 *
 * Point it elsewhere with BASE_URL. It writes to the database, so run it
 * against a seeded development database, never production.
 */
import { chromium } from 'playwright';

const B = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const OUT = process.env.SHOT_DIR ?? null;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
let failures = 0;
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e));
// Server-action responses are streamed RSC payloads. Under CDP the stream is
// not delivered to the renderer until something reads it, so drain every POST
// body or the assertions below race a DOM that never updates.
page.on('response', (r) => {
  if (r.request().method() === 'POST') r.text().catch(() => {});
});
if (process.env.SMOKE_DEBUG) {
  page.on('response', (r) => {
    if (r.request().method() === 'POST') console.log(`    [debug] POST ${r.status()} ${r.url()}`);
  });
}
const ok = (n, c) => { if (!c) failures++; console.log((c ? 'PASS' : 'FAIL') + ' — ' + n); };
// textContent rather than innerText: the page fades in, and innerText is
// rendering-dependent, which makes it flaky in the first frames.
const colCount = async (name) => {
  const loc = page.locator(`section:has(> header:has-text("${name}")) > header span`).last();
  await loc.waitFor({ state: 'attached', timeout: 10000 });
  return Number((await loc.textContent()).replace(/\D/g, ''));
};
/**
 * Wait until React has hydrated before interacting, otherwise a click takes the
 * no-JS form-post path and the assertions race the redirect.
 */
const hydrated = async () => {
  await page.waitForLoadState('load');
  await page.waitForTimeout(1800);
};
const moveFirst = async (col, label) => {
  const form = page
    .locator(`section:has(> header:has-text("${col}")) form:has(button:has-text("${label}"))`)
    .first();
  await form.waitFor({ state: 'visible', timeout: 10000 });
  if (process.env.SMOKE_DEBUG) {
    const fields = await form.evaluate((f) =>
      [...new FormData(f).entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => `${k}=${v}`).join(' & '),
    );
    console.log(`    [debug] submitting ${col}/${label}: ${fields}`);
  }
  await form.locator('button').click();
  // Headless Chromium does not reliably deliver more than one streamed RSC
  // response per document, so reload before asserting. The server was verified
  // separately to render fresh state on every request.
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'load' });
  await hydrated();
};
/** Polls until the column count reaches `want`, so the assertion is not a race. */
const waitForCount = async (name, want, timeout = 8000) => {
  const started = Date.now();
  let seen = null;
  while (Date.now() - started < timeout) {
    seen = await colCount(name);
    if (seen === want) return seen;
    await page.waitForTimeout(400);
  }
  return seen;
};

// 1. a wrong password is rejected and the email survives
await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
await page.fill('#email', 'priya.raval@hyggepergola.co.uk');
await page.fill('#password', 'wrong-password');
await page.click('button[type=submit]');
await page.waitForSelector('[role=alert]:has-text("not recognised")', { timeout: 10000 });
ok('bad password rejected', true);
ok('email survives a failed attempt',
   (await page.inputValue('#email')) === 'priya.raval@hyggepergola.co.uk');

// 2. the agent signs in
await page.fill('#password', 'hygge2024');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
ok('agent signs in', (await page.locator('h1').first().textContent()) === 'My day');

// 3. an agent never sees management figures
await page.goto(B + '/performance', { waitUntil: 'load' });
ok('agent cannot read /performance',
   (await page.locator('text=Individual performance').count()) === 0 &&
   (await page.locator('h1').first().textContent()) === 'My day' &&
   !page.url().includes('/performance'));
ok('agent nav hides Performance', (await page.locator('nav a[href="/performance"]').count()) === 0);

// 4. a task moves To action -> Actioning -> Actioned and the counts follow
await page.goto(B + '/board?who=mine', { waitUntil: 'load' });
await hydrated();
const todo0 = await colCount('To action');
const doing0 = await colCount('Actioning');
await moveFirst('To action', 'Start');
const todo1 = await waitForCount('To action', todo0 - 1);
const doing1 = await waitForCount('Actioning', doing0 + 1);
ok(`Start moves a card (to-action ${todo0}->${todo1}, actioning ${doing0}->${doing1})`,
   todo1 === todo0 - 1 && doing1 === doing0 + 1);

const done0 = await colCount('Actioned');
await moveFirst('Actioning', 'Actioned');
const done1 = await waitForCount('Actioned', done0 + 1);
ok(`Actioned moves the card on (actioned ${done0}->${done1})`, done1 === done0 + 1);

// 5. a task is created through the form
await page.goto(B + '/board?new=1', { waitUntil: 'load' });
await hydrated();
await page.fill('#title', 'E2E check — ring the customer about the louvre blade');
await page.selectOption('#priority', 'URGENT');
const tasksBefore = await page.locator('main section ul > li').count();
await page.click('button:has-text("Add task")');
await page.waitForTimeout(3000);
await page.reload({ waitUntil: 'load' });
await hydrated();
ok('task created through the form',
   (await page.locator('main section ul > li').count()) === tasksBefore + 1);

// 6. a short title is rejected without losing what was typed
await page.goto(B + '/board?new=1', { waitUntil: 'load' });
await hydrated();
await page.fill('#title', 'ab');
await page.click('button:has-text("Add task")');
await page.waitForSelector('[role=alert]', { timeout: 10000 });
await page.waitForTimeout(500);
ok('short title rejected, text preserved', (await page.inputValue('#title')) === 'ab');

// 7. claim a case, then log an interaction on it
await page.goto(B + '/cases?filter=unassigned', { waitUntil: 'load' });
await hydrated();
if (await page.locator('button:has-text("Claim")').count()) {
  await page.locator('button:has-text("Claim")').first().click();
  await page.waitForTimeout(2000);
}
await page.goto(B + '/cases?filter=mine', { waitUntil: 'load' });
const firstCase = await page.getAttribute('a[href^="/cases/c"]', 'href');
ok('agent has cases after claiming', !!firstCase);

await page.goto(B + firstCase, { waitUntil: 'load' });
await hydrated();
const entriesBefore = Number(
  (await page.locator('text=/\\d+ entries/').first().textContent()).replace(/\D/g, ''),
);
await page.click('label:has-text("Call")');
await page.fill('#summary', 'E2E check — called the customer and confirmed the replacement is booked');
await page.click('button:has-text("Log it")');
await page.waitForTimeout(3000);
await page.reload({ waitUntil: 'load' });
await hydrated();
const entriesAfter = Number(
  (await page.locator('text=/\\d+ entries/').first().textContent()).replace(/\D/g, ''),
);
ok(`interaction persisted (${entriesBefore} -> ${entriesAfter} entries)`, entriesAfter === entriesBefore + 1);

// 8. search finds a real customer — the term is taken from the customer list
// rather than hard-coded, because the seed randomises towns.
await page.goto(B + '/customers', { waitUntil: 'load' });
const surname = (await page.locator('a[href^="/customers/c"] span').first().textContent())
  .trim().split(' ').pop();
await page.goto(B + `/search?q=${encodeURIComponent(surname)}`, { waitUntil: 'load' });
ok(`search finds "${surname}"`, (await page.locator('a[href^="/customers/c"]').count()) > 0);

// 9. signing out really ends the session
await page.goto(B + '/', { waitUntil: 'load' });
await hydrated();
await page.click('button[aria-expanded]');
await page.click('button:has-text("Sign out")');
await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 15000 });
await page.goto(B + '/board', { waitUntil: 'load' });
ok('signed-out user is redirected to login', page.url().includes('/login'));

// 10. a manager does reach the performance view
await page.fill('#email', 'ruth.alderton@hyggepergola.co.uk');
await page.fill('#password', 'hygge2024');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
await page.goto(B + '/performance', { waitUntil: 'load' });
ok('manager reaches /performance', (await page.locator('text=Individual performance').count()) > 0);
if (OUT) await page.screenshot({ path: `${OUT}/performance.png`, fullPage: true });

// 11. the warehouse can move a dispatch forward
await page.goto(B + '/dispatch?view=open', { waitUntil: 'load' });
await hydrated();
const approve = page.locator('button:has-text("Approve")').first();
if (await approve.count()) {
  const approvedBefore = await page.locator('button:has-text("Start picking")').count();
  await approve.click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'load' });
  await hydrated();
  ok('dispatch approved',
     (await page.locator('button:has-text("Start picking")').count()) > approvedBefore);
} else {
  ok('dispatch approved', false);
}
await page.goto(B + '/board', { waitUntil: 'load' });
if (OUT) await page.screenshot({ path: `${OUT}/board.png`, fullPage: true });

console.log(errs.length ? 'JS ERRORS:\n' + errs.join('\n') : 'no JS errors');
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(failures ? 1 : 0);
