/**
 * Direct Vite proxy test — does the proxy pass cookie header?
 */
const r = await fetch('http://localhost:5173/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Origin': 'http://localhost:5173',
    'Cookie': 'saome_refresh=test-fake-token',
  },
});
console.log('Status:', r.status);
const arr = [];
r.headers.forEach((v, k) => arr.push(`${k}: ${v}`));
console.log('Headers:');
for (const h of arr) console.log('  ' + h);
const text = await r.text();
console.log('Body:', text.slice(0, 300));