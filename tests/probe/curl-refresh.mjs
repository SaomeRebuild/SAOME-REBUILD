// Direct fetch probe to /api/auth/refresh via Vite proxy.
const res = await fetch('http://localhost:5173/api/auth/refresh', {
  method: 'POST',
  headers: { Accept: 'application/json', Origin: 'http://localhost:5173' },
  credentials: 'include',
});
console.log('status:', res.status);
console.log('content-type:', res.headers.get('content-type'));
const text = await res.text();
console.log('body (first 500 chars):', text.slice(0, 500));
const setCookie = res.headers.get('set-cookie');
console.log('set-cookie:', setCookie ?? '(none)');