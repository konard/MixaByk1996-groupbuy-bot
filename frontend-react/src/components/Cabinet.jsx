import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import {
  formatCurrency,
  formatTime,
  getInitials,
  getAvatarColor,
  getRoleText,
  getStatusText,
} from '../utils/helpers';
import {
  RequestsIcon,
  ShoppingBagIcon,
  MailIcon,
  HistoryIcon,
  PlusIcon,
  HomeIcon,
  FileIcon,
} from './Icons';
import CompanyCardModal from './CompanyCardModal';
import PriceListModal from './PriceListModal';
import NewsModal from './NewsModal';
import WithdrawModal from './WithdrawModal';
import CreateRequestModal from './CreateRequestModal';
import ClosingDocumentsModal from './ClosingDocumentsModal';

function Cabinet() {
  const navigate = useNavigate();
  const { user, openDepositModal, openCreateProcurementModal, logout, addToast } = useStore();
  const [userStats, setUserStats] = useState(null);
  const [companyCardOpen, setCompanyCardOpen] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [closingDocsOpen, setClosingDocsOpen] = useState(false);
  const [selectedOrderTableId, setSelectedOrderTableId] = useState(null);

  const [myProcurements, setMyProcurements] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [procurementHistory, setProcurementHistory] = useState([]);
  const [paymentProcurements, setPaymentProcurements] = useState([]);
  const [orderTables, setOrderTables] = useState([]);
  const [shipmentHistory, setShipmentHistory] = useState([]);

  // View state for sections
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (!user) return;
    const loadStats = async () => {
      try {
        const [balance, procurements] = await Promise.all([
          api.getUserBalance(user.id).catch(() => null),
          api.getUserProcurements(user.id).catch(() => null),
        ]);

        let organized = [];
        let participating = [];
        if (procurements) {
          if (Array.isArray(procurements)) {
            organized = procurements.filter((p) => p.organizer === user.id);
            participating = procurements.filter((p) => p.organizer !== user.id);
          } else {
            organized = procurements.organized || [];
            participating = procurements.participating || [];
          }
        }
        const procs = [...organized, ...participating];
        setMyProcurements({ organized, participating });

        // Separate payment-stage procurements for organizer
        setPaymentProcurements(organized.filter((p) => p.status === 'payment' || p.status === 'stopped'));

        // History: completed procurements
        const history = procs.filter((p) => p.status === 'completed' || p.status === 'cancelled');
        setProcurementHistory(history);

        setUserStats({
          balance: balance || {},
          procurementsCount: procs.length,
          activeProcurements: procs.filter((p) => p.status === 'active').length,
          completedProcurements: procs.filter((p) => p.status === 'completed').length,
        });
      } catch {
        // ignore stats loading errors
      }
    };
    loadStats();
  }, [user]);

  const handleSaveCompanyCard = async (data) => {
    try {
      await api.updateUser(user.id, {
        first_name: data.company_name,
        phone: data.phone,
        email: data.email,
      });
      addToast('Карточка компании сохранена', 'success');
    } catch {
      addToast('Ошибка сохранения карточки компании', 'error');
      throw new Error('Save failed');
    }
  };

  const handleSavePriceList = async (data) => {
    addToast('Прайс-лист загружен', 'success');
  };

  const handleSaveNews = async (data) => {
    addToast('Новость опубликована', 'success');
  };

  const handleSaveRequest = async (data) => {
    const newRequest = {
      id: Date.now(),
      ...data,
      created_at: new Date().toISOString(),
    };
    setMyRequests((prev) => [newRequest, ...prev]);
    addToast('Запрос успешно создан', 'success');
  };

  const handleDeleteRequest = (id) => {
    setMyRequests((prev) => prev.filter((r) => r.id !== id));
    addToast('Запрос удалён', 'info');
  };

  const handleSendClosingDocuments = async (data) => {
    addToast('Закрывающие документы отправлены покупателям', 'success');
  };

  const handleOpenOrderTables = async () => {
    setActiveSection(activeSection === 'orderTables' ? null : 'orderTables');
    if (activeSection !== 'orderTables' && orderTables.length === 0) {
      try {
        const completed = myProcurements?.organized?.filter((p) => ['payment', 'completed', 'stopped'].includes(p.status)) || [];
        const tables = await Promise.all(
          completed.map((p) =>
            api.getReceiptTable(p.id)
              .then((t) => ({ ...t, procurement_title: p.title, procurement_id: p.id }))
              .catch(() => null)
          )
        );
        setOrderTables(tables.filter(Boolean));
      } catch {
        // ignore
      }
    }
  };

  if (!user) {
    return (
      <div className="cabinet flex flex-col items-center justify-center" style={{ flex: 1 }}>
        <p className="text-muted">Войдите для доступа к личному кабинету</p>
      </div>
    );
  }

  const renderRoleItems = () => {
    if (user.role === 'organizer') {
      return (
        <>
          <div className="cabinet-menu-item" onClick={openCreateProcurementModal}>
            <PlusIcon />
            <span className="cabinet-menu-text">Создать закупку</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => {
            if (myProcurements?.organized?.filter((p) => p.status === 'active').length > 0) {
              const firstActive = myProcurements.organized.find((p) => p.status === 'active');
              navigate(`/chat/${firstActive.id}`);
            } else {
              addToast('Нет открытых закупок', 'info');
            }
          }}>
            <ShoppingBagIcon />
            <span className="cabinet-menu-text">Открытые закупки</span>
            {myProcurements?.organized?.filter((p) => p.status === 'active').length > 0 && (
              <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{myProcurements.organized.filter((p) => p.status === 'active').length}</span>
            )}
          </div>
          <div
            className="cabinet-menu-item"
            onClick={() => setActiveSection(activeSection === 'paymentProcurements' ? null : 'paymentProcurements')}
          >
            <HistoryIcon />
            <span className="cabinet-menu-text">Закупки в стадии оплаты</span>
            {paymentProcurements.length > 0 && (
              <span style={{ background: 'var(--warning-color,#f57c00)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{paymentProcurements.length}</span>
            )}
          </div>
          {activeSection === 'paymentProcurements' && (
            <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {paymentProcurements.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>Нет закупок в стадии оплаты</p>
              ) : (
                paymentProcurements.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-secondary, #f0f2f5)',
                      borderRadius: '0.5rem',
                      padding: '0.6rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                    }}
                    onClick={() => navigate(`/chat/${p.id}`)}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e99a4)' }}>
                      Остановлена: {formatTime(p.updated_at)} · {p.participant_count || 0} участн.
                    </span>
                    <span className={`status-badge status-${p.status}`} style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>
                      {getStatusText(p.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="cabinet-menu-item" onClick={() => setNewsOpen(true)}>
            <PlusIcon />
            <span className="cabinet-menu-text">Создать новость</span>
          </div>
        </>
      );
    }

    if (user.role === 'supplier') {
      return (
        <>
          <div className="cabinet-menu-item" onClick={() => setCompanyCardOpen(true)}>
            <HomeIcon />
            <span className="cabinet-menu-text">Карточка компании</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => setPriceListOpen(true)}>
            <FileIcon />
            <span className="cabinet-menu-text">Загрузить прайс-лист</span>
          </div>
          <div className="cabinet-menu-item" onClick={handleOpenOrderTables}>
            <ShoppingBagIcon />
            <span className="cabinet-menu-text">Таблица заказов</span>
          </div>
          {activeSection === 'orderTables' && (
            <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {orderTables.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>Нет таблиц заказов</p>
              ) : (
                orderTables.map((table, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg-secondary, #f0f2f5)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{table.procurement_title}</span>
                    {table.total_amount && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Сумма: {formatCurrency(table.total_amount)}
                      </span>
                    )}
                    <button
                      className="btn btn-outline btn-round"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', marginTop: '0.25rem', alignSelf: 'flex-start' }}
                      onClick={() => {
                        setSelectedOrderTableId(table.procurement_id);
                        setClosingDocsOpen(true);
                      }}
                    >
                      Отправить закрывающие документы
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          <div
            className="cabinet-menu-item"
            onClick={() => setActiveSection(activeSection === 'shipmentHistory' ? null : 'shipmentHistory')}
          >
            <HistoryIcon />
            <span className="cabinet-menu-text">История отгрузок</span>
          </div>
          {activeSection === 'shipmentHistory' && (
            <div style={{ padding: '0 1rem 0.5rem' }}>
              {shipmentHistory.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>История отгрузок пуста</p>
              ) : (
                shipmentHistory.map((s, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg-secondary, #f0f2f5)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    marginBottom: '0.4rem',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.title}</span>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="cabinet-menu-item" onClick={() => setNewsOpen(true)}>
            <PlusIcon />
            <span className="cabinet-menu-text">Написать новость</span>
          </div>
        </>
      );
    }

    // Buyer
    return (
      <>
        <div className="cabinet-menu-item" onClick={() => setCreateRequestOpen(true)}>
          <PlusIcon />
          <span className="cabinet-menu-text">Создать запрос</span>
        </div>
        <div className="cabinet-menu-item" onClick={() => navigate('/')}>
          <RequestsIcon />
          <span className="cabinet-menu-text">Поиск товаров</span>
        </div>
      </>
    );
  };

  return (
    <div className="cabinet" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="cabinet-header">
        <div
          className="cabinet-avatar"
          style={{ backgroundColor: getAvatarColor(user.first_name || '') }}
        >
          {getInitials(user.first_name, user.last_name)}
        </div>
        <div className="cabinet-info">
          <h2>
            {user.first_name} {user.last_name || ''}
          </h2>
          <div className="cabinet-role">{getRoleText(user.role)}</div>
        </div>
      </div>

      <div className="cabinet-balance">
        <div className="balance-label">Баланс</div>
        <div className="balance-amount">{formatCurrency(user.balance || 0)}</div>
        <div className="balance-actions">
          <button className="btn btn-primary btn-round" onClick={openDepositModal}>
            Пополнить
          </button>
          <button className="btn btn-outline btn-round" onClick={() => setWithdrawOpen(true)}>
            Вывести
          </button>
        </div>
      </div>

      {/* User Analytics */}
      {userStats && (
        <div className="cabinet-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          margin: '0 1rem 1rem',
        }}>
          <div style={{
            background: 'var(--bg-secondary, #f0f2f5)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{userStats.procurementsCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e99a4)' }}>Закупок</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary, #f0f2f5)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{userStats.activeProcurements}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e99a4)' }}>Активных</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary, #f0f2f5)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{userStats.completedProcurements}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e99a4)' }}>Завершённых</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary, #f0f2f5)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {formatCurrency(userStats.balance.total_deposited || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e99a4)' }}>Пополнено</div>
          </div>
        </div>
      )}

      <div className="cabinet-menu">
        {renderRoleItems()}

        {/* My Requests - for all roles but especially buyers */}
        <div
          className="cabinet-menu-item"
          onClick={() => setActiveSection(activeSection === 'myRequests' ? null : 'myRequests')}
        >
          <RequestsIcon />
          <span className="cabinet-menu-text">Мои запросы</span>
          {myRequests.length > 0 && (
            <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{myRequests.length}</span>
          )}
        </div>
        {activeSection === 'myRequests' && (
          <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {user.role === 'buyer' && (
              <button
                className="btn btn-primary btn-round"
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', marginBottom: '0.5rem', alignSelf: 'flex-start' }}
                onClick={() => setCreateRequestOpen(true)}
              >
                + Создать запрос
              </button>
            )}
            {myRequests.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>Нет активных запросов</p>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} style={{
                  background: 'var(--bg-secondary, #f0f2f5)',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{req.product_name}</span>
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, fontSize: '1rem' }}
                      title="Удалить"
                    >
                      ×
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Кол-во: {req.quantity} · Город: {req.city}
                  </span>
                  {req.notes && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{req.notes}</span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatTime(req.created_at)}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="cabinet-menu-item" onClick={() => {
          const procList = myProcurements?.participating || [];
          if (procList.length > 0) {
            navigate(`/chat/${procList[0].id}`);
          } else {
            addToast('Вы не участвуете ни в одной закупке', 'info');
          }
        }}>
          <ShoppingBagIcon />
          <span className="cabinet-menu-text">Мои закупки</span>
          {myProcurements?.participating?.filter((p) => ['active', 'stopped', 'payment'].includes(p.status)).length > 0 && (
            <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>
              {myProcurements.participating.filter((p) => ['active', 'stopped', 'payment'].includes(p.status)).length}
            </span>
          )}
        </div>

        <div className="cabinet-menu-item" onClick={() => addToast('Раздел "Сообщения" в разработке', 'info')}>
          <MailIcon />
          <span className="cabinet-menu-text">Приглашения и сообщения</span>
        </div>

        {/* History of Procurements */}
        <div
          className="cabinet-menu-item"
          onClick={() => setActiveSection(activeSection === 'history' ? null : 'history')}
        >
          <HistoryIcon />
          <span className="cabinet-menu-text">История закупок</span>
          {procurementHistory.length > 0 && (
            <span style={{ background: 'var(--text-secondary,#8e99a4)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{procurementHistory.length}</span>
          )}
        </div>
        {activeSection === 'history' && (
          <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {procurementHistory.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>История закупок пуста</p>
            ) : (
              procurementHistory.map((p) => (
                <div key={p.id} style={{
                  background: 'var(--bg-secondary, #f0f2f5)',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.title}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {p.city} · {formatCurrency(p.current_amount || 0)} / {formatCurrency(p.target_amount || 0)}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`status-badge status-${p.status}`} style={{ fontSize: '0.7rem' }}>
                      {getStatusText(p.status)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {formatTime(p.updated_at)}
                    </span>
                  </div>
                  {user.role === 'organizer' && p.organizer === user.id && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Вознаграждение: {formatCurrency((p.current_amount || 0) * ((p.commission_percent || 0) / 100))}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="cabinet-menu-item" onClick={logout}>
          <svg
            className="cabinet-menu-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="cabinet-menu-text text-error">Выйти</span>
        </div>
      </div>

      {/* Modals */}
      <CompanyCardModal
        isOpen={companyCardOpen}
        onClose={() => setCompanyCardOpen(false)}
        onSave={handleSaveCompanyCard}
      />
      <PriceListModal
        isOpen={priceListOpen}
        onClose={() => setPriceListOpen(false)}
        onSave={handleSavePriceList}
      />
      <NewsModal
        isOpen={newsOpen}
        onClose={() => setNewsOpen(false)}
        onSave={handleSaveNews}
      />
      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
      <CreateRequestModal
        isOpen={createRequestOpen}
        onClose={() => setCreateRequestOpen(false)}
        onSave={handleSaveRequest}
      />
      <ClosingDocumentsModal
        isOpen={closingDocsOpen}
        onClose={() => setClosingDocsOpen(false)}
        onSave={handleSendClosingDocuments}
        orderTableId={selectedOrderTableId}
      />
    </div>
  );
}

export default Cabinet;
