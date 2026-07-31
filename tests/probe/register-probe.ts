import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log(`[console.${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[pageerror] ${err.message}`);
  });

  console.log('Navigating to http://localhost:5173/register ...');
  try {
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('Page loaded');
  } catch (err) {
    console.log('Navigation error:', err instanceof Error ? err.message : String(err));
  }

  console.log('Current URL:', page.url());
  console.log('Title:', await page.title());

  // Clear localStorage debug log
  await page.evaluate(() => {
    localStorage.removeItem('debug-356a12-log');
    sessionStorage.clear();
  });
  console.log('Cleared localStorage + sessionStorage');

  // Reload to start fresh
  await page.reload({ waitUntil: 'networkidle' });
  console.log('Reloaded');

  await page.waitForTimeout(500);

  // Capture initial state at Step 0 mount
  const initial = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('debug-356a12-log') || '[]');
    return {
      url: window.location.href,
      logCount: log.length,
      log: log.map((e: { ts: number; loc: string; data: unknown }) => ({
        ts: e.ts,
        loc: e.loc,
        data: e.data,
      })),
    };
  });
  console.log('=== INITIAL STATE ===');
  console.log(JSON.stringify(initial, null, 2));

  // Fill Step 1
  console.log('=== Filling Step 1 ===');
  await page.fill('input[name="contactName"]', 'qqq98765');
  await page.fill('input[name="phoneCity"]', '0912345678');
  await page.fill('input[name="address"]', 'some address');
  await page.fill('input[name="taxId"]', '12345678');
  await page.fill('input[name="name"]', 'some company');
  await page.fill('input[name="invoiceAddress"]', 'some invoice address');

  await page.waitForTimeout(200);

  // Click next button
  console.log('=== Clicking next ===');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(1500);

  // Capture Step 2 state
  const step2 = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('debug-356a12-log') || '[]');
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    return {
      url: window.location.href,
      emailValue: emailInput?.value ?? 'NOT_FOUND',
      emailDefaultValue: emailInput?.defaultValue ?? 'NOT_FOUND',
      logCount: log.length,
      log: log.map((e: { ts: number; loc: string; data: unknown }) => ({
        ts: e.ts,
        loc: e.loc,
        data: e.data,
      })),
    };
  });
  console.log('=== STEP 2 STATE ===');
  const step2Focused = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('debug-356a12-log') || '[]');
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    const passwordInput = document.querySelector<HTMLInputElement>('input[name="password"]');
    const step2Snapshots = log
      .filter((e: { loc: string }) => e.loc === 'accountForm-control-snapshot')
      .filter((e: { data: { step: number } }) => e.data.step === 1)
      .map((e: { ts: number; data: unknown }) => ({ ts: e.ts, ...(e.data as object) }));
    const step2Mount = log
      .filter((e: { loc: string }) => e.loc === 'Step2mount')
      .map((e: { ts: number; data: unknown }) => ({ ts: e.ts, ...(e.data as object) }));
    return {
      url: window.location.href,
      emailValue: emailInput?.value ?? 'NOT_FOUND',
      emailDefaultValue: emailInput?.defaultValue ?? 'NOT_FOUND',
      passwordValue: passwordInput?.value ?? 'NOT_FOUND',
      step2SnapshotCount: step2Snapshots.length,
      firstStep2Snapshot: step2Snapshots[0],
      lastStep2Snapshot: step2Snapshots[step2Snapshots.length - 1],
      step2MountCount: step2Mount.length,
      firstStep2Mount: step2Mount[0],
    };
  });
  console.log(JSON.stringify(step2Focused, null, 2));

  // Now simulate user actively typing a real email — proving the fix doesn't
  // block normal input flow.
  await page.fill('input[name="email"]', 'real-user@example.com');
  await page.fill('input[name="password"]', 'SecurePass123');
  await page.fill('input[name="confirmPassword"]', 'SecurePass123');
  await page.waitForTimeout(300);

  const afterTyping = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('debug-356a12-log') || '[]');
    const lastSnap = log
      .filter((e: { loc: string }) => e.loc === 'accountForm-control-snapshot')
      .filter((e: { data: { step: number } }) => e.data.step === 1)
      .slice(-1)[0];
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    return {
      lastSnap: lastSnap ?? null,
      emailValueAfterTyping: emailInput?.value ?? 'NOT_FOUND',
    };
  });
  console.log('=== AFTER TYPING ===');
  console.log(JSON.stringify(afterTyping, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});