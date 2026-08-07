// Login, capture cookie jar, then refresh with cookie.
const jar = [];

async function call(path, opts = {}) {
  const headers = { Accept: 'application/json', Origin: 'http://localhost:5173' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar.length) headers.Cookie = jar.map((c) => `${c.name}=${c.value}`).join('; ');

  const res = await fetch(`http://localhost:5173${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookie) {
    const [pair] = sc.split(';');
    const [name, value] = pair.split('=');
    const idx = jar.findIndex((c) => c.name === name);
    if (idx >= 0) jar[idx].value = value;
    else jar.push({ name, value });
  }
  // Expire cookies when Max-Age=0
  for (const sc of setCookie) {
    if (/Max-Age=0/i.test(sc)) {
      const name = sc.split('=')[0];
      const idx = jar.findIndex((c) => c.name === name);
      if (idx >= 0) jar.splice(idx, 1);
    }
  }

  console.log(`>>> ${opts.method ?? 'POST'} ${path} -> ${res.status}`);
  console.log('   set-cookie:', setCookie.length ? setCookie.join(' | ') : '(none)');
  const text = await res.text();
  console.log('   body (first 400):', text.slice(0, 400));
  return { status: res.status, body: text };
}

console.log('=== Step A: login ===');
await call('/api/auth/login', {
  body: { email: 'admin@saome.org', password: 'Qwww123123!' },
});

console.log('\n=== Step B: refresh with cookie ===');
await call('/api/auth/refresh');

console.log('\n=== Cookie jar ===');
console.log(jar);