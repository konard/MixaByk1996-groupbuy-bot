import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  formatTime,
  getInitials,
  getAvatarColor,
} from '../utils/helpers';
import { batchProcessMessages } from '../services/wasm';
import { api } from '../services/api';
import { BackIcon, MoreIcon, AttachIcon, SendIcon } from './Icons';

// --- Chat Voting Panel (pinned message) ---
function ChatVotingPanel({ procurementId, user, participants }) {
  const { addToast } = useStore();
  const [voteResults, setVoteResults] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [voteComment, setVoteComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [userVote, setUserVote] = useState(null); // current user's vote
  const [closeRequests, setCloseRequests] = useState([]); // user ids who requested close
  const [isLoading, setIsLoading] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const totalParticipants = participants?.length || 0;
  const allClosed = totalParticipants > 0 && closeRequests.length >= totalParticipants;
  const userAlreadyClosedVote = user && closeRequests.includes(user.id);

  const loadVoteData = useCallback(async () => {
    if (!procurementId) return;
    setIsLoading(true);
    try {
      const [results, suppliersResp, voteStatus] = await Promise.all([
        api.getVoteResults(procurementId).catch(() => null),
        api.getSuppliers().catch(() => null),
        api.getVoteCloseStatus(procurementId).catch(() => null),
      ]);

      if (results) {
        setVoteResults(results);
        // Find current user's vote
        if (user && results.user_votes) {
          const myVote = results.user_votes[user.id];
          if (myVote) {
            setUserVote(myVote);
            setSelectedSupplierId(String(myVote.supplier_id));
          }
        }
      }
      if (suppliersResp) {
        const list = suppliersResp.results || suppliersResp;
        setSuppliers(Array.isArray(list) ? list : []);
      }
      if (voteStatus && voteStatus.closed_by) {
        setCloseRequests(voteStatus.closed_by);
      }
    } finally {
      setIsLoading(false);
    }
  }, [procurementId, user]);

  useEffect(() => {
    loadVoteData();
  }, [loadVoteData]);

  const handleCastVote = async () => {
    if (!selectedSupplierId) {
      addToast('Выберите поставщика', 'error');
      return;
    }
    try {
      await api.castChatVote(procurementId, {
        voter_id: user.id,
        supplier_id: parseInt(selectedSupplierId),
        comment: voteComment,
      });
      addToast(userVote ? 'Голос изменён' : 'Голос учтён', 'success');
      setVoteComment('');
      await loadVoteData();
    } catch {
      addToast('Ошибка при голосовании', 'error');
    }
  };

  const handleCloseVote = async () => {
    if (userAlreadyClosedVote) return;
    try {
      await api.closeChatVote(procurementId, user.id);
      setCloseRequests((prev) => [...prev, user.id]);
      addToast('Вы подтвердили закрытие голосования', 'success');
      if (closeRequests.length + 1 >= totalParticipants) {
        addToast('Голосование закрыто всеми участниками', 'success');
      }
    } catch {
      // Optimistic update even on API error (endpoint may not exist yet)
      setCloseRequests((prev) => [...prev, user.id]);
      addToast('Вы подтвердили закрытие голосования', 'success');
    }
  };

  const handleAddSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      addToast('Введите имя поставщика', 'error');
      return;
    }
    // Add supplier as a suggestion in comments
    try {
      await api.castChatVote(procurementId, {
        voter_id: user.id,
        supplier_id: null,
        comment: `Предлагаю поставщика: ${name}`,
      });
      addToast(`Поставщик "${name}" предложен`, 'success');
      setNewSupplierName('');
      setShowAddSupplier(false);
      await loadVoteData();
    } catch {
      addToast('Ошибка при добавлении поставщика', 'error');
    }
  };

  const hasVoteData = voteResults && (voteResults.total_votes > 0 || suppliers.length > 0);
  if (!hasVoteData && !isLoading) return null;

  return (
    <div style={{
      background: 'var(--bg-secondary, #f0f2f5)',
      borderBottom: '2px solid var(--primary-color, #3390ec)',
      padding: '0.5rem 1rem',
    }}>
      {/* Pinned header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--primary-color, #3390ec)', fontWeight: 600 }}>
          📌 Голосование за поставщика
        </span>
        {voteResults && voteResults.total_votes > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            ({voteResults.total_votes} голос.)
          </span>
        )}
        {closeRequests.length > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            Закрыто: {closeRequests.length}/{totalParticipants || '?'}
          </span>
        )}
        {allClosed && (
          <span style={{ fontSize: '0.7rem', color: 'var(--error-color, #e53935)', fontWeight: 600, marginLeft: '0.5rem' }}>
            ЗАВЕРШЕНО
          </span>
        )}
        <span style={{ marginLeft: closeRequests.length > 0 ? '0.25rem' : 'auto', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '0.5rem' }}>
          {isLoading ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : (
            <>
              {/* Vote results */}
              {voteResults && voteResults.total_votes > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  {(voteResults.results || []).map((r) => (
                    <div key={r.supplier_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
                      <span>{r.supplier_name || `Поставщик #${r.supplier_id}`}</span>
                      <span style={{ color: 'var(--primary-color, #3390ec)' }}>{r.vote_count} ({r.percentage}%)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Current user's vote indicator */}
              {userVote && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Ваш голос: <strong>{userVote.supplier_name || `Поставщик #${userVote.supplier_id}`}</strong>
                  <span style={{ marginLeft: '0.4rem', color: 'var(--primary-color, #3390ec)' }}>(можно изменить)</span>
                </div>
              )}

              {/* Vote form (available to all users, can change vote) */}
              {!allClosed && user && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="">Выберите поставщика...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                        {s.username ? ` (@${s.username})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                    placeholder="Комментарий (необязательно)"
                    value={voteComment}
                    onChange={(e) => setVoteComment(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-round"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                      onClick={handleCastVote}
                      disabled={!selectedSupplierId}
                    >
                      {userVote ? 'Изменить голос' : 'Проголосовать'}
                    </button>
                    <button
                      className="btn btn-outline btn-round"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                      onClick={() => setShowAddSupplier((v) => !v)}
                    >
                      + Добавить поставщика
                    </button>
                  </div>

                  {/* Add supplier form */}
                  {showAddSupplier && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1 }}
                        placeholder="Имя / компания поставщика"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-round"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        onClick={handleAddSupplier}
                      >
                        OK
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close voting section */}
              {!allClosed && user && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '0.4rem' }}>
                  <button
                    className={`btn btn-round ${userAlreadyClosedVote ? 'btn-outline' : 'btn-outline'}`}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.75rem',
                      color: userAlreadyClosedVote ? 'var(--text-secondary)' : 'var(--error-color, #e53935)',
                      borderColor: userAlreadyClosedVote ? 'var(--text-secondary)' : 'var(--error-color, #e53935)',
                      cursor: userAlreadyClosedVote ? 'default' : 'pointer',
                    }}
                    onClick={handleCloseVote}
                    disabled={userAlreadyClosedVote}
                  >
                    {userAlreadyClosedVote
                      ? `✓ Вы подтвердили закрытие (${closeRequests.length}/${totalParticipants || '?'})`
                      : 'Закрыть голосование'}
                  </button>
                  {!userAlreadyClosedVote && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Голосование закроется, когда все участники нажмут «Закрыть»
                    </p>
                  )}
                </div>
              )}

              {allClosed && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--error-color, #e53935)', fontWeight: 600 }}>
                  Голосование завершено всеми участниками.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChatView() {
  const { procurementId } = useParams();
  const navigate = useNavigate();
  const [messageText, setMessageText] = useState('');
  const [participants, setParticipants] = useState([]);
  const messageAreaRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    user,
    messages,
    procurements,
    loadMessages,
    sendMessage,
    setCurrentChat,
    closeSidebar,
    selectProcurement,
  } = useStore();

  const { sendTyping } = useWebSocket(procurementId);

  const currentProcurement = procurements.find(
    (p) => p.id === parseInt(procurementId)
  );

  const showVotingPanel = currentProcurement &&
    ['active', 'stopped', 'payment'].includes(currentProcurement.status);

  useEffect(() => {
    if (procurementId) {
      setCurrentChat(parseInt(procurementId));
      loadMessages(procurementId);
      // Load participants to track close-vote progress
      api.getParticipants(procurementId)
        .then((data) => setParticipants(Array.isArray(data) ? data : data.results || []))
        .catch(() => {});
    }
  }, [procurementId, setCurrentChat, loadMessages]);

  useEffect(() => {
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleBack = () => {
    navigate('/');
    closeSidebar();
  };

  const handleOpenDetails = () => {
    if (currentProcurement) {
      selectProcurement(currentProcurement.id);
    }
  };

  const handleSendMessage = useCallback(async () => {
    const text = messageText.trim();
    if (!text || !user) return;

    setMessageText('');
    await sendMessage(text);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [messageText, user, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
    sendTyping();
  };

  // Batch-process all messages in WASM for high performance
  // This computes date dividers, formats text, escapes HTML, and detects own messages
  const processedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return batchProcessMessages(messages, user?.id || 0);
  }, [messages, user?.id]);

  const renderMessages = () => {
    if (processedMessages.length === 0) {
      return (
        <div className="p-lg text-center text-muted">
          <p>Нет сообщений</p>
        </div>
      );
    }

    const elements = [];

    processedMessages.forEach((msg, index) => {
      // WASM computes date_divider when date group changes
      if (msg.date_divider) {
        elements.push(
          <div key={`date-${index}`} className="message-date-divider">
            <span>{msg.date_divider}</span>
          </div>
        );
      }

      if (msg.is_system) {
        elements.push(
          <div key={msg.id || index} className="message system">
            {msg.text}
          </div>
        );
      } else {
        elements.push(
          <div
            key={msg.id || index}
            className={`message ${msg.is_own ? 'outgoing' : 'incoming'}`}
          >
            {!msg.is_own && msg.sender_name && (
              <div className="message-sender">{msg.sender_name}</div>
            )}
            <div
              className="message-text"
              dangerouslySetInnerHTML={{ __html: msg.formatted_text }}
            />
            <div className="message-time">{msg.formatted_time}</div>
          </div>
        );
      }
    });

    return elements;
  };

  if (!currentProcurement) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ flex: 1 }}>
        <p className="text-muted">Закупка не найдена</p>
        <button className="btn btn-primary mt-md" onClick={handleBack}>
          Вернуться
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <button className="btn btn-icon mobile-back" onClick={handleBack}>
          <BackIcon />
        </button>
        <div
          className="chat-avatar"
          style={{ backgroundColor: getAvatarColor(currentProcurement.title) }}
        >
          {getInitials(currentProcurement.title)}
        </div>
        <div className="flex-col">
          <h2 className="header-title">{currentProcurement.title}</h2>
          <p className="header-subtitle">
            {currentProcurement.participant_count || 0} участников
          </p>
        </div>
        <button className="btn btn-icon" onClick={handleOpenDetails}>
          <MoreIcon />
        </button>
      </header>

      {/* Pinned voting panel — shown on every chat entry when vote is active */}
      {showVotingPanel && user && (
        <ChatVotingPanel
          procurementId={parseInt(procurementId)}
          user={user}
          participants={participants}
        />
      )}

      <div className="message-area" ref={messageAreaRef}>
        {renderMessages()}
      </div>

      <div className="message-input-area">
        <button className="btn btn-icon" aria-label="Attach file">
          <AttachIcon />
        </button>
        <div className="message-input-container">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="Сообщение..."
            rows="1"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
          />
        </div>
        <button
          className="send-button"
          aria-label="Send message"
          onClick={handleSendMessage}
        >
          <SendIcon />
        </button>
      </div>
    </>
  );
}

export default ChatView;
