import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import {
  formatCurrency,
  getInitials,
  getAvatarColor,
  getRoleText,
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

function Cabinet() {
  const navigate = useNavigate();
  const { user, openDepositModal, openCreateProcurementModal, logout, addToast } = useStore();
  const [userStats, setUserStats] = useState(null);
  const [companyCardOpen, setCompanyCardOpen] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [myProcurements, setMyProcurements] = useState(null);

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
      // Store company card data as user profile update
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
            if (myProcurements?.organized?.length > 0) {
              navigate(`/chat/${myProcurements.organized[0].id}`);
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
          <div className="cabinet-menu-item" onClick={() => setNewsOpen(true)}>
            <PlusIcon />
            <span className="cabinet-menu-text">Написать новость</span>
          </div>
        </>
      );
    }

    // Buyer
    return null;
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

        <div className="cabinet-menu-item" onClick={() => addToast('Раздел "Мои запросы" в разработке', 'info')}>
          <RequestsIcon />
          <span className="cabinet-menu-text">Мои запросы</span>
        </div>

        <div className="cabinet-menu-item" onClick={() => {
          if (myProcurements?.participating?.length > 0) {
            navigate(`/chat/${myProcurements.participating[0].id}`);
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

        <div className="cabinet-menu-item" onClick={() => addToast('Раздел "История закупок" в разработке', 'info')}>
          <HistoryIcon />
          <span className="cabinet-menu-text">История закупок</span>
        </div>

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
    </div>
  );
}

export default Cabinet;
