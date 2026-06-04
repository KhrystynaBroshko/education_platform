const pool = require('./db');

const BLOCKED_PATTERNS = [
  /борщ|суп|рецепт|готувати|зварити|спекти|страв|їжа|кухн|обід|вечер|сніданок|ресторан|кафе|піцц|бургер|шаурм|суші/i,
  /погода|температура|дощ|сніг|хмарно|сонячно|прогноз|градус|вітер|weather|forecast/i,
  /куди (піти|поїхати|сходити)|де (поїсти|відпочити|погуляти)|розваг|кінотеатр/i,
  /футбол|баскетбол|теніс|спорт|матч|турнір|чемпіонат|олімпіад/i,
  /пісн|альбом|виконавець|співак|кіно|фільм|серіал|netflix|youtube|spotify/i,
  /як (написати|зробити|встановити|налаштувати) (код|програм|сайт|додаток|скрипт)/i,
  /хвороб|лікування|симптом|таблетк|лікар|медицин|здоров|аптек/i,
  /\d+\s*[\+\-\*\/]\s*\d+|скільки буде|обчисл|рівнян/i,
  /новин|вибор|конфлікт/i,
  /столиця|країна|туризм|подорож|готель|квиток|аеропорт/i,
  /перекладіть?|як (сказати|написати) (по|на) (англійськ|українськ|французьк|німецьк)/i,
  /анекдот|жарт|розсмішити|funny|joke/i,
];

const ALLOWED_PATTERNS = [
  /стаття|статті|твір|твори|автор|публікац|платформ|слово|літератур/i,
  /\bword\b/i,
  /хто ти|ти хто|що ти|чим займаєшся|що вмієш|who are you|what are you|your (name|role)/i,
  /які функції|що вміє|що може|функціонал|можливост|what (can|do) you|features/i,
  /^(привіт|вітаю|добрий|добридень|hello|hi|hey)[\s!?,.]*/i,
  /^(як (справи|ти|у вас)|що (робиш|нового)|how are you|what'?s up)/i,
  /^(дякую|спасибі|окей|ок|зрозуміло|чудово|thanks|thank you)/i,
];

function isEnglish(text) {
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  const total = (text.match(/[a-zA-Zа-яА-ЯіІїЇєЄ]/g) || []).length;
  return total > 0 && latin / total > 0.6;
}

function isBlocked(message) {
  const msg = message.trim();
  for (const p of ALLOWED_PATTERNS) {
    if (p.test(msg)) return false;
  }
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(msg)) return true;
  }
  return false;
}

function isListRequest(message) {
  return /\b(перелік|список)\b.*(стат|твор|публікац|авт)/i.test(message)
    || /\b(всі|усі)\s+(стат|твор)/i.test(message)
    || /(покажи|дай|виведи).*(стат|твор|публікац)/i.test(message)
    || /які (є |є)?(стат|твор|публікац)/i.test(message)
    || /що (є |є)?(на (сайті|платформі)|в базі)/i.test(message);
}

function isWhoAreYou(message) {
  return /хто ти|ти хто|що ти|чим займаєшся|як тебе звати|who are you|what are you|your name|your role/i.test(message);
}

function isGreeting(message) {
  return /^(привіт|вітаю|добрий|добридень|hello|hi|hey|як справи|how are you|what'?s up)[\s!?,.-]*$/i.test(message.trim());
}

function isPlatformFunctions(message) {
  return /які функції|що вміє|що може|функціонал|можливост|what (can|do) you|features of|platform (do|can)/i.test(message);
}

function stripHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')   
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')       
    .trim()
    .substring(0, 120);         
}

function makeTextStream(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(
        JSON.stringify({ message: { content: text }, done: false }) + '\n'
      ));
      controller.enqueue(encoder.encode(
        JSON.stringify({ done: true }) + '\n'
      ));
      controller.close();
    }
  });
  return { ok: true, body: stream };
}

async function getAllArticles() {
  try {
    const { rows } = await pool.query(
      `SELECT title, author, description
       FROM articles
       WHERE status = 'published'
         AND length(title) > 3
       ORDER BY id
       LIMIT 20`
    );
    return rows;
  } catch (err) {
    console.error('getAllArticles помилка:', err.message);
    return [];
  }
}

async function searchDocuments(query, limit = 5) {
  if (isListRequest(query)) {
    const rows = await getAllArticles();
    return rows.map(r => ({
      content: `Назва: "${r.title}" | Автор: ${r.author || 'невідомо'} | Опис: ${stripHtml(r.description)}`
    }));
  }

  const cleanQuery = query.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ0-9\s]/g, ' ').trim();
  if (!cleanQuery) {
    const rows = await getAllArticles();
    return rows.map(r => ({ content: `Назва: "${r.title}" | Автор: ${r.author || 'невідомо'}` }));
  }

  const words = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const searchWords = words.length > 0 ? words : [cleanQuery.toLowerCase()];

  try {
    const conditions = searchWords
      .map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1} OR LOWER(content) LIKE $${i + 1})`)
      .join(' OR ');
    const values = [...searchWords.map(w => `%${w}%`), limit];

    const { rows } = await pool.query(
      `SELECT title, author, description, LEFT(content, 300) AS content
       FROM articles
       WHERE status = 'published' AND title != '1' AND title != 'р' AND length(title) > 3
         AND (${conditions})
       ORDER BY CASE WHEN LOWER(title) LIKE $1 THEN 1 ELSE 2 END
       LIMIT $${values.length}`,
      values
    );

    console.log(`📄 Знайдено ${rows.length} статей для: "${query}"`);

    if (rows.length > 0) {
      return rows.map(r => ({
        content: `Назва: "${r.title}" | Автор: ${r.author || 'невідомо'} | Опис: ${stripHtml(r.description || r.content)}`
      }));
    }

    const allRows = await getAllArticles();
    return allRows.map(r => ({
      content: `Назва: "${r.title}" | Автор: ${r.author || 'невідомо'}`
    }));

  } catch (err) {
    console.error('Пошук помилка:', err.message);
    return [];
  }
}

async function generateAnswer(message, context, history = []) {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
  const en = isEnglish(message);

  if (isBlocked(message)) {
    console.log(`Заблоковано: "${message}"`);
    return makeTextStream(en
      ? 'I am an assistant of the «Word» platform and can only help with questions about articles and literature on the platform.'
      : 'Я асистент платформи «Слово» і можу допомогти лише з питаннями про статті та літературу на платформі.');
  }

  if (isWhoAreYou(message)) {
    return makeTextStream(en
      ? 'I am an assistant of the «Word» educational literary platform. I help users find articles, learn about authors, and explore works published on the platform.'
      : 'Я - асистент освітньої літературної платформи «Слово». Допомагаю користувачам знаходити статті, дізнаватись про авторів та твори опубліковані на платформі.');
  }

  if (isPlatformFunctions(message)) {
    return makeTextStream(en
      ? 'The «Word» platform allows you to:\n• Read articles and literary works\n• Search articles by title or author\n• Like articles\n• Follow authors\n• Submit your own articles for review\n• Leave comments\n• Save personal notes\n• Register and manage your profile'
      : 'Платформа «Слово» дозволяє:\n• Читати статті та літературні твори\n• Шукати статті за назвою або автором\n• Лайкати статті\n• Підписуватись на авторів\n• Надсилати власні статті на розгляд\n• Залишати коментарі\n• Зберігати особисті нотатки\n• Реєструватись та керувати профілем');
  }

  if (isGreeting(message)) {
    return makeTextStream(en
      ? 'Hello! I am an assistant of the «Word» platform. Ask me about articles, authors or works on the platform.'
      : 'Привіт! Я асистент платформи «Слово». Запитайте про статті, авторів чи твори на платформі.');
  }

  if (isListRequest(message)) {
    const articles = await getAllArticles();
    if (articles.length === 0) {
      return makeTextStream(en
        ? 'There are no published articles on the «Word» platform yet.'
        : 'На платформі «Слово» наразі немає опублікованих статей.');
    }
    const list = articles
      .map(r => {
        const desc = stripHtml(r.description);
        return `• «${r.title}» — Автор: ${r.author || 'невідомо'}${desc ? ' — ' + desc : ''}`;
      })
      .join('\n');
    return makeTextStream(
      (en ? 'Articles on the «Word» platform:\n\n' : 'Статті на платформі «Слово»:\n\n') + list
    );
  }

  const articlesList = context || (en ? 'No articles found.' : 'Статей не знайдено.');

  const systemPrompt = en
    ? `You are ONLY an assistant of the «Word» educational literary platform. Nothing else.

PLATFORM DATA:
${articlesList}

RULES:
- Answer ONLY based on platform data above.
- NEVER give URLs or links - the site is local.
- NEVER invent article titles or authors not listed above.
- If you don't know — say you didn't find this on the platform.`
    : `Ти — ТІЛЬКИ асистент освітньої літературної платформи «Слово». Нічого іншого.

ДАНІ ПЛАТФОРМИ:
${articlesList}

ПРАВИЛА:
- Відповідай ТІЛЬКИ на основі даних платформи вище.
- НІКОЛИ не давай URL або посилань - сайт локальний.
- НІКОЛИ не вигадуй статті чи авторів яких немає вище.
- Якщо не знаєш - скажи що не знайшов на платформі.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: message }
  ];

  return fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      options: { temperature: 0.15, top_p: 0.8, repeat_penalty: 1.1, num_ctx: 4096 }
    }),
  });
}

module.exports = { searchDocuments, generateAnswer };