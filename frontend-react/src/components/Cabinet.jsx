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
  SearchIcon,
} from './Icons';
import CompanyCardModal from './CompanyCardModal';
import PriceListModal from './PriceListModal';
import NewsModal from './NewsModal';
import WithdrawModal from './WithdrawModal';
import CreateRequestModal from './CreateRequestModal';
import ClosingDocumentsModal from './ClosingDocumentsModal';

// Category slider items per role
const ORGANIZER_SLIDER_ITEMS = ['Биржа', 'Езда', 'Быт', 'Отдых', 'Общение', 'Публичные чаты'];
const BUYER_SLIDER_ITEMS = ['Биржа', 'Езда', 'Быт', 'Отдых', 'Жилье', 'Публичные чаты'];

function CategorySlider({ items, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      scrollbarWidth: 'none',
    }}>
      {items.map((item) => (
        <button
          key={item}
          className="btn btn-outline btn-round"
          style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          onClick={() => onSelect && onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function TopActionButtons({ buttons }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.4rem',
      padding: '0.5rem 1rem 0',
      flexWrap: 'wrap',
    }}>
      {buttons.map(({ label, icon, onClick }) => (
        <button
          key={label}
          className="btn btn-icon"
          title={label}
          onClick={onClick}
          style={{ fontSize: '0.75rem', minWidth: '2rem', minHeight: '2rem' }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

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
  // Slider/page swap state (for supplier top button)
  const [sliderOnTop, setSliderOnTop] = useState(true);

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

  const handleCategorySelect = (category) => {
    addToast(`Категория: ${category}`, 'info');
  };

  if (!user) {
    return (
      <div className="cabinet flex flex-col items-center justify-center" style={{ flex: 1 }}>
        <p className="text-muted">Войдите для доступа к личному кабинету</p>
      </div>
    );
  }

  const renderSupplierCabinet = () => (
    <>
      {/* Top-right 5 action buttons */}
      <TopActionButtons buttons={[
        {
          label: 'Баланс',
          icon: <span style={{ fontSize: '0.9rem' }}>💳</span>,
          onClick: openDepositModal,
        },
        {
          label: 'Скачать приложение',
          icon: <span style={{ fontSize: '0.9rem' }}>📱</span>,
          onClick: () => addToast('Скачать приложение', 'info'),
        },
        {
          label: 'Скачать Mesh приложение',
          icon: <span style={{ fontSize: '0.9rem' }}>🔗</span>,
          onClick: () => addToast('Скачать Mesh приложение', 'info'),
        },
        {
          label: 'Хотелки (улучшения сервиса)',
          icon: <span style={{ fontSize: '0.9rem' }}>☭</span>,
          onClick: () => addToast('Приём предложений по улучшению сервиса', 'info'),
        },
        {
          label: 'Поменять местами слайдер и страницу',
          icon: <span style={{ fontSize: '0.9rem' }}>⇅</span>,
          onClick: () => setSliderOnTop((v) => !v),
        },
      ]} />

      {/* Slider: news and subscriptions */}
      <div style={{ padding: '0.5rem 1rem 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          Новости и подписки
        </div>
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '0.5rem',
          scrollbarWidth: 'none',
        }}>
          {['Новости', 'Подписки', 'Акции', 'Обновления'].map((item) => (
            <button
              key={item}
              className="btn btn-outline btn-round"
              style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={() => addToast(`${item}: раздел в разработке`, 'info')}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Page buttons */}
      <div className="cabinet-menu">
        <div className="cabinet-menu-item" onClick={() => setCompanyCardOpen(true)}>
          <HomeIcon />
          <span className="cabinet-menu-text">Карта компании</span>
        </div>
        <div className="cabinet-menu-item" onClick={() => setPriceListOpen(true)}>
          <FileIcon />
          <span className="cabinet-menu-text">Загрузить прайс лист</span>
        </div>
        <div className="cabinet-menu-item" onClick={() => setNewsOpen(true)}>
          <PlusIcon />
          <span className="cabinet-menu-text">Создать новость</span>
        </div>
        <div
          className="cabinet-menu-item"
          onClick={handleOpenOrderTables}
        >
          <ShoppingBagIcon />
          <span className="cabinet-menu-text">Текущие отгрузки</span>
          {orderTables.length > 0 && (
            <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{orderTables.length}</span>
          )}
        </div>
        {activeSection === 'orderTables' && (
          <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {orderTables.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>Нет текущих отгрузок</p>
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
          onClick={() => addToast('В ожидании: раздел в разработке', 'info')}
        >
          <HistoryIcon />
          <span className="cabinet-menu-text">В ожидании</span>
        </div>
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
        <div className="cabinet-menu-item" onClick={() => addToast('Раздел "Приглашения и сообщения" в разработке', 'info')}>
          <MailIcon />
          <span className="cabinet-menu-text">Приглашения и сообщения</span>
        </div>
      </div>
    </>
  );

  const renderOrganizerCabinet = () => {
    const activeProcurements = myProcurements?.organized?.filter((p) => p.status === 'active') || [];

    return (
      <>
        {/* Top: slider with category buttons + 5 action buttons */}
        <CategorySlider items={ORGANIZER_SLIDER_ITEMS} onSelect={handleCategorySelect} />
        <TopActionButtons buttons={[
          {
            label: 'Баланс',
            icon: <span style={{ fontSize: '0.9rem' }}>💳</span>,
            onClick: openDepositModal,
          },
          {
            label: 'Скачать приложение',
            icon: <span style={{ fontSize: '0.9rem' }}>📱</span>,
            onClick: () => addToast('Скачать приложение', 'info'),
          },
          {
            label: 'Скачать Mesh приложение',
            icon: <span style={{ fontSize: '0.9rem' }}>🔗</span>,
            onClick: () => addToast('Скачать Mesh приложение', 'info'),
          },
          {
            label: 'Хотелки (улучшения сервиса)',
            icon: <span style={{ fontSize: '0.9rem' }}>☭</span>,
            onClick: () => addToast('Приём предложений по улучшению сервиса', 'info'),
          },
          {
            label: 'Поменять местами слайдер и страницу',
            icon: <span style={{ fontSize: '0.9rem' }}>⇅</span>,
            onClick: () => setSliderOnTop((v) => !v),
          },
        ]} />

        {/* Page buttons */}
        <div className="cabinet-menu">
          <div className="cabinet-menu-item" onClick={() => {
            if (activeProcurements.length > 0) {
              navigate(`/chat/${activeProcurements[0].id}`);
            } else {
              addToast('Нет открытых закупок', 'info');
            }
          }}>
            <ShoppingBagIcon />
            <span className="cabinet-menu-text">Текущие закупки</span>
            {activeProcurements.length > 0 && (
              <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>{activeProcurements.length}</span>
            )}
          </div>
          <div className="cabinet-menu-item" onClick={() => setNewsOpen(true)}>
            <PlusIcon />
            <span className="cabinet-menu-text">Создать новость</span>
          </div>
          <div className="cabinet-menu-item" onClick={openCreateProcurementModal}>
            <PlusIcon />
            <span className="cabinet-menu-text">Создать закупку</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => navigate('/')}>
            <SearchIcon className="cabinet-menu-icon" />
            <span className="cabinet-menu-text">Поиск</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => addToast('Бот Авито: в разработке', 'info')}>
            <span className="cabinet-menu-icon" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>А</span>
            <span className="cabinet-menu-text">Бот Авито</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => addToast('Бот ВКонтакте: в разработке', 'info')}>
            <span className="cabinet-menu-icon" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ВК</span>
            <span className="cabinet-menu-text">Бот ВК</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => addToast('Бот Telegram: в разработке', 'info')}>
            <span className="cabinet-menu-icon" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>TG</span>
            <span className="cabinet-menu-text">Бот телега</span>
          </div>
          <div className="cabinet-menu-item" onClick={() => {
            if (activeProcurements.length > 0) {
              navigate(`/chat/${activeProcurements[0].id}`);
            } else {
              addToast('Нет активных чатов закупок', 'info');
            }
          }}>
            <RequestsIcon />
            <span className="cabinet-menu-text">Чаты</span>
          </div>

          {/* Закупки в стадии оплаты */}
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

          {/* История закупок */}
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
          {activeSection === 'history' && renderProcurementHistory()}
        </div>
      </>
    );
  };

  const renderBuyerCabinet = () => (
    <>
      {/* Top: slider with category buttons + 5 action buttons */}
      <CategorySlider items={BUYER_SLIDER_ITEMS} onSelect={handleCategorySelect} />
      <TopActionButtons buttons={[
        {
          label: 'Баланс',
          icon: <span style={{ fontSize: '0.9rem' }}>💳</span>,
          onClick: openDepositModal,
        },
        {
          label: 'Скачать приложение',
          icon: <span style={{ fontSize: '0.9rem' }}>📱</span>,
          onClick: () => addToast('Скачать приложение', 'info'),
        },
        {
          label: 'Скачать Mesh приложение',
          icon: <span style={{ fontSize: '0.9rem' }}>🔗</span>,
          onClick: () => addToast('Скачать Mesh приложение', 'info'),
        },
        {
          label: 'Хотелки (улучшения сервиса)',
          icon: <span style={{ fontSize: '0.9rem' }}>☭</span>,
          onClick: () => addToast('Приём предложений по улучшению сервиса', 'info'),
        },
        {
          label: 'Поменять местами слайдер и страницу',
          icon: <span style={{ fontSize: '0.9rem' }}>⇅</span>,
          onClick: () => setSliderOnTop((v) => !v),
        },
      ]} />

      {/* Page buttons */}
      <div className="cabinet-menu">
        <div className="cabinet-menu-item" onClick={() => setCreateRequestOpen(true)}>
          <PlusIcon />
          <span className="cabinet-menu-text">Создать запрос</span>
        </div>
        <div className="cabinet-menu-item" onClick={() => {
          const procList = myProcurements?.participating || [];
          if (procList.length > 0) {
            navigate(`/chat/${procList[0].id}`);
          } else {
            addToast('Вы не участвуете ни в одной закупке', 'info');
          }
        }}>
          <ShoppingBagIcon />
          <span className="cabinet-menu-text">Текущие закупки</span>
          {myProcurements?.participating?.filter((p) => ['active', 'stopped', 'payment'].includes(p.status)).length > 0 && (
            <span style={{ background: 'var(--primary-color,#3390ec)', color:'#fff', borderRadius:'1rem', fontSize:'0.7rem', padding:'0 0.4rem', minWidth:'1.2rem', textAlign:'center' }}>
              {myProcurements.participating.filter((p) => ['active', 'stopped', 'payment'].includes(p.status)).length}
            </span>
          )}
        </div>
        <div className="cabinet-menu-item" onClick={() => addToast('Подписки: раздел в разработке', 'info')}>
          <HistoryIcon />
          <span className="cabinet-menu-text">Подписки</span>
        </div>
        <div className="cabinet-menu-item" onClick={() => addToast('Сообщения: раздел в разработке', 'info')}>
          <MailIcon />
          <span className="cabinet-menu-text">Сообщения</span>
        </div>

        {/* История закупок */}
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
        {activeSection === 'history' && renderProcurementHistory()}

        <div className="cabinet-menu-item" onClick={() => navigate('/')}>
          <SearchIcon className="cabinet-menu-icon" />
          <span className="cabinet-menu-text">Поиск</span>
        </div>

        {/* Категории недвижимости / авто / стройка */}
        {['Жилье', 'Авто', 'Стройка', 'Движимость'].map((cat) => (
          <div
            key={cat}
            className="cabinet-menu-item"
            onClick={() => addToast(`${cat}: раздел в разработке`, 'info')}
          >
            <HomeIcon />
            <span className="cabinet-menu-text">{cat}</span>
          </div>
        ))}

        {/* Мои запросы */}
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
            <button
              className="btn btn-primary btn-round"
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', marginBottom: '0.5rem', alignSelf: 'flex-start' }}
              onClick={() => setCreateRequestOpen(true)}
            >
              + Создать запрос
            </button>
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
      </div>
    </>
  );

  const renderProcurementHistory = () => (
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
  );

  const renderRoleContent = () => {
    if (user.role === 'supplier') return renderSupplierCabinet();
    if (user.role === 'organizer') return renderOrganizerCabinet();
    return renderBuyerCabinet();
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

      {/* Role-specific content */}
      {renderRoleContent()}

      {/* Logout button at the bottom */}
      <div className="cabinet-menu" style={{ marginTop: 0 }}>
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
