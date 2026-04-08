import React, { useState } from 'react';
import { useStore } from '../store/useStore';

function validate(formData) {
  const errors = {};
  if (!formData.first_name || !formData.first_name.trim()) {
    errors.first_name = 'Имя обязательно';
  }
  if (!formData.email || !formData.email.trim()) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    errors.email = 'Введите корректный email';
  }
  if (!formData.password || !formData.password.trim()) {
    errors.password = 'Пароль обязателен';
  } else if (formData.password.length < 8) {
    errors.password = 'Пароль должен содержать минимум 8 символов';
  }
  if (!formData.role) {
    errors.role = 'Роль обязательна';
  }
  return errors;
}

/* Telegram-style phone icon */
function TelegramPhoneIcon() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="80" fill="var(--tg-primary)" opacity="0.1" />
      <circle cx="80" cy="80" r="60" fill="var(--tg-primary)" opacity="0.15" />
      <rect x="58" y="32" width="44" height="96" rx="10" fill="var(--tg-primary)" />
      <rect x="62" y="42" width="36" height="68" rx="4" fill="white" />
      <circle cx="80" cy="118" r="5" fill="white" opacity="0.8" />
    </svg>
  );
}

/* Telegram-style registration icon */
function TelegramRegisterIcon() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="80" fill="var(--tg-primary)" opacity="0.1" />
      <circle cx="80" cy="80" r="60" fill="var(--tg-primary)" opacity="0.15" />
      <circle cx="80" cy="62" r="20" fill="var(--tg-primary)" />
      <path d="M50 110 C50 90 65 80 80 80 C95 80 110 90 110 110" stroke="var(--tg-primary)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="110" cy="58" r="14" fill="var(--tg-success, #4fae4e)" />
      <line x1="110" y1="52" x2="110" y2="64" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <line x1="104" y1="58" x2="116" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function LoginModal() {
  const { loginModalOpen, closeLoginModal, register, login, isLoading, error } = useStore();
  const [activeTab, setActiveTab] = useState('login');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'buyer',
  });
  const [formErrors, setFormErrors] = useState({});

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      return;
    }
    try {
      await login(loginData);
    } catch (err) {
      // Error handled in store
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const errors = validate(registerData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    try {
      await register(registerData);
    } catch (err) {
      // Error handled in store
    }
  };

  if (!loginModalOpen) return null;

  return (
    <div className="auth-screen">
      <div className="auth-container">
        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${activeTab === 'login' ? ' active' : ''}`}
            onClick={() => setActiveTab('login')}
            type="button"
          >
            Вход
          </button>
          <button
            className={`auth-tab${activeTab === 'register' ? ' active' : ''}`}
            onClick={() => setActiveTab('register')}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {activeTab === 'login' ? (
          <>
            {/* Telegram-style illustration */}
            <div className="auth-logo">
              <TelegramPhoneIcon />
            </div>

            <h1 className="auth-title">GroupBuy</h1>
            <p className="auth-subtitle">
              Войдите по email и паролю
            </p>

            <form className="auth-form" onSubmit={handleLoginSubmit}>
              {error && <div className="form-error-banner">{error}</div>}

              <div className={`form-group${loginData.email ? ' has-value' : ''}`}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  name="email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  autoComplete="email"
                />
              </div>

              <div className={`form-group${loginData.password ? ' has-value' : ''}`}>
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  className="form-input"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="auth-btn"
                disabled={isLoading}
              >
                {isLoading && <span className="auth-spinner" />}
                {isLoading ? 'Загрузка...' : 'Продолжить'}
              </button>

              <p className="form-hint" style={{ textAlign: 'center' }}>
                Нет аккаунта?{' '}
                <button
                  type="button"
                  className="form-link-btn"
                  onClick={() => setActiveTab('register')}
                >
                  Зарегистрироваться
                </button>
              </p>
            </form>
          </>
        ) : (
          <>
            {/* Registration illustration */}
            <div className="auth-logo">
              <TelegramRegisterIcon />
            </div>

            <h1 className="auth-title">Регистрация</h1>
            <p className="auth-subtitle">
              Создайте аккаунт для участия в совместных закупках
            </p>

            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              {error && <div className="form-error-banner">{error}</div>}

              <div className={`form-group${registerData.first_name ? ' has-value' : ''}${formErrors.first_name ? ' form-group-error' : ''}`}>
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  className={`form-input${formErrors.first_name ? ' form-input-error' : ''}`}
                  name="first_name"
                  required
                  value={registerData.first_name}
                  onChange={handleRegisterChange}
                  autoComplete="given-name"
                />
                {formErrors.first_name && (
                  <span className="form-field-error">{formErrors.first_name}</span>
                )}
              </div>

              <div className={`form-group${registerData.last_name ? ' has-value' : ''}`}>
                <label className="form-label">Фамилия</label>
                <input
                  type="text"
                  className="form-input"
                  name="last_name"
                  value={registerData.last_name}
                  onChange={handleRegisterChange}
                  autoComplete="family-name"
                />
              </div>

              <div className={`form-group${registerData.email ? ' has-value' : ''}${formErrors.email ? ' form-group-error' : ''}`}>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className={`form-input${formErrors.email ? ' form-input-error' : ''}`}
                  name="email"
                  required
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  autoComplete="email"
                />
                {formErrors.email && (
                  <span className="form-field-error">{formErrors.email}</span>
                )}
              </div>

              <div className={`form-group${registerData.password ? ' has-value' : ''}${formErrors.password ? ' form-group-error' : ''}`}>
                <label className="form-label">Пароль *</label>
                <input
                  type="password"
                  className={`form-input${formErrors.password ? ' form-input-error' : ''}`}
                  name="password"
                  required
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  autoComplete="new-password"
                />
                {formErrors.password && (
                  <span className="form-field-error">{formErrors.password}</span>
                )}
              </div>

              <div className="form-group has-value">
                <label className="form-label">Роль *</label>
                <select
                  className={`form-input form-select${formErrors.role ? ' form-input-error' : ''}`}
                  name="role"
                  required
                  value={registerData.role}
                  onChange={handleRegisterChange}
                >
                  <option value="buyer">Покупатель</option>
                  <option value="organizer">Организатор</option>
                  <option value="supplier">Поставщик</option>
                </select>
                {formErrors.role && (
                  <span className="form-field-error">{formErrors.role}</span>
                )}
              </div>

              <button
                type="submit"
                className="auth-btn"
                disabled={isLoading}
              >
                {isLoading && <span className="auth-spinner" />}
                {isLoading ? 'Загрузка...' : 'Зарегистрироваться'}
              </button>

              <p className="form-hint" style={{ textAlign: 'center' }}>
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  className="form-link-btn"
                  onClick={() => setActiveTab('login')}
                >
                  Войти
                </button>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginModal;
