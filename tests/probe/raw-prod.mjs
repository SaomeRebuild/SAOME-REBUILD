/**
 * Probe production login Set-Cookie + Secure flag.
 */
const body = JSON.stringify({ email: 'admin@saome.org', password: 'Qwww123123!' });
const r = await fetch('https://saome-backend.josh1989213.workers.dev/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://app.saome.org',
  },
  body,
});
console.log('Status:', r.status);
const setCookie = r.headers.get('set-cookie') ?? '(none)';
console.log('Set-Cookie:', setCookie);
console.log('Has Secure?', /\bSecure\b/.test(setCookie));
const text = await r.text();
try {
  const j = JSON.parse(text);
  console.log('expiresIn:', j.expiresIn);
} catch {
  console.log('Body:', text.slice(0, 200));
}