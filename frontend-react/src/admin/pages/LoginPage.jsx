/**
 * Admin Login Page
 * Uses browser prompt dialogs for credential input
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import '../styles/admin.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, checkAuth, isLoading, error, clearError } = useAdminStore();
  const [prompted, setPrompted] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    checkAuth().then((isAuth) => {
      if (isAuth) {
        navigate('/admin-panel');
      } else if (!prompted) {
        setPrompted(true);
        handlePromptLogin();
      }
    });
  }, []);

  const handlePromptLogin = async () => {
    const username = window.prompt('GroupBuy Admin\n\nВведите имя пользователя:');
    if (username === null) return; // user cancelled

    const password = window.prompt('GroupBuy Admin\n\nВведите пароль:');
    if (password === null) return; // user cancelled

    clearError();
    const success = await login(username, password);
    if (success) {
      navigate('/admin-panel');
    } else {
      const retry = window.confirm(
        'Ошибка входа. Неверные учётные данные или недостаточно прав.\n\nПопробовать снова?'
      );
      if (retry) {
        handlePromptLogin();
      }
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>GroupBuy Admin</h1>
        <p className="admin-login-subtitle">Вход в панель администратора</p>

        {error && <div className="admin-login-error">{error}</div>}

        {isLoading ? (
          <div className="admin-login-loading">
            <div className="admin-login-spinner" />
            <p>Выполняется вход...</p>
          </div>
        ) : (
          <div className="admin-login-prompt-info">
            <p>Для входа используйте всплывающие окна браузера.</p>
            <button
              className="admin-login-btn"
              onClick={handlePromptLogin}
              disabled={isLoading}
            >
              Войти
            </button>
          </div>
        )}

        <div className="admin-login-footer">
          <details className="admin-login-help">
            <summary>Как создать администратора?</summary>
            <ol>
              <li>Подключитесь к серверу по SSH</li>
              <li>
                Выполните команду:
                <pre><code>docker compose exec django-admin python manage.py createsuperuser</code></pre>
              </li>
              <li>Введите имя пользователя, email и пароль</li>
              <li>Войдите в панель с созданными данными</li>
            </ol>
            <p>
              Адрес панели: <strong>{window.location.origin}/admin-panel/</strong>
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
