require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const pool = require("./db");
const { body, validationResult } = require("express-validator");
const { searchDocuments, generateAnswer } = require("./rag");
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "gemma3:1b";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Токен відсутній" });

  jwt.verify(token, process.env.JWT_SECRET || "default_secret_key", (err, user) => {
    if (err) return res.status(403).json({ error: "Невірний або прострочений токен" });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Доступ лише для адміністраторів" });
  next();
}

async function logAdminAction(actionType, actionDetails, adminId) {
  try {
    await pool.query(
      "INSERT INTO admin_logs (action_type, action_details, admin_id, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)",
      [actionType, actionDetails, adminId]
    );
  } catch (error) {
    console.error("Помилка при логуванні дії:", error);
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.post(
  "/register",
  [
    body("email").isEmail().withMessage("Невірний формат email."),
    body("password").isLength({ min: 8 }).withMessage("Пароль повинен бути не менше 8 символів."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (checkUser.rows.length > 0)
        return res.status(400).json({ message: "Ця електронна пошта вже зареєстрована." });

      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashedPassword]);
      res.status(201).json({ message: "Реєстрація успішна!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Виникла помилка при реєстрації." });
    }
  }
);

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Користувача не знайдено." });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Невірний email або пароль." });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "24h" }
    );
    res.status(200).json({
      message: "Успішний вхід!",
      user: { id: user.id, email: user.email, role: user.role, token },
    });
  } catch (error) {
    console.error("Помилка при вході:", error);
    res.status(500).json({ error: "Сталася помилка на сервері." });
  }
});

app.post("/checkadmin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (user && (await bcrypt.compare(password, user.password))) {
      if (user.role === "admin") {
        res.status(200).json({ message: "Welcome, Admin!" });
      } else {
        res.status(403).json({ error: "You do not have admin rights." });
      }
    } else {
      res.status(401).json({ error: "Invalid email or password." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred." });
  }
});

app.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Токен Google відсутній" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user = result.rows[0];

    if (!user) {
      const insertResult = await pool.query(
        "INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING *",
        [email, `google_${googleId}`, name || email.split("@")[0]]
      );
      user = insertResult.rows[0];
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "24h" }
    );
    res.json({
      message: "Успішний вхід через Google!",
      user: { id: user.id, email: user.email, name: user.nickname || name, role: user.role || "user", token },
      token,
    });
  } catch (error) {
    console.error("Помилка Google авторизації:", error);
    res.status(401).json({ error: "Невалідний Google токен" });
  }
});

app.get("/user", authenticateToken, async (req, res) => {
  const { email } = req.query;
  try {
    const result = await pool.query(
      "SELECT id, email, nickname, role FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Помилка при отриманні даних користувача:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/update-nickname", authenticateToken, async (req, res) => {
  const { email, nickname } = req.body;
  if (!email || !nickname) return res.status(400).json({ error: "Email і нікнейм обов'язкові" });

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    await pool.query("UPDATE users SET nickname = $1 WHERE email = $2", [nickname, email]);
    res.json({ message: "Нікнейм успішно оновлено" });
  } catch (error) {
    console.error("Помилка при оновленні нікнейму:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/change-password", authenticateToken, async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword)
    return res.status(400).json({ error: "Заповніть усі поля" });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: "Користувача не знайдено" });

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Старий пароль невірний" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedNewPassword, email]);
    res.json({ message: "Пароль успішно змінено" });
  } catch (error) {
    console.error("Помилка при зміні пароля:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка запиту до користувачів:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/users/count", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) as count FROM users WHERE is_blocked = FALSE");
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error("Помилка підрахунку користувачів:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/users/:id/block", async (req, res) => {
  const { id } = req.params;
  const { block } = req.body;
  try {
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    const userEmail = userResult.rows[0].email;
    const result = await pool.query(
      "UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING *",
      [block, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    const actionType = block ? "user_blocked" : "user_unblocked";
    const actionDetails = block
      ? `Заблоковано користувача ${userEmail}`
      : `Розблоковано користувача ${userEmail}`;
    await logAdminAction(actionType, actionDetails, 1);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при блокуванні користувача:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/notes", authenticateToken, async (req, res) => {
  const { email, content } = req.body;
  if (!email || !content) return res.status(400).json({ error: "Email і зміст нотатки обов'язкові" });

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    const userId = userResult.rows[0].id;
    await pool.query(
      "INSERT INTO notes (user_id, content, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
      [userId, content]
    );
    res.json({ message: "Нотатку збережено" });
  } catch (error) {
    console.error("Помилка при збереженні нотатки:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/notes", authenticateToken, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email обов'язковий" });

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    const userId = userResult.rows[0].id;
    const notesResult = await pool.query(
      "SELECT content, created_at FROM notes WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(notesResult.rows);
  } catch (error) {
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/subscribe", async (req, res) => {
  const { name, email } = req.body;
  if (!email || !name) return res.status(400).json({ error: "Ім'я та email обов'язкові." });

  try {
    const existing = await pool.query("SELECT * FROM subscribers WHERE email = $1", [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Цей email вже підписаний." });

    await pool.query(
      "INSERT INTO subscribers (name, email, subscribed_at) VALUES ($1, $2, NOW())",
      [name, email]
    );
    res.status(201).json({ message: "Дякуємо за підписку!" });
  } catch (error) {
    console.error("Помилка підписки:", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" });
  }
});

app.post("/add-comment", async (req, res) => {
  const { text, username, article_id } = req.body;

  if (!text || !username || !article_id) {
    return res.status(400).json({
      error: "text, username та article_id є обов'язковими"
    });
  }

  try {
    await pool.query(
      "INSERT INTO comments (text, username, article_id, created_at) VALUES ($1, $2, $3, NOW())",
      [text, username, article_id]
    );

    res.status(201).json({
      message: "Коментар успішно додано!"
    });
  } catch (error) {
    console.error("Помилка при додаванні коментаря:", error);

    res.status(500).json({
      error: "Не вдалося додати коментар"
    });
  }
});

app.get("/comments", async (req, res) => {
  const { article_id } = req.query;
  try {
    let result;
    if (article_id) {
      result = await pool.query(
        "SELECT text, username, created_at FROM comments WHERE article_id = $1 ORDER BY created_at ASC",
        [article_id]
      );
    } else {
      result = await pool.query(
        "SELECT text, username, created_at FROM comments ORDER BY created_at DESC"
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні коментарів:", error);
    res.status(500).json({ error: "Не вдалося отримати коментарі." });
  }
});

app.get("/api/articles", async (req, res) => {
  try {
    const { category, author, search } = req.query;
    let query =
      "SELECT id, title, author, category, description, url, likes, followers, following, liked_by FROM articles WHERE status = $1";
    const values = ["published"];
    const conditions = [];
    let paramIndex = 2;

    if (category && category !== "all") {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }
    if (author && author !== "all") {
      conditions.push(`author = $${paramIndex}`);
      values.push(author);
      paramIndex++;
    }
    if (search) {
      conditions.push(`(LOWER(title) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`);
      values.push(`%${search.toLowerCase()}%`);
    }
    if (conditions.length > 0) query += " AND " + conditions.join(" AND ");

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/popular-articles", async (req, res) => {
  const lang = req.query.lang || "uk";
  try {
    const result = await pool.query(
      `SELECT 
        id, url, likes,
        CASE WHEN $1 = 'en' AND title_en IS NOT NULL THEN title_en ELSE title END as title,
        CASE WHEN $1 = 'en' AND description_en IS NOT NULL THEN description_en ELSE description END as description,
        CASE WHEN $1 = 'en' AND author_en IS NOT NULL THEN author_en ELSE author END as author,
        category
       FROM articles 
       WHERE status = 'published' 
       ORDER BY likes DESC 
       LIMIT 3`,
      [lang]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching popular articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/articles/pending", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM articles WHERE status = $1", ["pending"]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching articles:", err);
    res.status(500).send("Server error");
  }
});

app.get("/api/articles/edit/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching article for edit:", err);
    res.status(500).send("Server error");
  }
});

app.put("/api/articles/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { title, content, alias } = req.body;
  try {
    const result = await pool.query(
      "UPDATE articles SET title = $1, content = $2, author = $3 WHERE id = $4 RETURNING *",
      [title, content, alias, id]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, message: "Статтю оновлено успішно" });
    } else {
      res.status(404).json({ message: "Статтю не знайдено" });
    }
  } catch (err) {
    console.error("Error updating article:", err);
    res.status(500).send("Server error");
  }
});

app.post("/api/articles/confirm/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE articles SET status = $1 WHERE id = $2 RETURNING *",
      ["confirmed", id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Стаття не знайдена" });
    res.json({ success: true, message: "Статтю підтверджено" });
  } catch (error) {
    console.error("Error confirming article:", error);
    res.status(500).json({ message: "Сталася помилка при підтвердженні статті" });
  }
});

app.post("/api/articles/reject/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE articles SET status = $1 WHERE id = $2 RETURNING *",
      ["rejected", id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Стаття не знайдена" });
    res.json({ success: true, message: "Статтю відхилено" });
  } catch (error) {
    console.error("Error rejecting article:", error);
    res.status(500).json({ message: "Сталася помилка при відхиленні статті" });
  }
});

app.get("/api/articles/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM articles WHERE id = $1 AND status = 'published'",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Стаття не знайдена" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/articles", async (req, res) => {
  const { status } = req.query;
  try {
    let query = "SELECT * FROM articles";
    const values = [];
    let paramIndex = 1;
    if (status) {
      query += ` WHERE status = $${paramIndex++}`;
      values.push(status);
    }
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка запиту до бази даних:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/articles/count", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT status, COUNT(*) as count FROM articles GROUP BY status"
    );
    res.json(
      result.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {})
    );
  } catch (error) {
    console.error("Помилка підрахунку статей:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/submit-article", async (req, res) => {
  const { alias, title, content } = req.body;
  try {
    if (!alias || !title || !content)
      return res.status(400).json({ error: "Усі поля (псевдонім, назва, вміст) є обов'язковими" });

    const result = await pool.query(
      `INSERT INTO articles (title, author, category, description, content, url, likes, followers, following, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [title, alias, "general", content.substring(0, 100) + "...", content, `article-${Date.now()}.html`, 0, 0, 0, "pending"]
    );
    await logAdminAction("article_submitted", `Надіслано статтю "${title}" на підтвердження (автор: ${alias})`, 1);
    res.json({ success: true, article: result.rows[0] });
  } catch (error) {
    console.error("Помилка при надсиланні статті:", error);
    res.status(500).json({ error: `Помилка сервера: ${error.message}` });
  }
});

app.post("/articles/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const articleResult = await pool.query("SELECT title FROM articles WHERE id = $1", [id]);
    if (articleResult.rows.length === 0) return res.status(404).json({ error: "Стаття не знайдена" });

    const articleTitle = articleResult.rows[0].title;
    const result = await pool.query(
      "UPDATE articles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Стаття не знайдена" });

    const actionMap = {
      published: { type: "article_published", detail: `Опубліковано статтю "${articleTitle}"` },
      archived: { type: "article_rejected", detail: `Архівовано статтю "${articleTitle}"` },
      draft: { type: "article_restored", detail: `Відновлено статтю "${articleTitle}"` },
    };
    if (actionMap[status]) {
      await logAdminAction(actionMap[status].type, actionMap[status].detail, 1);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка зміни статусу статті:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/api/articles/:id/like", async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  try {
    const checkLike = await pool.query("SELECT liked_by FROM articles WHERE id = $1", [id]);
    let likedBy = checkLike.rows[0].liked_by || [];

    if (likedBy.includes(username)) {
      likedBy = likedBy.filter((user) => user !== username);
      const result = await pool.query(
        "UPDATE articles SET likes = likes - 1, liked_by = $1 WHERE id = $2 RETURNING *",
        [likedBy, id]
      );
      res.json(result.rows[0]);
    } else {
      likedBy.push(username);
      const result = await pool.query(
        "UPDATE articles SET likes = likes + 1, liked_by = $1 WHERE id = $2 RETURNING *",
        [likedBy, id]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error handling like:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/authors/:author/follow", async (req, res) => {
  const { author } = req.params;
  const { username } = req.body;
  try {
    const checkAuthor = await pool.query(
      "SELECT followed_by, followers FROM authors WHERE name = $1",
      [author]
    );
    let followedBy = checkAuthor.rows[0].followed_by || [];

    if (followedBy.includes(username)) {
      followedBy = followedBy.filter((user) => user !== username);
      const result = await pool.query(
        "UPDATE authors SET followers = followers - 1, followed_by = $1 WHERE name = $2 RETURNING *",
        [followedBy, author]
      );
      res.json(result.rows[0]);
    } else {
      followedBy.push(username);
      const result = await pool.query(
        "UPDATE authors SET followers = followers + 1, followed_by = $1 WHERE name = $2 RETURNING *",
        [followedBy, author]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error handling follow:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin-logs", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 5"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні логів:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let context = "";
  try {
    const docs = await searchDocuments(message);
    if (docs.length) {
      context = docs.map((d, i) => `[${i + 1}] ${d.content}`).join("\n\n");
    }
  } catch (e) {
    console.warn("Пошук пропущено:", e.message);
  }

  try {
    const stream = await generateAnswer(message, context, history);
    if (!stream.ok) throw new Error(`Ollama ${stream.status}`);

    const reader = stream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const raw of decoder.decode(value).split("\n")) {
        if (!raw.trim()) continue;
        try {
          const chunk = JSON.parse(raw);
          const delta = chunk?.message?.content || "";
          if (delta) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
          }
          if (chunk.done) res.write("data: [DONE]\n\n");
        } catch {}
      }
    }
    res.end();
  } catch (err) {
    console.error("Chat error:", err.message);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Вибачте, сталася помилка. Спробуйте ще раз." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.post("/api/generate-ai", async (req, res) => {
  const { title, content, author } = req.body;
  if (!title) return res.status(400).json({ success: false, error: "Title is required" });

  try {
    const prompt = `Ти — талановитий літературний редактор. 
Розшир статтю до повноцінного якісного тексту.

Назва: ${title}
Автор: ${author || "Невідомий"}

Оригінальний текст: 
${content || ""}

Створи розширений HTML (тільки вміст, без <html>, <head>, <body>):

- Використовуй мінімум 4–5 підзаголовків <h2>
- Кожен підзаголовок — 2–4 абзаци
- Загальний обсяг — бажано 700–1200 слів
- Академічно-художній стиль, українською мовою
- Додавай емоційність та глибинні роздуми
- Виділи 4–6 ключових термінів у форматі: 
  <span class="term" data-term="термін" data-def="коротке визначення">термін</span>

Пиши тільки чистий HTML.`;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0.7, top_p: 0.85, num_ctx: 4096 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

    const data = await response.json();
    let html = data.message?.content || content;
    html = html.replace(/```html/g, "").replace(/```/g, "").trim();

    res.json({ success: true, html, model: MODEL });
  } catch (error) {
    console.error("Ollama AI Error:", error);
    res.status(500).json({ success: false, error: error.message, fallback: true });
  }
});

const PORT = process.env.PORT || 5012;

pool
  .connect()
  .then(() => console.log("Успішно підключено до бази даних"))
  .catch((err) => console.log("Помилка підключення до бази даних:", err));

app.listen(PORT, () => console.log(`Сервер запущено на http://localhost:${PORT}`));