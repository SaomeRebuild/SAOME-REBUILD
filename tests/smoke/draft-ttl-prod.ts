/**
 * Production smoke test: verify draft TTL feature end-to-end.
 *
 * Flow:
 *  1. Login via POST /api/auth/login → capture Set-Cookie
 *  2. POST /api/cards → create draft → verify expiresAt is ~24h from now
 *  3. PATCH /api/cards/:id/touch → verify expiresAt is reset to ~24h from now
 *  4. POST /api/cards/:id/publish → verify expiresAt becomes null
 *
 * Run: node tests/smoke/draft-ttl-prod.ts
 */

const API_BASE = 'https://saome-backend.josh1989213.workers.dev';
const EMAIL = 'eason1989213@gmail.com';
const PASSWORD = 'www123123';

async function request(method, path, { body, cookie, fetchImpl = fetch } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
  };
  const res = await fetchImpl(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  const setCookie = res.headers.get('set-cookie') ?? res.headers.get('set-cookie') ?? null;

  return { status: res.status, json, setCookie, raw: text };
}

async function main() {
  console.log('=== PRODUCTION SMOKE TEST: Draft TTL ===\n');

  // 1. Login
  console.log('[STEP 1] Login...');
  const loginRes = await request('POST', '/api/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  console.log(`  POST /api/auth/login → ${loginRes.status}`);
  if (loginRes.status !== 200) {
    console.error('  FAILED: Login did not return 200');
    console.error('  Body:', loginRes.raw);
    process.exit(1);
  }
  const loginCookie = loginRes.setCookie;
  if (!loginCookie) {
    console.error('  FAILED: No Set-Cookie in login response');
    process.exit(1);
  }
  // Extract session cookie
  const sessionCookie = loginCookie.split(',').map((c) => c.split(';')[0]).join('; ');
  console.log(`  Got session cookie: ${sessionCookie.slice(0, 60)}...`);
  console.log('  ✅ Login OK\n');

  // 2. Create draft
  console.log('[STEP 2] Create draft...');
  const createRes = await request('POST', '/api/cards', {
    body: { cardType: 'stamp_card', name: 'Smoke Test Draft' },
    cookie: sessionCookie,
  });
  console.log(`  POST /api/cards → ${createRes.status}`);
  if (createRes.status !== 201) {
    console.error('  FAILED: Create did not return 201');
    console.error('  Body:', createRes.raw);
    process.exit(1);
  }
  if (!createRes.json?.template) {
    console.error('  FAILED: No template in response');
    process.exit(1);
  }

  const templateId = createRes.json.template.id;
  const expiresAt = createRes.json.template.expiresAt;
  console.log(`  Template ID: ${templateId}`);
  console.log(`  expiresAt: ${expiresAt}`);

  if (!expiresAt) {
    console.error('  ❌ FAILED: expiresAt is null/undefined on draft creation');
    process.exit(1);
  }

  const expiresDate = new Date(expiresAt);
  const now = new Date();
  const ttlMs = expiresDate.getTime() - now.getTime();
  const ttlHours = ttlMs / (1000 * 60 * 60);
  console.log(`  TTL: ${ttlHours.toFixed(1)}h from now`);
  if (ttlHours < 23 || ttlHours > 25) {
    console.error(`  ❌ FAILED: TTL ${ttlHours.toFixed(1)}h is outside 23-25h tolerance`);
    process.exit(1);
  }
  console.log('  ✅ expiresAt set correctly (~24h)\n');

  // 3. Touch endpoint
  console.log('[STEP 3] Touch (reset TTL)...');
  const touchRes = await request('PATCH', `/api/cards/${templateId}/touch`, {
    cookie: sessionCookie,
  });
  console.log(`  PATCH /api/cards/${templateId}/touch → ${touchRes.status}`);
  if (touchRes.status !== 200) {
    console.error('  FAILED: Touch did not return 200');
    console.error('  Body:', touchRes.raw);
    process.exit(1);
  }
  if (!touchRes.json?.template) {
    console.error('  FAILED: No template in touch response');
    process.exit(1);
  }

  const touchedExpiresAt = touchRes.json.template.expiresAt;
  console.log(`  expiresAt after touch: ${touchedExpiresAt}`);
  if (!touchedExpiresAt) {
    console.error('  ❌ FAILED: expiresAt is null after touch');
    process.exit(1);
  }

  const touchedDate = new Date(touchedExpiresAt);
  const touchedTtlMs = touchedDate.getTime() - new Date().getTime();
  const touchedTtlHours = touchedTtlMs / (1000 * 60 * 60);
  console.log(`  TTL after touch: ${touchedTtlHours.toFixed(1)}h from now`);
  if (touchedTtlHours < 23 || touchedTtlHours > 25) {
    console.error(`  ❌ FAILED: TTL after touch ${touchedTtlHours.toFixed(1)}h is outside 23-25h tolerance`);
    process.exit(1);
  }
  console.log('  ✅ expiresAt reset correctly (~24h)\n');

  // 4. Publish
  console.log('[STEP 4] Publish (clear TTL)...');
  const publishRes = await request('POST', `/api/cards/${templateId}/publish`, {
    cookie: sessionCookie,
  });
  console.log(`  POST /api/cards/${templateId}/publish → ${publishRes.status}`);
  if (publishRes.status !== 200) {
    console.error('  FAILED: Publish did not return 200');
    console.error('  Body:', publishRes.raw);
    process.exit(1);
  }
  if (!publishRes.json?.template) {
    console.error('  FAILED: No template in publish response');
    process.exit(1);
  }

  const publishedExpiresAt = publishRes.json.template.expiresAt;
  console.log(`  expiresAt after publish: ${publishedExpiresAt}`);
  if (publishedExpiresAt !== null && publishedExpiresAt !== undefined) {
    console.error(`  ❌ FAILED: expiresAt should be null after publish, got: ${publishedExpiresAt}`);
    process.exit(1);
  }
  console.log('  ✅ expiresAt cleared correctly (null)\n');

  // 5. Final summary
  console.log('=== ALL SMOKE TESTS PASSED ===');
  console.log(`Template ID: ${templateId}`);
  console.log(`Draft TTL: ${ttlHours.toFixed(1)}h`);
  console.log(`After touch TTL: ${touchedTtlHours.toFixed(1)}h`);
  console.log(`After publish: null (cleared)`);

  // Cleanup: delete the test template
  console.log('\n[STEP 5] Cleanup: delete test template...');
  const deleteRes = await request('DELETE', `/api/cards/${templateId}`, {
    cookie: sessionCookie,
  });
  console.log(`  DELETE /api/cards/${templateId} → ${deleteRes.status}`);
  console.log('  ✅ Test template deleted\n');
}

main().catch((err) => {
  console.error('\n❌ SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
