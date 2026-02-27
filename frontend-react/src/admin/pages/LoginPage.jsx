/**
 * Admin Login Page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import '../styles/admin.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, checkAuth, isLoading, error, clearError } = useAdminStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check if already authenticated
    checkAuth().then((isAuth) => {
      if (isAuth) {
        navigate('/admin-panel');
      }
    });
  }, [checkAuth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const success = await login(username, password);
    if (success) {
      navigate('/admin-panel');
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>GroupBuy Admin</h1>
        <p className="admin-login-subtitle">Вход в панель администратора</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && <div className="admin-login-error">{error}</div>}

          <div className="admin-form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="admin-login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="admin-login-footer">
          <p>Используйте учётные данные суперпользователя.</p>
          <details className="admin-login-help">
            <summary>Как создать администратора?</summary>
            <ol>
              <li>Подключитесь к серверу по SSH</li>
              <li>
                Выполните команду:
                <pre><code>docker compose exec core python manage.py createsuperuser</code></pre>
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
