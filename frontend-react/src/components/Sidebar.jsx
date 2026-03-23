import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getInitials, getAvatarColor, formatTime } from '../utils/helpers';
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  SearchIcon,
  LogoutIcon,
} from './Icons';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    user,
    procurements,
    currentChat,
    unreadCounts,
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
    theme,
    toggleTheme,
    setCurrentChat,
    logout,
  } = useStore();

  const filteredProcurements = searchQuery
    ? procurements.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.city?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : procurements;

  const handleChatClick = (procurement) => {
    setCurrentChat(procurement.id);
    navigate(`/chat/${procurement.id}`);
    closeSidebar();
  };

  const activeTab = location.pathname.includes('/cabinet') ? 'cabinet' : 'chats';

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <header className="header">
        <button
          className="btn btn-icon menu-toggle"
          aria-label="Menu"
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </button>
        <h1 className="header-title">GroupBuy</h1>
        {!user && (
          <button
            className="btn btn-icon theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        )}
      </header>

      <div className="search-bar">
        <SearchIcon className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          Чаты
        </button>
        <button
          className={`tab ${activeTab === 'cabinet' ? 'active' : ''}`}
          onClick={() => { navigate('/cabinet'); closeSidebar(); }}
        >
          Кабинет
        </button>
      </div>

      {activeTab === 'chats' && (
        <div className="chat-list">
          {filteredProcurements.length === 0 ? (
            <div className="p-lg text-center text-muted">
              <p>Нет активных закупок</p>
            </div>
          ) : (
            filteredProcurements.map((procurement) => (
              <div
                key={procurement.id}
                className={`chat-item ${currentChat === procurement.id ? 'active' : ''}`}
                onClick={() => handleChatClick(procurement)}
              >
                <div
                  className="chat-avatar"
                  style={{ backgroundColor: getAvatarColor(procurement.title) }}
                >
                  {getInitials(procurement.title)}
                </div>
                <div className="chat-info">
                  <div className="chat-header">
                    <span className="chat-title">{procurement.title}</span>
                    <span className="chat-time">
                      {formatTime(procurement.updated_at)}
                    </span>
                  </div>
                  <div className="chat-message">
                    {procurement.participant_count || 0} участников • {procurement.progress || 0}%
                  </div>
                </div>
                {unreadCounts[procurement.id] > 0 && (
                  <div className="chat-badge">{unreadCounts[procurement.id]}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'cabinet' && <div className="sidebar-spacer" />}

      {/* User footer: theme toggle + logout */}
      {user && (
        <div className="sidebar-footer">
          <div
            className="sidebar-footer-avatar"
            style={{ backgroundColor: getAvatarColor(user.first_name || '') }}
          >
            {getInitials(user.first_name, user.last_name)}
          </div>
          <div className="sidebar-footer-info">
            <span className="sidebar-footer-name">{user.first_name} {user.last_name || ''}</span>
          </div>
          <button
            className="btn btn-icon theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className="btn btn-icon sidebar-logout-btn"
            aria-label="Выйти"
            onClick={logout}
          >
            <LogoutIcon />
          </button>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
