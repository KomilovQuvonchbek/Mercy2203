// /api/bot — Telegram bot (webhook).
// Mehmon botga yozgan tabrik, rasm, video, ovozli xabarni qabul qiluvchiga (OWNER_CHAT_ID) nusxalaydi.
// Baza yo‘q: har bir xabar darhol chatga yuboriladi.
//
//   GET /api/bot?setup=1&key=WEBHOOK_SECRET  → webhook’ni o‘rnatadi (bir marta)
//   POST /api/bot                            → Telegram yuboradigan yangilanishlar
import { env, tg, json, fullName } from './_lib/telegram.mjs';

const COUPLE = 'Maftuna va Fayzullajon';
const seenAlbums = new Set();   // bitta albom uchun bir marta “rahmat” (vaqtinchalik xotira)

const handler = async (req) => {
  const { token, owner, ownerUsername, secret } = env();
  if (!token) return new Response('BOT_TOKEN sozlanmagan', { status: 500 });
  const url = new URL(req.url);

  // ---- Webhook’ni o‘rnatish ----
  if (req.method === 'GET') {
    if (url.searchParams.get('setup')) {
      if (!secret || url.searchParams.get('key') !== secret) return json({ ok: false, error: 'kalit noto‘g‘ri' }, 403);
      const hook = `${url.origin}/api/bot`;
      const set = await tg(token, 'setWebhook', {
        url: hook, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true
      });
      await tg(token, 'setMyCommands', { commands: [{ command: 'start', description: 'Tabrik yo‘llash' }] });
      await tg(token, 'setMyShortDescription', { short_description: `${COUPLE} to‘yiga tabrik va rasmlaringizni yuboring.` });
      return json({ ok: !!set.ok, webhook: hook, telegram: set.description || null });
    }
    return new Response('Bot ishlayapti ✓');
  }

  // ---- Telegram’dan kelgan yangilanish ----
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  let upd;
  try { upd = await req.json(); } catch { return new Response('ok'); }
  const m = upd.message;
  if (!m || m.chat?.type !== 'private') return new Response('ok');

  const from = m.from || {};
  const text = m.text || '';
  const reply = t => tg(token, 'sendMessage', { chat_id: m.chat.id, text: t });
  const isOwner = (owner && String(m.chat.id) === String(owner)) ||
                  (from.username || '').toLowerCase() === ownerUsername;

  try {
    // Qabul qiluvchi (kelin-kuyov tomoni)
    if (isOwner) {
      if (!owner) {
        await reply(`Assalomu alaykum! Siz tabriklarni qabul qiluvchisiz.\n\nSizning chat ID: ${m.chat.id}\n\nShu raqamni Vercel → Project → Settings → Environment Variables → OWNER_CHAT_ID ga qo‘ying va qayta deploy qiling. Shundan keyin barcha tabriklar shu chatga keladi.`);
      } else if (text.startsWith('/start')) {
        await reply('Bot ishlayapti ✓ Mehmonlar yuborgan barcha tabrik va rasmlar shu chatga keladi.');
      }
      return new Response('ok');
    }

    // Mehmon
    if (text.startsWith('/start')) {
      await reply(`Assalomu alaykum! 🤍\n\n${COUPLE}ning nikoh to‘yiga tabriklaringizni shu yerga yozing. Rasm, video yoki ovozli xabar ham yuborishingiz mumkin — hammasi kelin-kuyovga yetkaziladi.`);
      return new Response('ok');
    }
    if (!owner) {
      await reply('Kechirasiz, bot hali to‘liq sozlanmagan. Birozdan keyin qayta urinib ko‘ring.');
      return new Response('ok');
    }

    const who = fullName(from) + (from.username ? ` (@${from.username})` : '');
    const head = `💌 Tabrik — ${who}`;

    if (m.text) {
      await tg(token, 'sendMessage', { chat_id: owner, text: `${head}\n\n${m.text}`.slice(0, 4096) });
    } else if (m.photo || m.video || m.document || m.audio || m.voice || m.animation) {
      const caption = [head, m.caption].filter(Boolean).join('\n\n').slice(0, 1024);
      await tg(token, 'copyMessage', { chat_id: owner, from_chat_id: m.chat.id, message_id: m.message_id, caption });
    } else {
      // stiker, dumaloq video, joylashuv va h.k. — izoh qo‘shib bo‘lmaydi
      await tg(token, 'sendMessage', { chat_id: owner, text: head });
      await tg(token, 'copyMessage', { chat_id: owner, from_chat_id: m.chat.id, message_id: m.message_id });
    }

    // Albom bo‘lsa — bir marta rahmat aytamiz
    if (m.media_group_id) {
      if (seenAlbums.has(m.media_group_id)) return new Response('ok');
      seenAlbums.add(m.media_group_id);
      if (seenAlbums.size > 500) seenAlbums.clear();
    }
    await reply('Rahmat! Tabrigingiz kelin-kuyovga yetkazildi 🤍');
  } catch (e) {
    console.error('[bot]', e);
  }
  return new Response('ok');
};

// Vercel: /api/bot
export const GET = handler;
export const POST = handler;
