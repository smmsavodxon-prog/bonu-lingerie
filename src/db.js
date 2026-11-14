// Oddiy va ishonchli JSON baza: barcha ma'lumotlar DATA_DIR/db.json faylida saqlanadi.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uid = () => crypto.randomBytes(6).toString('hex');

function seed() {
  const cats = [
    { id: uid(), name: 'Lifchiklar', emoji: '🎀', color: '#c084fc' },
    { id: uid(), name: 'Trusiklar', emoji: '🌸', color: '#fb9a7a' },
    { id: uid(), name: 'To\'plamlar', emoji: '💝', color: '#f28fb8' },
    { id: uid(), name: 'Pijama va xalatlar', emoji: '🌙', color: '#60a5fa' },
    { id: uid(), name: 'Bodi va korsetlar', emoji: '✨', color: '#f6b93b' },
    { id: uid(), name: 'Kolgotka va paypoqlar', emoji: '🧦', color: '#34c3a0' },
  ];
  // Namuna rasmlar — admin paneldan haqiqiy rasmlarga almashtiriladi
  const ph = (n) => `/img/sample-${n}.svg`;
  const p = (title, ci, price, oldPrice, quality, country, image, description, stock = 20) => ({
    id: uid(), title, categoryId: cats[ci].id, price, oldPrice, quality, country,
    images: [ph(image)], description, stock, active: true, sold: Math.floor(Math.random() * 120),
    createdAt: Date.now() - Math.floor(Math.random() * 1e9),
  });
  return {
    settings: {
      shopName: 'Bonu Lingerie',
      tagline: 'Nafislik — har kuni siz bilan',
      currency: "so'm",
      accent: '#9b6bc4',
      accent2: '#f5a48a',
      phone: '',
      welcomeText: '🌸 <b>Bonu Lingerie</b>ga xush kelibsiz!\n\nNafis ichki kiyimlar, pijamalar va sovg\'a to\'plamlari. Buyurtmalar yashirin qadoqda yetkaziladi.\n\nDo\'konni ochish uchun pastdagi tugmani bosing 👇',
      orderNote: 'Buyurtmangiz qabul qilindi! Tez orada operatorimiz siz bilan bog\'lanadi. Mahsulot yashirin qadoqda yetkaziladi. 💝',
    },
    admins: [],
    categories: cats,
    products: [
      p('Dantelli lifchik "Rose"', 0, 189000, 239000, 'premium', 'Turkiya', 1, 'Nozik dantel, yumshoq qolip (push-up emas). O\'lchamlar: 70B–85D.'),
      p('Choksiz lifchik "Soft"', 0, 129000, null, 'yuqori', 'Turkiya', 2, 'Kiyim ostidan bilinmaydi, kundalik uchun qulay. Mikrofibra.'),
      p('Push-up lifchik "Velvet"', 0, 219000, null, 'premium', 'Italiya', 3, 'Baxmal teginish, ko\'tarib turuvchi qolip.'),
      p('Paxta trusik (3 dona)', 1, 89000, 115000, 'yuqori', 'O\'zbekiston', 4, '100% paxta, nafas oladi. S–XXL.'),
      p('Dantelli trusik "Bella"', 1, 59000, null, 'standart', 'Turkiya', 5, 'Yengil dantel, elastik bel.'),
      p('To\'plam "Bonu Classic"', 2, 299000, 369000, 'premium', 'Turkiya', 6, 'Lifchik + trusik, dantel va atlas uyg\'unligi. Sovg\'a qutisida.'),
      p('To\'plam "Midnight"', 2, 349000, null, 'premium', 'Fransiya', 7, 'To\'q rangli nafis to\'plam, ipak qo\'shilgan mato.'),
      p('Atlas pijama', 3, 259000, 319000, 'yuqori', 'Turkiya', 8, 'Ko\'ylak va shim, silliq atlas. S–XL.'),
      p('Paxta pijama "Cozy"', 3, 189000, null, 'yuqori', 'O\'zbekiston', 9, 'Yumshoq paxta, uy va dam olish uchun.'),
      p('Ipak xalat', 3, 279000, null, 'premium', 'Turkiya', 10, 'Kamarli, yengil ipaksimon xalat.'),
      p('Dantelli bodi', 4, 239000, 289000, 'premium', 'Italiya', 11, 'Nafis dantel, qulay qisqich.'),
      p('Kolgotka 40 den (2 dona)', 5, 49000, null, 'standart', 'Italiya', 12, 'Mat, cho\'zilmaydigan, chidamli.'),
    ],
    banners: [
      { id: uid(), title: 'Yangi kolleksiya', subtitle: 'Nafis dantel va atlas', emoji: '🌸', from: '#9b6bc4', to: '#f5a48a', action: 'sort:new' },
      { id: uid(), title: 'Chegirmalar', subtitle: '30% gacha arzon', emoji: '💝', from: '#34c3a0', to: '#60a5fa', action: 'filter:sale' },
      { id: uid(), title: 'Sovg\'a to\'plamlari', subtitle: 'Yaqiningizga eng nafis sovg\'a', emoji: '🎁', from: '#f6b93b', to: '#f28fb8', action: 'filter:premium' },
    ],
    appButtons: [
      { id: uid(), label: 'Chegirmalar', emoji: '🔥', action: 'filter:sale' },
      { id: uid(), label: 'Yangi', emoji: '✨', action: 'sort:new' },
      { id: uid(), label: 'Premium', emoji: '💎', action: 'filter:premium' },
      { id: uid(), label: 'Ommabop', emoji: '🏆', action: 'sort:popular' },
    ],
    botButtons: [
      { id: uid(), text: '🛍 Do\'konni ochish', type: 'webapp', value: '', row: 0 },
      { id: uid(), text: '📦 Buyurtmalarim', type: 'webapp', value: 'orders', row: 1 },
      { id: uid(), text: '📞 Aloqa', type: 'text', value: 'Savollaringiz bo\'lsa, shu yerga yozing — operatorimiz javob beradi. 💬', row: 1 },
      { id: uid(), text: '📏 O\'lcham tanlash', type: 'text', value: '📏 <b>Lifchik o\'lchamini aniqlash</b>\n\n1) Ko\'krak ostidan aylana o\'lchang — bu raqam (70, 75, 80...).\n2) Ko\'krakning eng keng joyidan o\'lchang.\n3) Farq: 12–14 sm → A, 14–16 → B, 16–18 → C, 18–20 → D.\n\nMasalan: 75 va 91 sm → <b>75C</b>.\nIkkilansangiz, operatorga yozing — yordam beramiz. 💝', row: 2 },
      { id: uid(), text: 'ℹ️ Biz haqimizda', type: 'text', value: 'Bonu Lingerie — nafis ichki kiyimlar va samimiy xizmat. Barcha buyurtmalar yashirin qadoqda yetkaziladi. 🌸', row: 2 },
    ],
    orders: [],
    users: {},
    cards: [],
  };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  data = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
if (!Array.isArray(data.cards)) data.cards = [];   // to'lov kartalari (ega qo'shadi)

// Dizayn yangilanishi: eski standart ranglarni yangi palitraga almashtiramiz
// (ega o'zi tanlagan rang bo'lsa, tegmaymiz)
if ((data.settings.designVersion || 0) < 4) {
  const fresh = seed();
  const OLD_ACCENTS = ['#b83b5e', '#a8714f', '#1c1714', '#ff3d7f'];
  if (OLD_ACCENTS.includes(String(data.settings.accent).toLowerCase())) {
    data.settings.accent = fresh.settings.accent;
    data.settings.accent2 = fresh.settings.accent2;
  }
  const fc = Object.fromEntries(fresh.categories.map((x) => [x.name, x]));
  for (const c of data.categories || []) if (fc[c.name]) c.color = fc[c.name].color;
  (data.banners || []).forEach((b, i) => {
    const f = fresh.banners.find((x) => x.action === b.action) || fresh.banners[i];
    if (f && !b.image) { b.from = f.from; b.to = f.to; b.title = f.title; b.subtitle = f.subtitle; b.emoji = b.emoji || f.emoji; }
  });
  data.settings.designVersion = 4;
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}

module.exports = { get data() { return data; }, save, uid, UPLOAD_DIR, DATA_DIR };
