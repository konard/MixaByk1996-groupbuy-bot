import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getInitials, getAvatarColor } from '../utils/helpers';
import {
  NewGroupIcon,
  NewChannelIcon,
  SavedMessagesIcon,
  ContactsIcon,
  SettingsIcon,
  AskQuestionIcon,
  TelegramFeaturesIcon,
  NightModeIcon,
  LogoutIcon,
  ShoppingBagIcon,
  HistoryIcon,
  PlusIcon,
  RequestsIcon,
  MailIcon,
} from './Icons';

function BurgerMenu() {
  const navigate = useNavigate();
  const {
    user,
    burgerMenuOpen,
    closeBurgerMenu,
    openCreateProcurementModal,
    theme,
    toggleTheme,
    logout,
  } = useStore();

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        closeBurgerMenu();
      }
    },
    [closeBurgerMenu]
  );

  useEffect(() => {
    if (burgerMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [burgerMenuOpen, handleKeyDown]);

  if (!burgerMenuOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="burger-overlay"
        onClick={closeBurgerMenu}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <nav
        className="burger-panel"
        role="navigation"
        aria-label="Главное меню"
      >
        {/* User section */}
        {user && (
          <div className="burger-user-section">
            <div
              className="burger-user-avatar"
              style={{ backgroundColor: getAvatarColor(user.first_name || '') }}
              aria-label="Аватар пользователя"
            >
              {getInitials(user.first_name, user.last_name)}
            </div>
            <div className="burger-user-info">
              <span className="burger-user-name">
                {user.first_name} {user.last_name || ''}
              </span>
              <span className="burger-user-sub">
                {user.phone || user.email || ''}
              </span>
            </div>
          </div>
        )}

        <div className="burger-divider" />

        {/* Main menu items */}
        <ul className="burger-menu-list" role="list">
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <NewGroupIcon />
              <span>Новая группа</span>
            </button>
          </li>
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <NewChannelIcon />
              <span>Новый канал</span>
            </button>
          </li>
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <SavedMessagesIcon />
              <span>Избранное</span>
            </button>
          </li>
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <ContactsIcon />
              <span>Контакты</span>
            </button>
          </li>
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <SettingsIcon />
              <span>Настройки</span>
            </button>
          </li>
        </ul>

        <div className="burger-divider" />

        <ul className="burger-menu-list" role="list">
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <AskQuestionIcon />
              <span>Задать вопрос</span>
            </button>
          </li>
          <li>
            <button className="burger-menu-item" onClick={closeBurgerMenu}>
              <TelegramFeaturesIcon />
              <span>Возможности Telegram</span>
            </button>
          </li>
        </ul>

        {/* Role-specific items — shown only on mobile (desktop uses Cabinet sidebar) */}
        {user && (
          <>
            <div className="burger-divider burger-mobile-only" />
            <ul className="burger-menu-list burger-mobile-only" role="list">
              {(user.role === 'organizer') && (
                <>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); openCreateProcurementModal(); }}>
                      <PlusIcon />
                      <span>Создать закупку</span>
                    </button>
                  </li>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <ShoppingBagIcon />
                      <span>Мои закупки</span>
                    </button>
                  </li>
                </>
              )}
              {(user.role === 'supplier') && (
                <>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <ShoppingBagIcon />
                      <span>Текущие отгрузки</span>
                    </button>
                  </li>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <HistoryIcon />
                      <span>История отгрузок</span>
                    </button>
                  </li>
                </>
              )}
              {(user.role === 'buyer' || !user.role) && (
                <>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <ShoppingBagIcon />
                      <span>Текущие закупки</span>
                    </button>
                  </li>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <RequestsIcon />
                      <span>Мои запросы</span>
                    </button>
                  </li>
                  <li>
                    <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                      <HistoryIcon />
                      <span>История закупок</span>
                    </button>
                  </li>
                </>
              )}
              <li>
                <button className="burger-menu-item" onClick={() => { closeBurgerMenu(); navigate('/cabinet'); }}>
                  <MailIcon />
                  <span>Подписки</span>
                </button>
              </li>
            </ul>
          </>
        )}

        <div className="burger-divider" />

        {/* Night mode toggle */}
        <ul className="burger-menu-list" role="list">
          <li>
            <button
              className="burger-menu-item burger-menu-item--toggle"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
            >
              <NightModeIcon />
              <span>Ночной режим</span>
              <span
                className={`burger-toggle ${theme === 'dark' ? 'burger-toggle--on' : ''}`}
                aria-hidden="true"
              />
            </button>
          </li>

          {user && (
            <li>
              <button
                className="burger-menu-item burger-menu-item--danger"
                onClick={() => {
                  closeBurgerMenu();
                  logout();
                }}
                aria-label="Выйти из аккаунта"
              >
                <LogoutIcon />
                <span>Выйти</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}

export default BurgerMenu;
