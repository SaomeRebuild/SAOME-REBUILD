/**
 * Probe local backend (127.0.0.1:8787) via raw HTTP — no browser.
 * Goal: confirm source code 直跑有 Set-Cookie header.
 */
import { request } from 'node:http';

const body = JSON.stringify({ email: 'admin@saome.org', password: 'Qwww123123!' });

const req = request({
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Origin': 'http://localhost:5173',
  },
}, (res) => {
  console.log('=== LOCAL BACKEND (raw HTTP) ===');
  console.log('Status:', res.statusCode);
  console.log('Headers:');
  for (const [k, v] of Object.entries(res.headers)) {
    console.log(`  ${k}: ${v}`);
  }
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Body[0..300]:', data.slice(0, 300));
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();