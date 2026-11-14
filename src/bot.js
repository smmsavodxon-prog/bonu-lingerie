// Telegram bot: menyu tugmalari bazadan olinadi va Mini App ichidan o'zgartiriladi.
const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const db = require('./db');

const STATUS = {
  new: '🆕 Yangi', accepted: '✅ Qabul qilindi', shipping: '🚚 Yo\'lda', done: '🎉 Yetkazildi', cancelled: '❌ Bekor qilindi',
};
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ' + db.data.settings.currency;

function createBot({ token, publicUrl, isAdmin, isOwner, ownerId, finalizeOrder }) {
  const bot = new Bot(token);
  const appUrl = (hash) => publicUrl + '/' + (hash ? '#' + hash : '');

  const BTN = { panel: '⚙️ Boshqaruv paneli', addAdmin: '🛡 Admin qo\'shish', admins: '👥 Adminlar', cards: '💳 Kartalar', cancel: '❌ Bekor qilish', pick: '👤 Odamni tanlash' };
  const pending = new Map(); // userId -> { step, data } (karta qo'shish suhbati)
  const fmtCard = (n) => String(n).replace(/(\d{4})(?=\d)/g, '$1 ');
  const cardsText = () => db.data.cards.length
    ? db.data.cards.map((c, i) => `${i + 1}. <code>${fmtCard(c.number)}</code>\n    ${esc(c.holder || '')}${c.bank ? ' · ' + esc(c.bank) : ''}`).join('\n\n')
    : '<i>Hozircha karta qo\'shilmagan.</i>';

  function mainKeyboard(uid) {
    const rows = [];
    for (const b of db.data.botButtons) {
      (rows[b.row] = rows[b.row] || []).push(b);
    }
    const kb = new Keyboard();
    let any = false;
    for (const row of rows.filter(Boolean)) {
      for (const b of row) {
        if (b.type === 'webapp' && publicUrl.startsWith('https://')) kb.webApp(b.text, appUrl(b.value));
        else kb.text(b.text);
        any = true;
      }
      kb.row();
    }
    if (uid && isAdmin(uid)) {
      if (publicUrl.startsWith('https://')) kb.webApp(BTN.panel, appUrl('admin')); else kb.text(BTN.panel);
      kb.row();
      any = true;
    }
    if (uid && isOwner(uid)) { kb.text(BTN.addAdmin).text(BTN.admins).row().text(BTN.cards).row(); any = true; }
    kb.keyboard = kb.keyboard.filter((r) => r.length);
    return any ? kb.resized().persistent() : { remove_keyboard: true };
  }
  const pickKeyboard = () => new Keyboard()
    .requestUsers(BTN.pick, 1, { user_is_bot: false, max_quantity: 1, request_name: true, request_username: true })
    .row().text(BTN.cancel).resized().oneTime();

  function addAdmin(id, name, username) {
    id = Number(id);
    if (!id || isOwner(id)) return false;
    if (!db.data.admins.some((a) => Number(a.id) === id)) {
      const u = db.data.users[id];
      db.data.admins.push({ id, name: name || u?.name || '', username: username || u?.username || '', addedAt: Date.now() });
      db.save();
    }
    api.notifyAdminChange(id, true).catch(() => {});
    return true;
  }
  function adminsMessage() {
    const kb = new InlineKeyboard();
    db.data.admins.forEach((a) => kb.text(`🗑 ${a.name || a.username || a.id}`.slice(0, 40), `adm:del:${a.id}`).row());
    kb.inline_keyboard = kb.inline_keyboard.filter((r) => r.length);
    const list = db.data.admins.map((a) => `• ${esc(a.name || 'Admin')} ${a.username ? '@' + esc(a.username) : ''} — <code>${a.id}</code>`);
    return [list.length ? '<b>👥 Adminlar:</b>\n' + list.join('\n') + '\n\nO\'chirish uchun pastdagi tugmani bosing.' : 'Hozircha admin yo\'q. «' + BTN.addAdmin + '» tugmasini bosing.', { parse_mode: 'HTML', reply_markup: kb }];
  }
  function cardsMessage() {
    const kb = new InlineKeyboard().text('➕ Karta qo\'shish', 'card:add').row();
    db.data.cards.forEach((c) => kb.text(`🗑 •••• ${c.number.slice(-4)}`, `card:del:${c.id}`).row());
    kb.inline_keyboard = kb.inline_keyboard.filter((r) => r.length);
    return [`<b>💳 To'lov kartalari</b>\n\nMijozlar buyurtma berganda shu kartalarni ko'radi va pul o'tkazadi.\n\n${cardsText()}`, { parse_mode: 'HTML', reply_markup: kb }];
  }

  function track(ctx) {
    const u = ctx.from;
    if (!u || u.is_bot) return;
    const prev = db.data.users[u.id];
    db.data.users[u.id] = {
      id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username || '',
      firstSeen: prev?.firstSeen || Date.now(), lastSeen: Date.now(),
    };
    db.save();
  }

  bot.use(async (ctx, next) => { track(ctx); await next(); });

  bot.command('start', async (ctx) => {
    await ctx.reply(db.data.settings.welcomeText || 'Xush kelibsiz!', { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx.from.id) });
    if (publicUrl.startsWith('https://')) {
      await ctx.reply('👇 Do\'konga kirish', {
        reply_markup: new InlineKeyboard().webApp('🛍 ' + db.data.settings.shopName, appUrl('')),
      });
    }
  });

  bot.command('id', (ctx) => ctx.reply(`Sizning Telegram ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML' }));

  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('Bu bo\'lim faqat adminlar uchun.');
    const role = isOwner(ctx.from.id) ? '👑 Ega' : '🛡 Admin';
    await ctx.reply(
      `<b>${role} paneli</b>\n\nMahsulotlar, bo'limlar, bannerlar, bot va app tugmalari, buyurtmalar${isOwner(ctx.from.id) ? ' va adminlar' : ''} — hammasi Mini App ichida.\n\n`
      + (isOwner(ctx.from.id) ? 'Tezkor buyruqlar:\n/addadmin <code>ID</code> — admin qo\'shish\n/deladmin <code>ID</code> — adminni o\'chirish\n/admins — adminlar ro\'yxati\n' : '')
      + '/refresh — menyu tugmalarini yangilash',
      {
        parse_mode: 'HTML',
        reply_markup: publicUrl.startsWith('https://') ? new InlineKeyboard().webApp('⚙️ Boshqaruv paneli', appUrl('admin')) : undefined,
      },
    );
  });

  bot.command('refresh', (ctx) => ctx.reply('Menyu yangilandi ✨', { reply_markup: mainKeyboard(ctx.from.id) }));

  bot.command('admins', async (ctx) => {
    if (!isOwner(ctx.from.id)) return;
    const list = db.data.admins.map((a) => `• ${esc(a.name || 'Admin')} ${a.username ? '@' + esc(a.username) : ''} — <code>${a.id}</code>`);
    await ctx.reply(list.length ? '<b>Adminlar:</b>\n' + list.join('\n') : 'Hozircha admin yo\'q.', { parse_mode: 'HTML' });
  });

  bot.command('addadmin', async (ctx) => {
    if (!isOwner(ctx.from.id)) return;
    const id = Number(String(ctx.match).trim());
    if (!id) return ctx.reply('Foydalanish: /addadmin 123456789\n(ID ni bilish uchun odam botga /id yozsin)');
    addAdmin(id);
    ctx.reply(`✅ ${id} admin qilindi.`);
  });

  bot.command('deladmin', async (ctx) => {
    if (!isOwner(ctx.from.id)) return;
    const id = Number(String(ctx.match).trim());
    db.data.admins = db.data.admins.filter((a) => Number(a.id) !== id);
    db.save();
    await api.notifyAdminChange(id, false).catch(() => {});
    ctx.reply(`🗑 ${id} adminlikdan olindi.`);
  });

  // Buyurtma holatini bot ichidan o'zgartirish
  bot.callbackQuery(/^st:(\w+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
    const [, id, status] = ctx.match;
    const o = db.data.orders.find((x) => x.id === id);
    if (!o || !STATUS[status]) return ctx.answerCallbackQuery({ text: 'Topilmadi' });
    o.status = status;
    db.save();
    await api.notifyStatus(o).catch(() => {});
    await ctx.editMessageText(orderText(o) + `\n\n<i>${esc(ctx.from.first_name)} tomonidan yangilandi</i>`, { parse_mode: 'HTML', reply_markup: statusKb(o) }).catch(() => {});
    ctx.answerCallbackQuery({ text: STATUS[status] });
  });

  // ---------- To'lov (Click / Payme orqali Telegram Payments) ----------
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;
    const o = db.data.orders.find((x) => x.id === q.invoice_payload);
    let err = '';
    if (!o || o.status !== 'unpaid') err = 'Buyurtma topilmadi yoki allaqachon to\'langan. Qaytadan buyurtma bering.';
    else if (q.total_amount !== o.total * 100) err = 'Narx o\'zgargan. Qaytadan buyurtma bering.';
    else {
      for (const l of o.items) {
        const p = db.data.products.find((x) => x.id === l.id);
        if (!p || p.active === false) { err = `"${l.title}" endi sotuvda yo'q.`; break; }
        if (typeof p.stock === 'number' && p.stock < l.qty) { err = `"${l.title}" dan faqat ${p.stock} dona qoldi.`; break; }
      }
    }
    await ctx.answerPreCheckoutQuery(!err, err ? { error_message: err } : undefined);
  });

  bot.on('message:successful_payment', async (ctx) => {
    const sp = ctx.message.successful_payment;
    const o = db.data.orders.find((x) => x.id === sp.invoice_payload);
    if (!o) return;
    if (o.status === 'unpaid') {
      Object.assign(o, {
        status: 'new', paid: true, paidAt: Date.now(),
        payment: { provider: sp.provider_payment_charge_id, telegram: sp.telegram_payment_charge_id, amount: sp.total_amount / 100, currency: sp.currency },
      });
      finalizeOrder(o);
    }
  });

  // ---------- Ega: admin tanlash (kontaktlardan) ----------
  bot.on('message:users_shared', async (ctx) => {
    if (!isOwner(ctx.from.id)) return;
    const users = ctx.message.users_shared.users || [];
    const done = [];
    for (const u of users) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
      if (addAdmin(u.user_id, name, u.username)) done.push(esc(name || u.username || u.user_id));
    }
    await ctx.reply(done.length
      ? `✅ <b>${done.join(', ')}</b> admin qilindi!\n\nEndi u botga /start bossa, «${BTN.panel}» tugmasi chiqadi va do'konni (mahsulot, narx, rasm, banner, buyurtmalar) to'liq boshqara oladi.\n\n⚠️ Agar u hali botga /start bosmagan bo'lsa, xabar bormaydi — unga botni ochib /start bosishini ayting.`
      : 'Bu odamni admin qilib bo\'lmadi.', { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx.from.id) });
  });
  bot.callbackQuery(/^adm:del:(\d+)$/, async (ctx) => {
    if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Faqat ega uchun' });
    const id = Number(ctx.match[1]);
    db.data.admins = db.data.admins.filter((a) => Number(a.id) !== id);
    db.save();
    api.notifyAdminChange(id, false).catch(() => {});
    const [t, o] = adminsMessage();
    await ctx.editMessageText(t, o).catch(() => {});
    ctx.answerCallbackQuery({ text: 'Adminlikdan olindi' });
  });

  // ---------- Mijoz chek (rasm) yuborsa — ega va adminlarga jo'natamiz ----------
  bot.on(['message:photo', 'message:document'], async (ctx) => {
    if (isAdmin(ctx.from.id)) return;
    const u = ctx.from;
    const last = db.data.orders.find((o) => Number(o.userId) === Number(u.id) && o.status !== 'unpaid');
    const cap = `🧾 <b>To'lov cheki</b>${last ? ` — buyurtma #${last.no} (${money(last.total)})` : ''}\n👤 <a href="tg://user?id=${u.id}">${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || 'Mijoz')}</a> ${u.username ? '@' + esc(u.username) : ''}`;
    for (const id of new Set([ownerId, ...db.data.admins.map((a) => Number(a.id))])) {
      await bot.api.copyMessage(id, ctx.chat.id, ctx.message.message_id, { caption: cap, parse_mode: 'HTML' }).catch(() => {});
    }
    await ctx.reply('✅ Chek qabul qilindi! Operatorimiz tekshirib, tez orada tasdiqlaydi. 💜');
  });

  // ---------- Ega: to'lov kartalari ----------
  bot.callbackQuery('card:add', async (ctx) => {
    if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Faqat ega uchun' });
    if (db.data.cards.length >= 5) return ctx.answerCallbackQuery({ text: 'Ko\'pi bilan 5 ta karta', show_alert: true });
    pending.set(ctx.from.id, { step: 'number', data: {} });
    await ctx.answerCallbackQuery();
    await ctx.reply('💳 Karta raqamini yuboring (16 ta raqam).\nMasalan: <code>8600 1234 5678 9012</code>', { parse_mode: 'HTML', reply_markup: new Keyboard().text(BTN.cancel).resized().oneTime() });
  });
  bot.callbackQuery(/^card:del:(\w+)$/, async (ctx) => {
    if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Faqat ega uchun' });
    db.data.cards = db.data.cards.filter((c) => c.id !== ctx.match[1]);
    db.save();
    const [t, o] = cardsMessage();
    await ctx.editMessageText(t, o).catch(() => {});
    ctx.answerCallbackQuery({ text: 'Karta o\'chirildi' });
  });

  // Matnli tugmalar
  bot.on('message:text', async (ctx, next) => {
    const uid = ctx.from.id;
    const text = ctx.message.text.trim();
    if (text === BTN.cancel) { pending.delete(uid); return ctx.reply('Bekor qilindi.', { reply_markup: mainKeyboard(uid) }); }
    const st = pending.get(uid);
    if (st && isOwner(uid)) {
      if (st.step === 'number') {
        const n = text.replace(/\D/g, '');
        if (n.length !== 16) return ctx.reply('Karta raqami 16 ta raqam bo\'lishi kerak. Qaytadan yuboring yoki «' + BTN.cancel + '».');
        st.data.number = n; st.step = 'holder';
        return ctx.reply('👤 Karta egasining ism-familiyasini yozing.\nMasalan: <i>Bonu Karimova</i>', { parse_mode: 'HTML' });
      }
      if (st.step === 'holder') {
        st.data.holder = text.slice(0, 60); st.step = 'bank';
        return ctx.reply('🏦 Bank yoki karta turi (masalan: Uzcard, Humo, Kapitalbank).\nKerak bo\'lmasa «-» yuboring.');
      }
      if (st.step === 'bank') {
        st.data.bank = text === '-' ? '' : text.slice(0, 40);
        db.data.cards.push({ id: db.uid(), ...st.data, addedAt: Date.now() });
        db.save();
        pending.delete(uid);
        await ctx.reply('✅ Karta qo\'shildi!', { reply_markup: mainKeyboard(uid) });
        const [t, o] = cardsMessage();
        return ctx.reply(t, o);
      }
    }
    if (isOwner(uid)) {
      if (text === BTN.addAdmin) {
        pending.delete(uid);
        return ctx.reply('🛡 Kimni admin qilmoqchisiz?\n\nPastdagi «' + BTN.pick + '» tugmasini bosing va kontaktlaringizdan odamni tanlang.\n\nYoki uning Telegram ID raqamini yozib yuboring (ID ni bilish uchun u botga /id yozadi).', { reply_markup: pickKeyboard() });
      }
      if (text === BTN.admins) { const [t, o] = adminsMessage(); return ctx.reply(t, o); }
      if (text === BTN.cards) { pending.delete(uid); const [t, o] = cardsMessage(); return ctx.reply(t, o); }
      if (/^\d{5,15}$/.test(text)) {
        if (addAdmin(text)) return ctx.reply(`✅ <code>${text}</code> admin qilindi.`, { parse_mode: 'HTML', reply_markup: mainKeyboard(uid) });
      }
    }
    if (text === BTN.panel && isAdmin(uid)) {
      return ctx.reply('⚙️ Boshqaruv paneli', { reply_markup: publicUrl.startsWith('https://') ? new InlineKeyboard().webApp('Ochish', appUrl('admin')) : undefined });
    }
    return next();
  });
  bot.on('message:text', async (ctx) => {
    const b = db.data.botButtons.find((x) => x.text === ctx.message.text);
    if (!b) {
      if (publicUrl.startsWith('https://')) {
        return ctx.reply('Do\'konni ochish uchun tugmani bosing 👇', {
          reply_markup: new InlineKeyboard().webApp('🛍 Do\'kon', appUrl('')),
        });
      }
      return;
    }
    if (b.type === 'url') {
      return ctx.reply(b.text, { reply_markup: new InlineKeyboard().url('Ochish ↗️', b.value) });
    }
    if (b.type === 'webapp') {
      return ctx.reply(b.text, { reply_markup: new InlineKeyboard().webApp('Ochish', appUrl(b.value)) });
    }
    return ctx.reply(b.value || '…', { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx.from.id) });
  });

  bot.catch((e) => console.error('Bot xatosi:', e.message));

  function orderText(o) {
    const items = o.items.map((i) => `• ${esc(i.title)} × ${i.qty} = ${money(i.price * i.qty)}`).join('\n');
    return `🛒 <b>Buyurtma #${o.no}</b> — ${STATUS[o.status]}\n\n${items}\n\n<b>Jami: ${money(o.total)}</b>\n\n`
      + `👤 <a href="tg://user?id=${o.userId}">${esc(o.name || 'Mijoz')}</a> ${o.username ? '@' + esc(o.username) : ''}\n📞 ${esc(o.phone)}`
      + (o.address ? `\n📍 ${esc(o.address)}` : '') + (o.comment ? `\n💬 ${esc(o.comment)}` : '')
      + (o.paid ? `\n\n💳 <b>To'langan</b> (${money(o.payment?.amount ?? o.total)})` : '');
  }
  function statusKb(o) {
    return new InlineKeyboard()
      .text('✅ Qabul', `st:${o.id}:accepted`).text('🚚 Yo\'lda', `st:${o.id}:shipping`).row()
      .text('🎉 Yetkazildi', `st:${o.id}:done`).text('❌ Bekor', `st:${o.id}:cancelled`);
  }

  const api = {
    async createInvoice(o, providerToken) {
      const prices = o.items.map((i) => ({ label: `${i.title}`.slice(0, 28) + (i.qty > 1 ? ` ×${i.qty}` : ''), amount: i.price * i.qty * 100 }));
      return bot.api.createInvoiceLink(
        `${db.data.settings.shopName} #${o.no}`.slice(0, 32),
        o.items.map((i) => `${i.title} × ${i.qty}`).join(', ').slice(0, 255),
        o.id, providerToken, 'UZS', prices,
      );
    },
    async setup() {
      await bot.api.setMyCommands([
        { command: 'start', description: 'Bosh menyu' },
        { command: 'id', description: 'Telegram ID ni bilish' },
        { command: 'admin', description: 'Boshqaruv paneli' },
      ]);
      if (publicUrl.startsWith('https://')) {
        await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: '🛍 Do\'kon', web_app: { url: appUrl('') } } });
      }
    },
    async notifyNewOrder(o) {
      const ids = [ownerId, ...db.data.admins.map((a) => Number(a.id))];
      for (const id of new Set(ids)) {
        await bot.api.sendMessage(id, orderText(o), { parse_mode: 'HTML', reply_markup: statusKb(o) }).catch(() => {});
      }
      const pay = !o.paid && db.data.cards.length
        ? `\n\n💳 <b>To'lov uchun karta${db.data.cards.length > 1 ? 'lar' : ''}:</b>\n${cardsText()}\n\nTo'lov qilgach, chekni shu yerga yuboring.`
        : '';
      await bot.api.sendMessage(o.userId, `🎉 <b>Buyurtma #${o.no} qabul qilindi!</b>\n\n${esc(db.data.settings.orderNote)}\n\nJami: <b>${money(o.total)}</b>${pay}`, { parse_mode: 'HTML' }).catch(() => {});
    },
    async notifyStatus(o) {
      await bot.api.sendMessage(o.userId, `📦 Buyurtma #${o.no}: <b>${STATUS[o.status]}</b>`, { parse_mode: 'HTML' }).catch(() => {});
    },
    async notifyAdminChange(id, added) {
      await bot.api.sendMessage(id, added
        ? '🛡 Siz <b>' + esc(db.data.settings.shopName) + '</b> admini etib tayinlandingiz!\n\nPastdagi «' + BTN.panel + '» tugmasi orqali do\'konni boshqarasiz: mahsulot, narx, rasm, bo\'lim, banner va buyurtmalar.'
        : 'Siz endi admin emassiz.', { parse_mode: 'HTML', reply_markup: mainKeyboard(id) });
    },
  };
  return { bot, api };
}

module.exports = { createBot };
