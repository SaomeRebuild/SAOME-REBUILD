/**
 * Smoke test: CardBuilder full flow from scratch
 * 1. Login as tenant
 * 2. Navigate to card builder
 * 3. Build from scratch
 * 4. Fill Step 1 (card type) and Step 2 (store info)
 * 5. Trigger save and capture the API response/error
 *
 * Part 2: Step 3 logo upload flow
 * 1. Login as tenant
 * 2. Open existing card editor (Step 3)
 * 3. Trigger logo upload and capture errors
 */
import { test, expect, type ConsoleMessage } from '@playwright/test';

const TENANT_EMAIL = 'eason1989213@gmail.com';
const TENANT_PASSWORD = 'www123123';

test.describe('CardBuilder: Full Flow + Error Capture', () => {
  test('Step 1 -> Step 2 -> save and capture error', async ({ page }) => {
    test.setTimeout(90_000);

    // Capture console + network
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    const apiRequests: Array<{ method: string; url: string; status?: number; postData?: string }> = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        apiRequests.push({ method: req.method(), url: req.url(), postData: req.postData() ?? undefined });
      }
    });
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/')) {
        const req = apiRequests.find(r => r.url === resp.url() && r.status === undefined);
        if (req) {
          req.status = resp.status();
        }
      }
    });

    // ── 1. Login ────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('[STEP] Logged in as tenant');

    // ── 2. Card builder ─────────────────────────────────────────
    await page.goto('/app/dashboard/card-builder');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('[STEP] On card-builder page');

    // ── 3. Build from scratch ────────────────────────────────────
    const buildBtn = page.getByRole('button', { name: /從頭建置|Build from Scratch/i });
    await expect(buildBtn).toBeVisible({ timeout: 5_000 });
    await buildBtn.click();
    await page.waitForURL(/\?id=/, { timeout: 15_000 });
    console.log('[STEP] Editor opened, id:', new URL(page.url()).searchParams.get('id'));

    // ── 4. Step 1: pick any card type ───────────────────────────
    const cardTypeButtons = page.locator('[class*="grid"] button, [class*="Grid"] button, button[class*="rounded"]').filter({ hasText: /.+/ });
    const firstCard = cardTypeButtons.first();
    if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstCard.click();
      console.log('[STEP] Card type selected');
    }

    // Click Next to go to Step 2
    const nextBtn = page.getByRole('button', { name: /下一步|Next/i });
    if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      console.log('[STEP] Clicked Next -> Step 2');
    }

    await page.waitForTimeout(2_000);

    // ── 5. Fill Step 2 fields ──────────────────────────────────
    // Fill storeName if present
    const storeNameInput = page.locator('input[name*="store"], input[name*="name"], input[placeholder*="名稱"], input[placeholder*="商店"]').first();
    if (await storeNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await storeNameInput.fill('測試商店');
      console.log('[STEP] Filled storeName');
    }

    // Fill issuerName if present
    const issuerInput = page.locator('input[name*="issuer"], input[placeholder*="發卡"]').first();
    if (await issuerInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await issuerInput.fill('測試發卡機構');
      console.log('[STEP] Filled issuerName');
    }

    await page.waitForTimeout(1_000);

    // ── 6. Save / Next (trigger the API call) ───────────────────
    const saveBtn = page.getByRole('button', { name: /儲存|Save|下一步|Next/i }).first();
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('[STEP] Clicked save/next');
    }
    await page.waitForTimeout(5_000);

    // ── 7. Report ───────────────────────────────────────────────
    console.log('\n=== FINAL REPORT ===');
    console.log(`URL: ${page.url()}`);

    // Print API requests
    for (const r of apiRequests) {
      console.log(`API: ${r.method} ${r.url} -> ${r.status ?? 'pending'}`);
      if (r.postData) console.log(`  Body: ${r.postData}`);
    }

    // Print console logs
    console.log('\nConsole logs:');
    for (const l of consoleLogs) {
      if (l.type === 'error' || l.type === 'pageerror' || l.type === 'warn') {
        console.log(`  [${l.type}] ${l.text}`);
      }
    }

    // Look for error messages on the page
    const errorText = await page.locator('[class*="error"], [class*="Error"], .text-destructive').allTextContents();
    if (errorText.length) {
      console.log('\nPage error elements:');
      for (const t of errorText) console.log(`  "${t}"`);
    }

    // Check for toast-like elements
    const toastText = await page.locator('[role="alert"], [class*="toast"], [class*="Toast"]').allTextContents();
    if (toastText.length) {
      console.log('\nToast elements:');
      for (const t of toastText) console.log(`  "${t}"`);
    }
  });
});

test.describe('CardBuilder Step 3: Logo Upload Error Capture', () => {
  test('navigate to Step 3 and trigger logo upload error', async ({ page }) => {
    test.setTimeout(90_000);

    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    const apiRequests: Array<{ method: string; url: string; status?: number; error?: string }> = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        apiRequests.push({ method: req.method(), url: req.url() });
      }
    });
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/') || resp.url().includes('r2.cloudflarestorage')) {
        const req = apiRequests.find(r => r.url === resp.url() && r.status === undefined);
        if (req) {
          req.status = resp.status();
          if (resp.status() >= 400) {
            try {
              req.error = JSON.stringify(await resp.json());
            } catch {
              req.error = await resp.text();
            }
          }
        }
      }
    });

    // ── 1. Login ────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    // Wait for either URL change or network idle (whichever comes first)
    await Promise.race([
      page.waitForURL('**/app/dashboard', { timeout: 15_000 }),
      page.waitForLoadState('networkidle', { timeout: 15_000 }),
    ]);
    await page.waitForTimeout(1_000);
    console.log('[STEP] Logged in, url:', page.url());

    // ── 2. Navigate directly to an existing template in DB ──────────
    // Template: "吃早餐" (id: b9fc0dce-aa82-4c98-9983-55b3d014ead5)
    // It has card_type=membership_card set (Step 1 complete), likely on Step 2 or 3
    const templateId = 'b9fc0dce-aa82-4c98-9983-55b3d014ead5';
    console.log('[STEP] Navigating to existing template:', templateId);
    await page.goto(`/app/dashboard/card-builder?id=${templateId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await page.waitForTimeout(3_000);
    console.log('[URL]', page.url());

    // ── 3. Complete Step 1 and Step 2 to reach Step 3 ──────────────
    // Step 1: select card type
    const cardTypeBtn = page.getByRole('button', { name: /Membership Card/i }).first();
    if (await cardTypeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cardTypeBtn.click();
      console.log('[STEP] Selected Membership Card');
      await page.waitForTimeout(500);
    }

    // Step 1 -> Step 2: click Next
    const nextBtn1 = page.getByRole('button', { name: /Next|下一步/i }).first();
    if (await nextBtn1.isVisible({ timeout: 3_000 }).catch(() => false) && !(await nextBtn1.isDisabled().catch(() => true))) {
      await nextBtn1.click();
      console.log('[STEP] Next -> Step 2');
      await page.waitForTimeout(2_000);
    }

    // Step 2: fill/fiddle a field to trigger DOM value sync, then Next
    // (isStep2Valid reads from DOM querySelector — need to touch inputs first)
    const storeNameInput = page.locator('#storeName').first();
    if (await storeNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await storeNameInput.click();
      await storeNameInput.fill('狐狸早餐店');
      await page.waitForTimeout(500);
      console.log('[STEP] Touched storeName field');
    }

    const nextBtn2 = page.getByRole('button', { name: /Next|下一步/i }).first();
    if (await nextBtn2.isVisible({ timeout: 3_000 }).catch(() => false) && !(await nextBtn2.isDisabled().catch(() => true))) {
      await nextBtn2.click();
      console.log('[STEP] Next -> Step 3 (Issuer Design)');
      await page.waitForTimeout(2_000);
    } else {
      console.log('[WARN] Next button still disabled after touch');
    }

    console.log('[URL after steps]', page.url());

    // ── 4. Find and trigger logo upload ───────────────────────────
    const bodyText2 = await page.locator('body').textContent();
    const hasLogo2 = /標誌|Issuer.*Design|上傳標誌|issuer.*logo/i.test(bodyText2 ?? '');
    console.log('[INFO] Step 3 has logo text:', hasLogo2);

    // Look for file input
    const fileInput = page.locator('input[type="file"]').first();
    const uploadBtn = page.getByRole('button', { name: /上傳|選擇|Select|Upload/i }).first();

    if (await fileInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('[STEP] Found file input, setting image...');
      await fileInput.setInputFiles('C:\\Users\\user\\Desktop\\SAOME-REBUILD\\images.jpg');
      await page.waitForTimeout(3_000);

      const applyBtn = page.getByRole('button', { name: /套用|Apply|確認|Confirm/i }).first();
      if (await applyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await applyBtn.click();
        console.log('[STEP] Clicked apply crop');
        await page.waitForTimeout(5_000);
      }
    } else if (await uploadBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('[STEP] Clicking upload button...');
      await uploadBtn.click();
      await page.waitForTimeout(1_000);
      // After clicking, the hidden file input should be triggered
      const hiddenFileInput = page.locator('input[type="file"]').first();
      if (await hiddenFileInput.count() > 0) {
        await hiddenFileInput.setInputFiles('C:\\Users\\user\\Desktop\\SAOME-REBUILD\\images.jpg');
        console.log('[STEP] Set file via hidden input');
        await page.waitForTimeout(3_000);
        const applyBtn = page.getByRole('button', { name: /套用|Apply|確認|Confirm/i }).first();
        if (await applyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await applyBtn.click();
          console.log('[STEP] Clicked apply crop');
          await page.waitForTimeout(5_000);
        }
      }
    } else {
      // Last resort: find any hidden file input
      const hiddenInputs = await page.locator('input[type="file"]').all();
      console.log(`[INFO] Hidden file inputs found: ${hiddenInputs.length}`);
      for (let i = 0; i < hiddenInputs.length; i++) {
        const isHidden = await hiddenInputs[i].isHidden();
        if (!isHidden) {
          await hiddenInputs[i].setInputFiles('C:\\Users\\user\\Desktop\\SAOME-REBUILD\\images.jpg');
          console.log(`[STEP] Set file via visible file input ${i}`);
          await page.waitForTimeout(3_000);
          break;
        }
      }
    }

    // ── 4. Report ───────────────────────────────────────────────
    console.log('\n=== STEP 3 LOGO UPLOAD REPORT ===');
    console.log(`Final URL: ${page.url()}`);

    console.log('\nAPI Requests:');
    for (const r of apiRequests) {
      console.log(`  ${r.method} ${r.url} -> ${r.status ?? 'pending'}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    }

    console.log('\nConsole errors:');
    for (const l of consoleLogs) {
      if (l.type === 'error' || l.type === 'pageerror') {
        console.log(`  [${l.type}] ${l.text}`);
      }
    }

    // Check for error UI on page
    const errorEl = page.locator('[class*="error"], [class*="Error"], [class*="destructive"]');
    const errorCount = await errorEl.count();
    if (errorCount > 0) {
      console.log(`\nPage error elements (${errorCount}):`);
      for (const el of await errorEl.all()) {
        const text = await el.textContent();
        if (text?.trim()) console.log(`  "${text.trim()}"`);
      }
    }
  });
});
