/**
 * Admin Chat Page
 * Allows admin to view and participate in user conversations
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';
import { adminApi } from '../services/adminApi';
import AdminLayout from '../components/AdminLayout';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminChatPage() {
  const { users, loadUsers, addToast } = useAdminStore();
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadUsers({ page_size: 100 });
  }, [loadUsers]);

  const loadMessages = useCallback(async (userId) => {
    if (!userId) return;
    setLoadingMessages(true);
    try {
      const response = await adminApi.getMessages({ user: userId, page_size: 50 });
      const msgs = response.results || response;
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      addToast('Ошибка загрузки сообщений', 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!selectedUser) return;
    loadMessages(selectedUser.id);

    // Poll for new messages every 5 seconds
    pollRef.current = setInterval(() => {
      loadMessages(selectedUser.id);
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [selectedUser, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setInputText('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser || sending) return;
    setSending(true);
    try {
      await adminApi.sendAdminMessage(selectedUser.id, inputText.trim());
      setInputText('');
      await loadMessages(selectedUser.id);
    } catch (err) {
      addToast('Ошибка отправки сообщения', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Чат с пользователями</h1>
        </div>

        <div className="admin-chat-layout">
          {/* User List */}
          <div className="admin-chat-users">
            <div className="admin-chat-users-header">
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-input"
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>
            {filteredUsers.length === 0 ? (
              <div style={{ padding: '1rem', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                Пользователи не найдены
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`admin-chat-user-item${selectedUser?.id === user.id ? ' active' : ''}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="admin-chat-avatar">
                    {getInitials(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email)}
                  </div>
                  <div className="admin-chat-user-info">
                    <div className="admin-chat-user-name">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : user.email || `Пользователь #${user.id}`}
                    </div>
                    <div className="admin-chat-user-role">{user.role || 'user'}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Window */}
          <div className="admin-chat-window">
            {!selectedUser ? (
              <div className="admin-chat-empty">
                Выберите пользователя, чтобы начать переписку
              </div>
            ) : (
              <>
                <div className="admin-chat-header">
                  {selectedUser.first_name || selectedUser.last_name
                    ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim()
                    : selectedUser.email || `Пользователь #${selectedUser.id}`}
                  {' '}
                  <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                    ({selectedUser.role})
                  </span>
                </div>

                <div className="admin-chat-messages">
                  {loadingMessages && messages.length === 0 ? (
                    <div style={{ color: 'var(--admin-text-muted)', textAlign: 'center', padding: '2rem' }}>
                      Загрузка...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ color: 'var(--admin-text-muted)', textAlign: 'center', padding: '2rem' }}>
                      Нет сообщений. Начните переписку.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.is_admin || msg.sender_type === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className={`admin-chat-msg ${isAdmin ? 'sent' : 'received'}`}
                        >
                          {msg.text}
                          <div className="admin-chat-msg-meta">
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="admin-chat-input-area" onSubmit={handleSend}>
                  <textarea
                    className="admin-chat-input"
                    placeholder="Напишите сообщение..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="admin-chat-send-btn"
                    disabled={!inputText.trim() || sending}
                    title="Отправить"
                  >
                    ➤
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
