// /api/tabrik — taklifnoma saytidagi formadan kelgan tabrik va rasmlarni
// Telegram orqali qabul qiluvchiga (OWNER_CHAT_ID) yuboradi.
//   GET  → { bot: "bot_username" }   (saytdagi "Telegram orqali" tugmasi uchun)
//   POST → { name, text, photos: ["data:image/jpeg;base64,..."], website }
import { env, tg, tgForm, json, clean } from './_lib/telegram.mjs';

const MAX_PHOTOS = 5;
const MAX_PHOTO_CHARS = 2_200_000;   // bitta rasm (base64) ~1.6 MB gacha

const handler = async (req) => {
  const { token, owner } = env();
  if (!token) return json({ ok: false, error: 'BOT_TOKEN sozlanmagan' }, 500);

  if (req.method === 'GET') {
    const me = await tg(token, 'getMe', {});
    return json({ ok: true, bot: me.result?.username || null });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (!owner) return json({ ok: false, error: 'OWNER_CHAT_ID sozlanmagan' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'json' }, 400); }

  // Spam botlar uchun tuzoq (yashirin maydon to‘ldirilgan bo‘lsa — jim qabul qilamiz)
  if (body.website) return json({ ok: true });

  const name = clean(body.name, 60) || 'Mehmon';
  const text = clean(body.text, 1500);
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter(p => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < MAX_PHOTO_CHARS)
    .slice(0, MAX_PHOTOS);

  if (!text && !photos.length) return json({ ok: false, error: 'bo‘sh' }, 400);

  const head = `💌 Taklifnoma orqali tabrik\n👤 ${name}`;
  const full = text ? `${head}\n\n${text}` : head;

  try {
    if (!photos.length) {
      const r = await tg(token, 'sendMessage', { chat_id: owner, text: full });
      return json({ ok: !!r.ok }, r.ok ? 200 : 502);
    }

    // Izoh 1024 belgidan uzun bo‘lsa — matnni alohida, rasmlarni keyin yuboramiz
    let caption = full;
    if (full.length > 1024) {
      await tg(token, 'sendMessage', { chat_id: owner, text: full });
      caption = `📷 ${name} yuborgan rasmlar`;
    }

    const blobs = photos.map(p => {
      const [meta, b64] = p.split(',');
      const type = meta.slice(5, meta.indexOf(';'));
      return new Blob([Buffer.from(b64, 'base64')], { type });
    });

    let r;
    if (blobs.length === 1) {
      const fd = new FormData();
      fd.append('chat_id', owner);
      fd.append('caption', caption);
      fd.append('photo', blobs[0], 'tabrik.jpg');
      r = await tgForm(token, 'sendPhoto', fd);
    } else {
      const fd = new FormData();
      fd.append('chat_id', owner);
      fd.append('media', JSON.stringify(blobs.map((_, i) => ({
        type: 'photo', media: `attach://p${i}`, ...(i === 0 ? { caption } : {})
      }))));
      blobs.forEach((b, i) => fd.append(`p${i}`, b, `tabrik-${i + 1}.jpg`));
      r = await tgForm(token, 'sendMediaGroup', fd);
    }
    return json({ ok: !!r.ok }, r.ok ? 200 : 502);
  } catch (e) {
    console.error('[tabrik]', e);
    return json({ ok: false, error: 'telegram' }, 502);
  }
};

// Vercel: /api/tabrik
export const GET = handler;
export const POST = handler;
