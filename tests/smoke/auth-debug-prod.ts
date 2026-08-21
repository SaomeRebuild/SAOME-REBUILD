import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept ALL requests with full detail
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      const headers = req.headers();
      const auth = headers['authorization'] ?? '(none)';
      console.log(`[REQUEST] ${req.method()} ${req.url().replace('https://saome-backend.josh1989213.workers.dev', '')}`);
      console.log(`  Authorization: ${auth.slice(0, 40)}${auth.length > 40 ? '...' : ''}`);
      console.log(`  Cookie: ${(headers['cookie'] ?? '(none)').slice(0, 40)}...`);
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      const status = res.status();
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      console.log(`${status >= 400 ? '❌' : '✅'} [RESPONSE] ${status} ${res.url().replace('https://saome-backend.josh1989213.workers.dev', '')}`);
      if (status >= 400) console.log(`   Body: ${body}`);
    }
  });

  try {
    // Login
    console.log('\n=== LOGIN ===');
    await page.goto('https://saome-frontend.josh1989213.workers.dev/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill('eason1989213@gmail.com');
    await page.locator('input[type="password"]').fill('www123123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/app/dashboard**', { timeout: 15000 });

    // Check sessionStorage content
    console.log('\n=== SESSION STORAGE ===');
    const ssInfo = await page.evaluate(() => {
      const keys = Object.keys(sessionStorage);
      const data: Record<string, string> = {};
      for (const k of keys) {
        try { data[k] = sessionStorage.getItem(k) ?? ''; } catch { data[k] = '(error)'; }
      }
      return { keys, data };
    });
    console.log('Keys:', JSON.stringify(ssInfo.keys));
    for (const [k, v] of Object.entries(ssInfo.data)) {
      console.log(`  ${k} = ${String(v).slice(0, 50)}...`);
    }

    // Check cookies
    console.log('\n=== COOKIES ===');
    const cookies = await context.cookies();
    for (const c of cookies) {
      console.log(`  ${c.name}=${c.value.slice(0, 30)}... (secure=${c.secure}, sameSite=${c.sameSite}, domain=${c.domain})`);
    }

    // Navigate to card builder
    console.log('\n=== NAVIGATE TO CARD BUILDER ===');
    await page.goto('https://saome-frontend.josh1989213.workers.dev/app/dashboard/card-builder');
    await page.waitForTimeout(2000);

    // Check sessionStorage before button click
    console.log('\n=== SESSION STORAGE BEFORE CLICK ===');
    const ssBefore = await page.evaluate(() => {
      return sessionStorage.getItem('saome.accessToken') ?? 'NULL';
    });
    console.log(`  saome.accessToken = ${ssBefore.slice(0, 50)}...`);

    // Click Build from Scratch
    console.log('\n=== CLICK BUILD FROM SCRATCH ===');
    const buildBtn = page.getByRole('button', { name: /從頭建置/i });
    await buildBtn.click();
    await page.waitForTimeout(5000);
    console.log(`\nFinal URL: ${page.url()}`);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
}

main();
