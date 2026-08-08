/**
 * Pure Node.js HTTP probe — no Playwright, no auto-review.
 * Tests local wrangler at http://127.0.0.1:8787 with fixed code.
 */

const http = require('node:http');

const postData = JSON.stringify({ email: 'eason1989213@gmail.com', password: 'www123123' });

const options = {
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log(`HTTP Status: ${res.statusCode}`);
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      console.log('Set-Cookie found:', setCookie[0].slice(0, 80));
    } else {
      console.log('Set-Cookie: NONE');
    }
    try {
      const json = JSON.parse(body);
      console.log('\n--- Login Response ---');
      console.log('user.role:', json.user?.role);
      console.log('tenant.id:', json.tenant?.id ? 'present' : 'null');
      console.log('pass field:', JSON.stringify(json.pass, null, 2));
      if (json.pass) {
        console.log('\n✅ PASS IS RETURNED!');
        console.log('   plan:', json.pass.plan);
        console.log('   daysRemaining:', json.pass.daysRemaining);
        console.log('   status:', json.pass.status);
      } else {
        console.log('\n❌ pass is null/undefined — Banner will NOT show');
      }
    } catch (e) {
      console.log('Raw body:', body.slice(0, 300));
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();
