export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function callRembg(file: File, baseUrl: string) {
  const endpoints = [
    `${baseUrl.replace(/\/+$/, '')}/api/remove`, // чаще всего так
    `${baseUrl.replace(/\/+$/, '')}/`,           // некоторые образы принимают на корне
  ];

  // соберём форму с двумя ключами на всякий случай
  const fd = new FormData();
  fd.append('image_file', file);
  fd.append('file', file);
  // некоторые сборки поддерживают дополнительные поля
  fd.append('format', 'png');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);

  let lastErr: string | undefined;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', body: fd, signal: ctrl.signal });
      if (!res.ok) {
        lastErr = `rembg ${url} -> ${res.status} ${res.statusText} : ${await res.text()}`;
        continue;
      }
      const ctype = res.headers.get('content-type') || '';
      const buf = await res.arrayBuffer();

      // если вдруг вернулся HTML/JSON — это не то
      if (!ctype.includes('image/') && !ctype.includes('octet-stream')) {
        lastErr = `rembg ${url} returned non-image: ${ctype}`;
        continue;
      }
      return new Response(buf, { status: 200, headers: { 'Content-Type': 'image/png' } });
    } catch (e: any) {
      lastErr = `rembg fetch failed for ${url}: ${e?.message || String(e)}`;
      continue;
    }
  }
  clearTimeout(t);
  return new Response(JSON.stringify({ error: lastErr || 'rembg failed' }), { status: 500 });
}

async function callRemoveBg(file: File, apiKey: string) {
  const fd = new FormData();
  fd.append('image_file', file);
  fd.append('size', 'auto');
  fd.append('format', 'png');

  const out = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: fd,
  });

  if (!out.ok) {
    const msg = await out.text();
    return new Response(JSON.stringify({ error: 'remove.bg failed', details: msg }), { status: 500 });
  }
  const buf = await out.arrayBuffer();
  return new Response(buf, { status: 200, headers: { 'Content-Type': 'image/png' } });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    if (!file) return new Response(JSON.stringify({ error: 'No image' }), { status: 400 });

    const rembgUrl = process.env.REMBG_URL;
    if (rembgUrl) {
      const r = await callRembg(file, rembgUrl);
      if (r.ok) return r;
      // если рембг не справился — пробуем remove.bg как запасной
    }
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (apiKey) return await callRemoveBg(file, apiKey);

    return new Response(JSON.stringify({ error: 'Set REMBG_URL or REMOVE_BG_API_KEY' }), { status: 500 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500 });
  }
}
