import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const REQUIRED_REGISTER_FIELDS = ['first_name', 'phone', 'email', 'role'];

function validate(formData) {
  const errors = {};
  if (!formData.first_name || !formData.first_name.trim()) {
    errors.first_name = 'Имя обязательно';
  }
  if (!formData.phone || !formData.phone.trim()) {
    errors.phone = 'Телефон обязателен';
  } else if (!/^\+?[\d\s\-()]{7,20}$/.test(formData.phone.trim())) {
    errors.phone = 'Введите корректный номер телефона';
  }
  if (!formData.email || !formData.email.trim()) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    errors.email = 'Введите корректный email';
  }
  if (!formData.role) {
    errors.role = 'Роль обязательна';
  }
  return errors;
}

function LoginModal() {
  const { loginModalOpen, closeLoginModal, register, login, isLoading, error } = useStore();
  const [activeTab, setActiveTab] = useState('login');

  const [loginData, setLoginData] = useState({ email: '', phone: '' });
  const [registerData, setRegisterData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
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
    if (!loginData.email && !loginData.phone) {
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
    <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && closeLoginModal()}>
      <div className="modal">
        <div className="modal-header">
          <div className="login-tabs">
            <button
              className={`login-tab${activeTab === 'login' ? ' active' : ''}`}
              onClick={() => setActiveTab('login')}
              type="button"
            >
              Вход
            </button>
            <button
              className={`login-tab${activeTab === 'register' ? ' active' : ''}`}
              onClick={() => setActiveTab('register')}
              type="button"
            >
              Регистрация
            </button>
          </div>
        </div>

        {activeTab === 'login' ? (
          <>
            <div className="modal-body">
              <form id="login-form" onSubmit={handleLoginSubmit}>
                {error && <div className="form-error-banner">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    name="email"
                    required
                    placeholder="email@example.com"
                    value={loginData.email}
                    onChange={handleLoginChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Телефон</label>
                  <input
                    type="tel"
                    className="form-input"
                    name="phone"
                    placeholder="+7 999 123 4567"
                    value={loginData.phone}
                    onChange={handleLoginChange}
                  />
                </div>
                <p className="form-hint">
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
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary btn-round"
                onClick={handleLoginSubmit}
                disabled={isLoading}
              >
                {isLoading ? 'Загрузка...' : 'Войти'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body">
              <form id="register-form" onSubmit={handleRegisterSubmit}>
                {error && <div className="form-error-banner">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Имя *</label>
                  <input
                    type="text"
                    className={`form-input${formErrors.first_name ? ' form-input-error' : ''}`}
                    name="first_name"
                    required
                    placeholder="Введите имя"
                    value={registerData.first_name}
                    onChange={handleRegisterChange}
                  />
                  {formErrors.first_name && (
                    <span className="form-field-error">{formErrors.first_name}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Фамилия</label>
                  <input
                    type="text"
                    className="form-input"
                    name="last_name"
                    placeholder="Введите фамилию"
                    value={registerData.last_name}
                    onChange={handleRegisterChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Телефон *</label>
                  <input
                    type="tel"
                    className={`form-input${formErrors.phone ? ' form-input-error' : ''}`}
                    name="phone"
                    required
                    placeholder="+7 999 123 4567"
                    value={registerData.phone}
                    onChange={handleRegisterChange}
                  />
                  {formErrors.phone && (
                    <span className="form-field-error">{formErrors.phone}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className={`form-input${formErrors.email ? ' form-input-error' : ''}`}
                    name="email"
                    required
                    placeholder="email@example.com"
                    value={registerData.email}
                    onChange={handleRegisterChange}
                  />
                  {formErrors.email && (
                    <span className="form-field-error">{formErrors.email}</span>
                  )}
                </div>
                <div className="form-group">
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
                <p className="form-hint">
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
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary btn-round"
                onClick={handleRegisterSubmit}
                disabled={isLoading}
              >
                {isLoading ? 'Загрузка...' : 'Зарегистрироваться'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginModal;
