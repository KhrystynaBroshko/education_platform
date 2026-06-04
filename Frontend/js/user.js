const translations = {
      uk: {
        page_title: "Профіль — Слово",
        badge: "Читач & Автор",
        tab_settings: "Налаштування",
        tab_notes: "Нотатки",
        settings_title: "Налаштування профілю",
        nickname_label: "Нікнейм",
        nickname_field_label: "Ваш нікнейм",
        nickname_placeholder: "Введіть ваш нікнейм…",
        nickname_btn: "Оновити нікнейм",
        nickname_success: "Нікнейм успішно оновлено!",
        nickname_empty: "Нікнейм не може бути порожнім.",
        nickname_error: "Помилка при оновленні.",
        password_label: "Змінити пароль",
        old_password_label: "Поточний пароль",
        new_password_label: "Новий пароль",
        confirm_password_label: "Підтвердження",
        password_btn: "Змінити пароль",
        password_fill: "Заповніть усі поля.",
        password_mismatch: "Паролі не збігаються.",
        password_success: "Пароль успішно змінено!",
        password_error: "Помилка при зміні пароля.",
        connection_error: "Помилка з'єднання з сервером.",
        notes_title: "Мої нотатки",
        new_note_label: "Нова нотатка",
        note_field_label: "Текст нотатки",
        note_placeholder: "Напишіть думки, ідеї, цитати…",
        note_btn: "Зберегти",
        note_empty_msg: "Нотатка не може бути порожньою.",
        note_success: "Нотатку збережено!",
        note_connection_error: "Помилка з'єднання з сервером.",
        notes_empty_text: "Нотаток поки немає.<br>Напишіть першу!",
        logout_btn: "Вийти з акаунту",
        auth_required: "Будь ласка, увійдіть у систему.",
      },
      en: {
        page_title: "Profile — Word",
        badge: "Reader & Author",
        tab_settings: "Settings",
        tab_notes: "Notes",
        settings_title: "Profile Settings",
        nickname_label: "Nickname",
        nickname_field_label: "Your nickname",
        nickname_placeholder: "Enter your nickname…",
        nickname_btn: "Update nickname",
        nickname_success: "Nickname updated successfully!",
        nickname_empty: "Nickname cannot be empty.",
        nickname_error: "Error updating nickname.",
        password_label: "Change password",
        old_password_label: "Current password",
        new_password_label: "New password",
        confirm_password_label: "Confirm password",
        password_btn: "Change password",
        password_fill: "Please fill in all fields.",
        password_mismatch: "Passwords do not match.",
        password_success: "Password changed successfully!",
        password_error: "Error changing password.",
        connection_error: "Server connection error.",
        notes_title: "My Notes",
        new_note_label: "New note",
        note_field_label: "Note text",
        note_placeholder: "Write thoughts, ideas, quotes…",
        note_btn: "Save",
        note_empty_msg: "Note cannot be empty.",
        note_success: "Note saved!",
        note_connection_error: "Server connection error.",
        notes_empty_text: "No notes yet.<br>Write the first one!",
        logout_btn: "Sign out",
        auth_required: "Please sign in to continue.",
      }
    };

    let currentLang = localStorage.getItem('lang') || 'uk';

    function t(key) {
      return translations[currentLang][key] || key;
    }

    function applyTranslations() {
      document.title = t('page_title');

      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.innerHTML = t(key);
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        el.placeholder = t(key);
      });

      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
      });
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentLang = btn.dataset.lang;
        localStorage.setItem('lang', currentLang);
        applyTranslations();
      });
    });

    function showMsg(el, text, type) {
      el.textContent = text;
      el.className = 'msg show ' + type;
      setTimeout(() => { el.className = 'msg'; }, 4500);
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(target).classList.remove('hidden');
      });
    });

    document.getElementById('backButton').addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'index.html';
      }
    });

    applyTranslations();

    document.addEventListener('DOMContentLoaded', async () => {
      let user  = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('token');

      if (!user || !token) {
        alert(t('auth_required'));
        document.querySelectorAll('.tab-panel').forEach(s => s.classList.add('hidden'));
        document.querySelector('.logout-row').style.display = 'none';
        return;
      }

      const profileAvatar       = document.getElementById('profileAvatar');
      const profileName         = document.getElementById('profileName');
      const profileEmail        = document.getElementById('profileEmail');
      const nicknameInput       = document.getElementById('nicknameInput');
      const updateNicknameBtn   = document.getElementById('updateNicknameButton');
      const nicknameMessage     = document.getElementById('nicknameMessage');
      const oldPassword         = document.getElementById('oldPassword');
      const newPassword         = document.getElementById('newPassword');
      const confirmPassword     = document.getElementById('confirmPassword');
      const changePasswordBtn   = document.getElementById('changePasswordButton');
      const passwordMessage     = document.getElementById('passwordMessage');
      const noteInput           = document.getElementById('noteInput');
      const saveNoteBtn         = document.getElementById('saveNoteButton');
      const noteMessage         = document.getElementById('noteMessage');
      const notesList           = document.getElementById('notesList');

      async function fetchUserData() {
        try {
          const res = await fetch(`http://localhost:5012/user?email=${encodeURIComponent(user.email)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(`Status: ${res.status}`);
          const data = await res.json();
          user = data.user;
          localStorage.setItem('user', JSON.stringify(user));
        } catch (err) {
          console.error('fetchUserData:', err);
        }
      }

      await fetchUserData();

      const displayName = user.nickname || user.email || 'Користувач';
      profileAvatar.textContent = displayName.charAt(0).toUpperCase();
      profileName.textContent   = displayName;
      profileEmail.textContent  = user.email;
      nicknameInput.value       = user.nickname || '';

      updateNicknameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
          showMsg(nicknameMessage, t('nickname_empty'), 'error');
          return;
        }
        try {
          const res = await fetch('http://localhost:5012/update-nickname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ email: user.email, nickname })
          });
          const data = await res.json();
          if (res.ok) {
            user.nickname = nickname;
            localStorage.setItem('user', JSON.stringify(user));
            profileName.textContent    = nickname;
            profileAvatar.textContent  = nickname.charAt(0).toUpperCase();
            showMsg(nicknameMessage, t('nickname_success'), 'success');
          } else {
            showMsg(nicknameMessage, data.error || t('nickname_error'), 'error');
          }
        } catch {
          showMsg(nicknameMessage, t('connection_error'), 'error');
        }
      });

      changePasswordBtn.addEventListener('click', async () => {
        const oldPass     = oldPassword.value;
        const newPass     = newPassword.value;
        const confirmPass = confirmPassword.value;

        if (!oldPass || !newPass || !confirmPass) {
          showMsg(passwordMessage, t('password_fill'), 'error'); return;
        }
        if (newPass !== confirmPass) {
          showMsg(passwordMessage, t('password_mismatch'), 'error'); return;
        }
        try {
          const res = await fetch('http://localhost:5012/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ email: user.email, oldPassword: oldPass, newPassword: newPass })
          });
          const data = await res.json();
          if (res.ok) {
            showMsg(passwordMessage, t('password_success'), 'success');
            oldPassword.value = newPassword.value = confirmPassword.value = '';
          } else {
            showMsg(passwordMessage, data.error || t('password_error'), 'error');
          }
        } catch {
          showMsg(passwordMessage, t('connection_error'), 'error');
        }
      });

      async function fetchNotes() {
        try {
          const res = await fetch(`http://localhost:5012/notes?email=${encodeURIComponent(user.email)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(`Status: ${res.status}`);
          const notes = await res.json();

          if (!notes.length) {
            notesList.innerHTML = `
              <div class="notes-empty">
                <i class="fas fa-feather-alt"></i>
                ${t('notes_empty_text')}
              </div>`;
            return;
          }

          const locale = currentLang === 'uk' ? 'uk-UA' : 'en-GB';
          notesList.innerHTML = notes.map(note => `
            <div class="note-item">
              <div class="note-text">${note.content}</div>
              <div class="note-date">${new Date(note.created_at).toLocaleDateString(locale, { day:'2-digit', month:'long', year:'numeric' })}</div>
            </div>`).join('');
        } catch (err) {
          console.error('fetchNotes:', err);
        }
      }

      saveNoteBtn.addEventListener('click', async () => {
        const content = noteInput.value.trim();
        if (!content) {
          showMsg(noteMessage, t('note_empty_msg'), 'error'); return;
        }
        try {
          const res = await fetch('http://localhost:5012/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ email: user.email, content })
          });
          if (!res.ok) throw new Error(`Status: ${res.status}`);
          noteInput.value = '';
          showMsg(noteMessage, t('note_success'), 'success');
          await fetchNotes();
        } catch {
          showMsg(noteMessage, t('note_connection_error'), 'error');
        }
      });

      await fetchNotes();

      document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'index.html';
      });
    });
