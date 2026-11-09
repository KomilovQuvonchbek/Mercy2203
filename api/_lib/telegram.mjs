// Umumiy yordamchilar — Telegram Bot API bilan ishlash
// Hech qanday baza yo‘q: hamma narsa Telegram chatiga yuboriladi.

export const env = () => ({
  token: process.env.BOT_TOKEN || '',
  owner: process.env.OWNER_CHAT_ID || '',
  ownerUsername: (process.env.OWNER_USERNAME || 'avloniy1234').replace(/^@/, '').toLowerCase(),
  secret: process.env.WEBHOOK_SECRET || ''
});

const base = token => `https://api.telegram.org/bot${token}`;

// JSON so‘rov
export async function tg(token, method, payload) {
  const r = await fetch(`${base(token)}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) console.error(`[telegram] ${method} xato:`, data.description || r.status);
  return data;
}

// Fayl (multipart) so‘rov
export async function tgForm(token, method, form) {
  const r = await fetch(`${base(token)}/${method}`, { method: 'POST', body: form });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) console.error(`[telegram] ${method} xato:`, data.description || r.status);
  return data;
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export const clean = (s, max) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export function fullName(u = {}) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Mehmon';
}
