/**
 * بوت تيليجرام للقرآن الكريم — نسخة Cloudflare Workers
 * تحويل كامل من نسخة بايثون (polling) إلى Worker يعمل بنظام webhook.
 *
 * يحتاج:
 *  - متغيّر بيئة (Secret) باسم BOT_TOKEN = توكن البوت
 *  - متغيّر بيئة باسم OWNER_ID = آيدي المالك (رقم)
 *  - ربط KV Namespace باسم BOT_KV (لتخزين بيانات البوت وحالات المستخدمين)
 *  - (اختياري) متغيّر WEBHOOK_SECRET لحماية نقطة الاستقبال
 *
 * بعد النشر على Cloudflare، افتح مرة واحدة في المتصفح:
 *   https://<your-worker>.workers.dev/set-webhook
 * لتسجيل الـ webhook تلقائياً لدى تيليجرام.
 */

const QURAN_API_BASE = "https://api.qurancdn.com/api/qdc";

const DEFAULT_START_MESSAGE =
  "السلام عليكم {name} 🌿\n\nأهلاً بك في بوت القرآن الكريم\n\nاكتب مباشرة ما تتذكره من الآية وسأبحث عنها لك\nواستمع إليها بصوت الشيخ عبدالباسط عبد الصمد";

const DEFAULT_ABOUT_MESSAGE =
  "📖 *بوت القرآن الكريم*\n\n• البحث في كامل القرآن الكريم\n• عرض صفحات القرآن بالصور\n• التنقل بين الصفحات والآيات\n• الاستماع بصوت الشيخ عبدالباسط عبد الصمد\n• يعمل في المحادثات الخاصة والمجموعات";

// ==============================================================
// بيانات السور
// ==============================================================

const SURAH_NAMES = {
  1: "الفاتحة", 2: "البقرة", 3: "آل عمران", 4: "النساء", 5: "المائدة",
  6: "الأنعام", 7: "الأعراف", 8: "الأنفال", 9: "التوبة", 10: "يونس",
  11: "هود", 12: "يوسف", 13: "الرعد", 14: "إبراهيم", 15: "الحجر",
  16: "النحل", 17: "الإسراء", 18: "الكهف", 19: "مريم", 20: "طه",
  21: "الأنبياء", 22: "الحج", 23: "المؤمنون", 24: "النور", 25: "الفرقان",
  26: "الشعراء", 27: "النمل", 28: "القصص", 29: "العنكبوت", 30: "الروم",
  31: "لقمان", 32: "السجدة", 33: "الأحزاب", 34: "سبأ", 35: "فاطر",
  36: "يس", 37: "الصافات", 38: "ص", 39: "الزمر", 40: "غافر",
  41: "فصلت", 42: "الشورى", 43: "الزخرف", 44: "الدخان", 45: "الجاثية",
  46: "الأحقاف", 47: "محمد", 48: "الفتح", 49: "الحجرات", 50: "ق",
  51: "الذاريات", 52: "الطور", 53: "النجم", 54: "القمر", 55: "الرحمن",
  56: "الواقعة", 57: "الحديد", 58: "المجادلة", 59: "الحشر", 60: "الممتحنة",
  61: "الصف", 62: "الجمعة", 63: "المنافقون", 64: "التغابن", 65: "الطلاق",
  66: "التحريم", 67: "الملك", 68: "القلم", 69: "الحاقة", 70: "المعارج",
  71: "نوح", 72: "الجن", 73: "المزمل", 74: "المدثر", 75: "القيامة",
  76: "الإنسان", 77: "المرسلات", 78: "النبأ", 79: "النازعات", 80: "عبس",
  81: "التكوير", 82: "الانفطار", 83: "المطففين", 84: "الانشقاق", 85: "البروج",
  86: "الطارق", 87: "الأعلى", 88: "الغاشية", 89: "الفجر", 90: "البلد",
  91: "الشمس", 92: "الليل", 93: "الضحى", 94: "الشرح", 95: "التين",
  96: "العلق", 97: "القدر", 98: "البينة", 99: "الزلزلة", 100: "العاديات",
  101: "القارعة", 102: "التكاثر", 103: "العصر", 104: "الهمزة", 105: "الفيل",
  106: "قريش", 107: "الماعون", 108: "الكوثر", 109: "الكافرون", 110: "النصر",
  111: "المسد", 112: "الإخلاص", 113: "الفلق", 114: "الناس",
};

const SURAH_VERSES = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
  11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
  21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
  31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
  41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
  51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
  61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
  71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
  81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
  91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
  101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
  111: 5, 112: 4, 113: 5, 114: 6,
};

// ==============================================================
// روابط الميديا
// ==============================================================

function getQuranPageUrl(page) {
  return `https://quran.ksu.edu.sa/png_big/${page}.png`;
}

function getVerseAudioUrl(surah, verse) {
  return `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${String(surah).padStart(3, "0")}${String(verse).padStart(3, "0")}.mp3`;
}

function getPageAudioUrl(page) {
  return `https://everyayah.com/data/Abdul_Basit_Murattal_64kbps/PageMp3s/Page${String(page).padStart(3, "0")}.mp3`;
}

// ==============================================================
// أدوات مساعدة عامة
// ==============================================================

function toEnglishDigits(str) {
  const map = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  return str.replace(/[٠-٩]/g, (d) => map[d]);
}

function md5Hex8(str) {
  // هاش بسيط وسريع (غير تشفيري) كافٍ لتوليد معرّف قصير لنتائج البحث
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (h2 >>> 0) * 4294967296 + (h1 >>> 0);
  return combined.toString(16).slice(0, 8).padStart(8, "0");
}

// ==============================================================
// طبقة تيليجرام
// ==============================================================

function tgApi(env, method) {
  return `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
}

async function tg(env, method, payload) {
  const resp = await fetch(tgApi(env, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!data.ok) {
    console.error(`Telegram API error [${method}]`, data);
  }
  return data;
}

// ==============================================================
// تخزين البيانات في KV
// ==============================================================

async function loadBotData(env) {
  const raw = await env.BOT_KV.get("botdata");
  if (raw) return JSON.parse(raw);
  return {
    required_channels: [],
    start_message: DEFAULT_START_MESSAGE,
    about_message: DEFAULT_ABOUT_MESSAGE,
  };
}

async function saveBotData(env, data) {
  await env.BOT_KV.put("botdata", JSON.stringify(data));
}

async function getState(env, chatId) {
  const raw = await env.BOT_KV.get(`state:${chatId}`);
  return raw ? JSON.parse(raw) : {};
}

async function setState(env, chatId, state) {
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state), { expirationTtl: 1800 });
}

async function clearState(env, chatId) {
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function saveSearchResults(env, queryId, results) {
  await env.BOT_KV.put(`search:${queryId}`, JSON.stringify(results), { expirationTtl: 3600 });
}

async function loadSearchResults(env, queryId) {
  const raw = await env.BOT_KV.get(`search:${queryId}`);
  return raw ? JSON.parse(raw) : null;
}

// ==============================================================
// التحقق من الاشتراك الإجباري
// ==============================================================

async function checkSubscription(env, userId, botData) {
  const notSubscribed = [];
  for (const ch of botData.required_channels || []) {
    const channelId = ch.id || ch.username;
    if (!channelId) continue;
    const res = await tg(env, "getChatMember", { chat_id: channelId, user_id: userId });
    if (!res.ok) {
      console.warn(`Cannot check sub for ${channelId}`);
      continue;
    }
    const status = res.result?.status;
    if (status === "left" || status === "kicked") {
      notSubscribed.push(ch);
    }
  }
  return notSubscribed;
}

function buildSubscriptionKeyboard(notSubscribed) {
  const buttons = notSubscribed.map((ch) => [{ text: `🔔 اشترك في: ${ch.name || "القناة"}`, url: ch.link || "" }]);
  buttons.push([{ text: "✅ تحققت من اشتراكي", callback_data: "check_sub" }]);
  return { inline_keyboard: buttons };
}

// ==============================================================
// لوحات المفاتيح
// ==============================================================

function buildMainKeyboard(env, userId) {
  const buttons = [
    [{ text: "🔍 بحث عن آية", callback_data: "ask_search" }],
    [{ text: "📖 تصفح صفحات القرآن", callback_data: "ask_page" }],
    [{ text: "ℹ️ عن البوت", callback_data: "about" }],
  ];
  if (String(userId) === String(env.OWNER_ID)) {
    buttons.push([{ text: "⚙️ لوحة التحكم", callback_data: "owner_panel" }]);
  }
  return { inline_keyboard: buttons };
}

function buildQuranPageKeyboard(page) {
  const prevCb = page > 1 ? `qpage:${page - 1}` : "noop";
  const nextCb = page < 604 ? `qpage:${page + 1}` : "noop";
  return {
    inline_keyboard: [
      [{ text: `• صفحة ${page} من 604 •`, callback_data: "noop" }],
      [
        { text: "⬅️ السابقة", callback_data: prevCb },
        { text: "التالية ➡️", callback_data: nextCb },
      ],
      [{ text: "🎙️ استمع للصفحة", callback_data: `qpage_audio:${page}` }],
      [{ text: "🔙 القائمة الرئيسية", callback_data: "back_to_start" }],
    ],
  };
}

function buildVerseKeyboard(surah, verse, fromResults = "", isGroup = false) {
  const maxVerse = SURAH_VERSES[surah] || 300;
  const nav = [];
  if (verse > 1) nav.push({ text: "⬅️ السابقة", callback_data: `verse:${surah}:${verse - 1}:${fromResults}` });
  if (verse < maxVerse) nav.push({ text: "التالية ➡️", callback_data: `verse:${surah}:${verse + 1}:${fromResults}` });
  const buttons = [];
  if (nav.length) buttons.push(nav);
  buttons.push([{ text: "🎙️ استمع للآية", callback_data: `audio:${surah}:${verse}` }]);
  if (fromResults) buttons.push([{ text: "🔙 العودة للنتائج", callback_data: `results:${fromResults}` }]);
  if (!isGroup) buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "back_to_start" }]);
  return { inline_keyboard: buttons };
}

function buildResultsKeyboard(results, queryId, isGroup = false) {
  const buttons = results.slice(0, 8).map((r) => {
    const name = SURAH_NAMES[r.surah] || `سورة ${r.surah}`;
    const preview = r.text.length > 65 ? r.text.slice(0, 65) + "…" : r.text;
    return [{ text: `📌 ${name} (${r.verse}) — ${preview}`, callback_data: `verse:${r.surah}:${r.verse}:${queryId}` }];
  });
  if (!isGroup) buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "back_to_start" }]);
  return { inline_keyboard: buttons };
}

function buildVerseMessage(verseData) {
  const name = SURAH_NAMES[verseData.surah] || `سورة ${verseData.surah}`;
  return `📖 *${name}* — الآية ${verseData.verse} — صفحة ${verseData.page}\n\n${verseData.text}`;
}

function buildOwnerPanelKeyboard(botData) {
  const chCount = (botData.required_channels || []).length;
  return {
    inline_keyboard: [
      [{ text: `📢 القنوات المضافة (${chCount})`, callback_data: "owner_sub_menu" }],
      [{ text: "➕ إضافة قناة اشتراك", callback_data: "owner_add_channel" }],
      [{ text: "🗑️ حذف قناة", callback_data: "owner_del_menu" }],
      [{ text: "✏️ تعديل رسالة البداية (ستارت)", callback_data: "owner_edit_start" }],
      [{ text: "📋 تعديل رسالة عن البوت", callback_data: "owner_edit_about" }],
      [{ text: "❌ إغلاق", callback_data: "owner_close" }],
    ],
  };
}

function buildOwnerSubMenuKeyboard(botData) {
  const buttons = (botData.required_channels || []).map((ch) => [{ text: `🔔 ${ch.name || "قناة"}`, url: ch.link || "" }]);
  buttons.push([{ text: "➕ إضافة قناة", callback_data: "owner_add_channel" }]);
  buttons.push([{ text: "🗑️ حذف قناة", callback_data: "owner_del_menu" }]);
  buttons.push([{ text: "🔙 رجوع", callback_data: "owner_panel" }]);
  return { inline_keyboard: buttons };
}

function buildDelChannelKeyboard(botData) {
  const buttons = (botData.required_channels || []).map((ch, i) => [{ text: `❌ حذف: ${ch.name || "قناة"}`, callback_data: `owner_del_ch:${i}` }]);
  buttons.push([{ text: "🔙 رجوع", callback_data: "owner_panel" }]);
  return { inline_keyboard: buttons };
}

// ==============================================================
// API القرآن
// ==============================================================

async function searchQuran(query) {
  try {
    const url = new URL(`${QURAN_API_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("size", "10");
    url.searchParams.set("page", "1");
    url.searchParams.set("language", "ar");
    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json();
    const results = [];
    for (const verse of data?.result?.verses || []) {
      const vk = verse.verse_key || "";
      if (!vk.includes(":")) continue;
      const [s, v] = vk.split(":");
      const words = verse.words || [];
      const text = words.filter((w) => w.char_type === "word").map((w) => w.text).join(" ");
      results.push({ surah: parseInt(s, 10), verse: parseInt(v, 10), text, verse_key: vk });
    }
    return results;
  } catch (e) {
    console.error("Search error", e);
    return [];
  }
}

async function getVerse(surah, verse) {
  try {
    const url = new URL(`${QURAN_API_BASE}/verses/by_key/${surah}:${verse}`);
    url.searchParams.set("language", "ar");
    url.searchParams.set("words", "false");
    url.searchParams.set("translations", "");
    url.searchParams.set("fields", "text_uthmani,verse_number,verse_key,hizb_number,juz_number,page_number");
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    const vd = data?.verse || {};
    return {
      surah,
      verse,
      text: vd.text_uthmani || "",
      page: vd.page_number ?? "?",
      juz: vd.juz_number ?? "?",
      verse_key: vd.verse_key || `${surah}:${verse}`,
    };
  } catch (e) {
    console.error("Get verse error", e);
    return null;
  }
}

// ==============================================================
// إرسال صفحة القرآن
// ==============================================================

async function sendQuranPage(env, chatId, page) {
  const caption = `📖 *القرآن الكريم — صفحة ${page} من 604*\n\nاستخدم الأزرار أدناه للتنقل 👇`;
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: getQuranPageUrl(page),
    caption,
    parse_mode: "Markdown",
    reply_markup: buildQuranPageKeyboard(page),
  });
}

// ==============================================================
// /start والقائمة الرئيسية
// ==============================================================

async function handleStart(env, message) {
  const chatId = message.chat.id;
  const user = message.from;
  const chatType = message.chat.type;

  if (chatType === "group" || chatType === "supergroup") return;

  await clearState(env, chatId);

  const botData = await loadBotData(env);
  if ((botData.required_channels || []).length) {
    const notSub = await checkSubscription(env, user.id, botData);
    if (notSub.length) {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "🔔 *يجب الاشتراك في القنوات التالية أولاً لاستخدام البوت:*",
        parse_mode: "Markdown",
        reply_markup: buildSubscriptionKeyboard(notSub),
      });
      return;
    }
  }

  const msg = (botData.start_message || DEFAULT_START_MESSAGE).replace("{name}", user.first_name || "");
  await tg(env, "sendMessage", { chat_id: chatId, text: msg, reply_markup: buildMainKeyboard(env, user.id) });
}

async function handleHelp(env, message) {
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    parse_mode: "Markdown",
    text:
      "📋 *طريقة الاستخدام:*\n\n" +
      "🔹 *في المحادثة الخاصة:*\n" +
      "• اكتب مباشرة ما تتذكره من الآية للبحث\n" +
      "• أو اضغط 🔍 بحث عن آية من القائمة\n\n" +
      "🔹 *تصفح صفحات القرآن:*\n" +
      "• اضغط 📖 تصفح صفحات القرآن ثم أرسل رقم الصفحة\n\n" +
      "🔹 *في المجموعات:*\n" +
      "• ص٢ أو ص2 أو صفحة ٢ أو صفحة 2 ← لعرض صفحة القرآن\n" +
      "• بحث آية + الكلمات ← للبحث عن آية\n\n" +
      "🔹 *الاستماع:*\n" +
      "• 🎙️ استمع للآية أو استمع للصفحة",
  });
}

async function handleSearchCommand(env, message, argsText) {
  if (!argsText || !argsText.trim()) {
    await tg(env, "sendMessage", { chat_id: message.chat.id, text: "أرسل: /search <نص الآية>" });
    return;
  }
  await processSearch(env, message, argsText.trim());
}

// ==============================================================
// البحث عن الآيات
// ==============================================================

async function processSearch(env, message, queryText) {
  const chatId = message.chat.id;
  const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
  const sent = await tg(env, "sendMessage", { chat_id: chatId, text: "🔍 جارٍ البحث..." });
  const msgId = sent.result?.message_id;
  const results = await searchQuran(queryText);

  if (!results.length) {
    const text = "❌ لم أجد نتائج لهذا البحث، جرب كلمات أخرى من الآية.";
    if (isGroup) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: msgId, text });
    } else {
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text,
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "back_to_start" }]] },
      });
    }
    return;
  }

  const queryId = md5Hex8(queryText);
  await saveSearchResults(env, queryId, results);

  if (results.length === 1) {
    const verseData = await getVerse(results[0].surah, results[0].verse);
    if (verseData) {
      const keyboard = buildVerseKeyboard(verseData.surah, verseData.verse, "", isGroup);
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: buildVerseMessage(verseData),
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
    return;
  }

  const keyboard = buildResultsKeyboard(results, queryId, isGroup);
  await tg(env, "editMessageText", {
    chat_id: chatId,
    message_id: msgId,
    text: `🔍 وجدت *${results.length}* نتيجة لـ "${queryText}"\nاختر الآية:`,
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

// ==============================================================
// معالجة الرسائل الخاصة
// ==============================================================

async function handlePrivateMessage(env, message) {
  const chatId = message.chat.id;
  const user = message.from;
  const text = (message.text || "").trim();
  const isOwner = String(user.id) === String(env.OWNER_ID);

  const botData = await loadBotData(env);
  if ((botData.required_channels || []).length && !isOwner) {
    const notSub = await checkSubscription(env, user.id, botData);
    if (notSub.length) {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "🔔 *يجب الاشتراك في القنوات التالية أولاً:*",
        parse_mode: "Markdown",
        reply_markup: buildSubscriptionKeyboard(notSub),
      });
      return;
    }
  }

  const state = await getState(env, chatId);

  if (isOwner) {
    if (state.type === "wait_channel") {
      await clearState(env, chatId);
      await handleOwnerChannelInput(env, message, text);
      return;
    }
    if (state.type === "wait_start_text") {
      await clearState(env, chatId);
      botData.start_message = text;
      await saveBotData(env, botData);
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ *تم تحديث رسالة البداية بنجاح!*",
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔙 لوحة التحكم", callback_data: "owner_panel" }]] },
      });
      return;
    }
    if (state.type === "wait_about_text") {
      await clearState(env, chatId);
      botData.about_message = text;
      await saveBotData(env, botData);
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ *تم تحديث رسالة عن البوت بنجاح!*",
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔙 لوحة التحكم", callback_data: "owner_panel" }]] },
      });
      return;
    }
  }

  if (state.type === "wait_page_num") {
    const numText = toEnglishDigits(text).trim();
    if (/^\d+$/.test(numText)) {
      const page = parseInt(numText, 10);
      if (page >= 1 && page <= 604) {
        await clearState(env, chatId);
        await sendQuranPage(env, chatId, page);
        return;
      }
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "⚠️ رقم الصفحة يجب أن يكون بين 1 و 604.",
        reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "back_to_start" }]] },
      });
      return;
    }
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ يرجى إرسال رقم فقط (مثل: 25 أو ٢٥).",
      reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "back_to_start" }]] },
    });
    return;
  }

  if (state.type === "wait_search") {
    await clearState(env, chatId);
    if (text.length >= 2) {
      await processSearch(env, message, text);
    } else {
      await tg(env, "sendMessage", { chat_id: chatId, text: "❗ يرجى كتابة كلمتين على الأقل للبحث." });
    }
    return;
  }

  if (text.length >= 2) {
    await processSearch(env, message, text);
  }
}

async function handleOwnerChannelInput(env, message, link) {
  const chatId = message.chat.id;
  let username = "";
  if (link.includes("t.me/")) {
    const part = link.replace(/\/$/, "").split("t.me/").pop().split("/")[0];
    username = "@" + part;
  } else if (link.startsWith("@")) {
    username = link;
  }

  const chInfo = { name: username || link, link, username };
  if (username) {
    const chatRes = await tg(env, "getChat", { chat_id: username });
    if (chatRes.ok) {
      chInfo.name = chatRes.result.title || username;
      chInfo.id = chatRes.result.id;
    }
  }

  const botData = await loadBotData(env);
  botData.required_channels = botData.required_channels || [];
  botData.required_channels.push(chInfo);
  await saveBotData(env, botData);

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: `✅ *تم الحفظ!*\n\nتمت إضافة القناة: *${chInfo.name}*\n\nهل تريد إضافة قناة اشتراك إجباري أخرى؟`,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ نعم", callback_data: "owner_add_channel" },
        { text: "❌ لا", callback_data: "owner_panel" },
      ]],
    },
  });
}

// ==============================================================
// معالجة رسائل المجموعات
// ==============================================================

async function handleGroupMessage(env, message) {
  const chatId = message.chat.id;
  const user = message.from;
  const text = (message.text || "").trim();

  const botData = await loadBotData(env);
  if ((botData.required_channels || []).length) {
    const notSub = await checkSubscription(env, user.id, botData);
    if (notSub.length) {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "🔔 *يجب الاشتراك في القنوات التالية أولاً:*",
        parse_mode: "Markdown",
        reply_markup: buildSubscriptionKeyboard(notSub),
      });
      return;
    }
  }

  const pageMatch = text.match(/ص\s*([٠-٩\d]+)|صفحة\s*([٠-٩\d]+)/u);
  if (pageMatch) {
    const raw = toEnglishDigits(pageMatch[1] || pageMatch[2] || "");
    if (/^\d+$/.test(raw)) {
      const page = parseInt(raw, 10);
      if (page >= 1 && page <= 604) {
        await sendQuranPage(env, chatId, page);
        return;
      }
    }
  }

  const verseMatch = text.match(/^بحث\s+[آاأ][يی][ةه]\s+(.+)/iu);
  if (verseMatch) {
    const queryText = verseMatch[1].trim();
    if (queryText.length >= 2) {
      await processSearch(env, message, queryText);
    } else {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "اكتب ما تتذكره من الآية بعد 'بحث آية'\nمثال: بحث آية الرحمن الرحيم",
      });
    }
  }
}

// ==============================================================
// معالجة الأزرار (callback_query)
// ==============================================================

async function answerCallback(env, callbackQueryId, text, showAlert = false) {
  await tg(env, "answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: showAlert });
}

async function handleCallbackQuery(env, cq) {
  const data = cq.data || "";
  const message = cq.message;
  const chatId = message.chat.id;
  const msgId = message.message_id;
  const user = cq.from;
  const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
  const isOwner = String(user.id) === String(env.OWNER_ID);
  const botData = await loadBotData(env);

  // ---- عام ----
  if (data === "noop") return answerCallback(env, cq.id);

  if (data === "about") {
    await answerCallback(env, cq.id);
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: botData.about_message || DEFAULT_ABOUT_MESSAGE,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "back_to_start" }]] },
    });
    return;
  }

  if (data === "back_to_start") {
    await answerCallback(env, cq.id);
    if (isGroup) {
      await tg(env, "deleteMessage", { chat_id: chatId, message_id: msgId });
      return;
    }
    await clearState(env, chatId);
    const msg = (botData.start_message || DEFAULT_START_MESSAGE).replace("{name}", user.first_name || "");
    await tg(env, "editMessageText", { chat_id: chatId, message_id: msgId, text: msg, reply_markup: buildMainKeyboard(env, user.id) });
    return;
  }

  if (data === "check_sub") {
    const notSub = await checkSubscription(env, user.id, botData);
    if (notSub.length) {
      await answerCallback(env, cq.id, "لم تشترك في جميع القنوات بعد!", true);
      await tg(env, "editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: buildSubscriptionKeyboard(notSub) });
    } else {
      await answerCallback(env, cq.id, "✅ تم التحقق من اشتراكك!");
      const msg = (botData.start_message || DEFAULT_START_MESSAGE).replace("{name}", user.first_name || "");
      await tg(env, "editMessageText", { chat_id: chatId, message_id: msgId, text: msg, reply_markup: buildMainKeyboard(env, user.id) });
    }
    return;
  }

  // ---- بحث عن آية ----
  if (data === "ask_search") {
    await answerCallback(env, cq.id);
    await setState(env, chatId, { type: "wait_search" });
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: "🔍 *البحث عن آية*\n\nأرسل الآن ما تتذكره من الآية وسأبحث عنها لك:",
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "back_to_start" }]] },
    });
    return;
  }

  if (data.startsWith("verse:")) {
    await answerCallback(env, cq.id);
    const parts = data.split(":");
    const surah = parseInt(parts[1], 10);
    const verse = parseInt(parts[2], 10);
    const fromResults = parts[3] || "";
    const verseData = await getVerse(surah, verse);
    if (!verseData) {
      await answerCallback(env, cq.id, "حدث خطأ في جلب الآية", true);
      return;
    }
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: buildVerseMessage(verseData),
      parse_mode: "Markdown",
      reply_markup: buildVerseKeyboard(surah, verse, fromResults, isGroup),
    });
    return;
  }

  if (data.startsWith("results:")) {
    await answerCallback(env, cq.id);
    const queryId = data.split(":").slice(1).join(":");
    const results = await loadSearchResults(env, queryId);
    if (!results) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: msgId, text: "❌ انتهت صلاحية نتائج البحث، يرجى البحث مجدداً." });
      return;
    }
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: `🔍 نتائج البحث (${results.length} نتيجة)\nاختر الآية:`,
      parse_mode: "Markdown",
      reply_markup: buildResultsKeyboard(results, queryId, isGroup),
    });
    return;
  }

  if (data.startsWith("audio:")) {
    await answerCallback(env, cq.id, "جارٍ تحميل التلاوة... 🎙️");
    const [, s, v] = data.split(":");
    const surah = parseInt(s, 10);
    const verse = parseInt(v, 10);
    const surahName = SURAH_NAMES[surah] || `سورة ${surah}`;
    const res = await tg(env, "sendAudio", {
      chat_id: chatId,
      audio: getVerseAudioUrl(surah, verse),
      caption: `🎙️ *${surahName}* — الآية ${verse}\nالشيخ عبدالباسط عبد الصمد`,
      parse_mode: "Markdown",
      title: `${surahName} - آية ${verse}`,
      performer: "الشيخ عبدالباسط عبد الصمد",
    });
    if (!res.ok) {
      await tg(env, "sendMessage", { chat_id: chatId, text: "⚠️ تعذّر تحميل التلاوة، يرجى المحاولة لاحقاً." });
    }
    return;
  }

  // ---- صفحات القرآن ----
  if (data === "ask_page") {
    await answerCallback(env, cq.id);
    await setState(env, chatId, { type: "wait_page_num" });
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: "📖 *تصفح صفحات القرآن الكريم*\n\nأرسل رقم الصفحة التي تريدها (من 1 إلى 604):",
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "back_to_start" }]] },
    });
    return;
  }

  if (data.startsWith("qpage:")) {
    await answerCallback(env, cq.id);
    const page = parseInt(data.split(":")[1], 10);
    if (page < 1 || page > 604) return;
    const caption = `📖 *القرآن الكريم — صفحة ${page} من 604*\n\nاستخدم الأزرار أدناه للتنقل 👇`;
    const res = await tg(env, "editMessageMedia", {
      chat_id: chatId,
      message_id: msgId,
      media: { type: "photo", media: getQuranPageUrl(page), caption, parse_mode: "Markdown" },
      reply_markup: buildQuranPageKeyboard(page),
    });
    if (!res.ok) {
      await tg(env, "sendPhoto", {
        chat_id: chatId,
        photo: getQuranPageUrl(page),
        caption,
        parse_mode: "Markdown",
        reply_markup: buildQuranPageKeyboard(page),
      });
      await tg(env, "deleteMessage", { chat_id: chatId, message_id: msgId });
    }
    return;
  }

  if (data.startsWith("qpage_audio:")) {
    await answerCallback(env, cq.id, "جارٍ تحميل التلاوة... 🎙️");
    const page = parseInt(data.split(":")[1], 10);
    const res = await tg(env, "sendAudio", {
      chat_id: chatId,
      audio: getPageAudioUrl(page),
      caption: `🎙️ *تلاوة صفحة ${page}*\nالشيخ عبدالباسط عبد الصمد — المصحف المرتل`,
      parse_mode: "Markdown",
      title: `صفحة ${page} — القرآن الكريم`,
      performer: "الشيخ عبدالباسط عبد الصمد",
    });
    if (!res.ok) {
      await tg(env, "sendMessage", { chat_id: chatId, text: "⚠️ تعذّر تحميل تلاوة الصفحة، يرجى المحاولة مجدداً." });
    }
    return;
  }

  // ---- لوحة تحكم المالك ----
  if (data.startsWith("owner_") ) {
    if (!isOwner) {
      await answerCallback(env, cq.id, "ليس لديك صلاحية!", true);
      return;
    }

    if (data === "owner_panel") {
      await answerCallback(env, cq.id);
      await clearState(env, chatId);
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: "⚙️ *لوحة تحكم المالك*\n\nاختر العملية:",
        parse_mode: "Markdown",
        reply_markup: buildOwnerPanelKeyboard(botData),
      });
      return;
    }

    if (data === "owner_sub_menu") {
      await answerCallback(env, cq.id);
      const channels = botData.required_channels || [];
      let text = `📢 *قنوات الاشتراك الإجباري* (${channels.length} قناة)`;
      if (!channels.length) text += "\n\nلا توجد قنوات مضافة بعد.";
      await tg(env, "editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "Markdown", reply_markup: buildOwnerSubMenuKeyboard(botData) });
      return;
    }

    if (data === "owner_add_channel") {
      await answerCallback(env, cq.id);
      await setState(env, chatId, { type: "wait_channel" });
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: "📢 *إضافة قناة اشتراك إجباري*\n\nحسناً، أرسل رابط القناة التي تريدها يشترك بها العضو حتى يستخدم البوت:\n\nمثال: https://t.me/yourchannel",
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "owner_panel" }]] },
      });
      return;
    }

    if (data === "owner_del_menu") {
      const channels = botData.required_channels || [];
      if (!channels.length) {
        await answerCallback(env, cq.id, "لا توجد قنوات مضافة للحذف!", true);
        return;
      }
      await answerCallback(env, cq.id);
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: "🗑️ *حذف قناة*\n\nاختر القناة التي تريد حذفها:",
        parse_mode: "Markdown",
        reply_markup: buildDelChannelKeyboard(botData),
      });
      return;
    }

    if (data.startsWith("owner_del_ch:")) {
      const idx = parseInt(data.split(":")[1], 10);
      const channels = botData.required_channels || [];
      if (idx >= 0 && idx < channels.length) {
        const [removed] = channels.splice(idx, 1);
        botData.required_channels = channels;
        await saveBotData(env, botData);
        await answerCallback(env, cq.id, `✅ تم حذف: ${removed.name || "القناة"}`, true);
      } else {
        await answerCallback(env, cq.id);
      }
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: "⚙️ *لوحة تحكم المالك*",
        parse_mode: "Markdown",
        reply_markup: buildOwnerPanelKeyboard(botData),
      });
      return;
    }

    if (data === "owner_edit_start") {
      await answerCallback(env, cq.id);
      await setState(env, chatId, { type: "wait_start_text" });
      const current = botData.start_message || "";
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: `✏️ *تعديل رسالة البداية (ستارت)*\n\nالرسالة الحالية:\n\`${current}\`\n\nأرسل النص الجديد. يمكنك استخدام `+ "`{name}`" + ` لاسم المستخدم.`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "owner_panel" }]] },
      });
      return;
    }

    if (data === "owner_edit_about") {
      await answerCallback(env, cq.id);
      await setState(env, chatId, { type: "wait_about_text" });
      const current = botData.about_message || "";
      await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: `📋 *تعديل رسالة عن البوت*\n\nالرسالة الحالية:\n\`${current}\`\n\nأرسل النص الجديد:`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "owner_panel" }]] },
      });
      return;
    }

    if (data === "owner_close") {
      await answerCallback(env, cq.id);
      await tg(env, "deleteMessage", { chat_id: chatId, message_id: msgId });
      return;
    }
  }

  // أي نمط غير معروف
  await answerCallback(env, cq.id);
}

// ==============================================================
// معالجة تحديث تيليجرام (webhook)
// ==============================================================

async function handleUpdate(env, update) {
  if (update.callback_query) {
    await handleCallbackQuery(env, update.callback_query);
    return;
  }

  const message = update.message;
  if (!message || !message.text) return;

  const text = message.text.trim();
  const chatType = message.chat.type;

  if (text.startsWith("/start")) {
    await handleStart(env, message);
    return;
  }
  if (text.startsWith("/help")) {
    await handleHelp(env, message);
    return;
  }
  if (text.startsWith("/search")) {
    const rest = text.split(" ").slice(1).join(" ");
    await handleSearchCommand(env, message, rest);
    return;
  }
  if (text.startsWith("/")) return; // تجاهل أوامر أخرى غير معروفة

  if (chatType === "private") {
    await handlePrivateMessage(env, message);
  } else if (chatType === "group" || chatType === "supergroup") {
    await handleGroupMessage(env, message);
  }
}

// ==============================================================
// نقطة الدخول
// ==============================================================

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN || !env.OWNER_ID) {
      return new Response("Missing BOT_TOKEN or OWNER_ID environment variable/secret.", { status: 500 });
    }
    if (!env.BOT_KV) {
      return new Response("Missing BOT_KV KV namespace binding.", { status: 500 });
    }

    const url = new URL(request.url);

    // نقطة تسجيل الـ webhook تلقائياً — افتحها مرة واحدة بعد النشر
    if (url.pathname === "/set-webhook") {
      const webhookUrl = `${url.origin}/webhook`;
      const payload = { url: webhookUrl, allowed_updates: ["message", "callback_query"] };
      if (env.WEBHOOK_SECRET) payload.secret_token = env.WEBHOOK_SECRET;
      const res = await tg(env, "setWebhook", payload);
      return new Response(JSON.stringify(res, null, 2), { headers: { "content-type": "application/json" } });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Quran bot worker is running.", { status: 200 });
    }

    if ((url.pathname === "/webhook" || url.pathname === "/") && request.method === "POST") {

      if (env.WEBHOOK_SECRET) {
        const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (secret !== env.WEBHOOK_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }
      }
      const update = await request.json().catch(() => null);
      if (!update) return new Response("Bad Request", { status: 400 });

      // نرد فوراً لتيليجرام، ونكمل المعالجة في الخلفية
      ctx.waitUntil(
        handleUpdate(env, update).catch((e) => console.error("handleUpdate error", e))
      );
      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
};
