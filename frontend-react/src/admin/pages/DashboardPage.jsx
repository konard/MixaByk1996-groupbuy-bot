/**
 * Admin Dashboard Page
 */
import React, { useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import AdminLayout from '../components/AdminLayout';
import StatCard from '../components/StatCard';

export default function DashboardPage() {
  const { dashboardStats, loadDashboardStats, isLoading } = useAdminStore();

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  if (isLoading && !dashboardStats) {
    return (
      <AdminLayout>
        <div className="admin-loading">Загрузка...</div>
      </AdminLayout>
    );
  }

  const stats = dashboardStats || {};

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  const formatCurrency = (num) => {
    if (num === undefined || num === null) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <h1 className="admin-page-title">Дашборд</h1>

        {/* Users Section */}
        <section className="admin-section">
          <h2 className="admin-section-title">Пользователи</h2>
          <div className="admin-stat-grid">
            <StatCard
              label="Всего пользователей"
              value={formatNumber(stats.total_users)}
              icon="👥"
              color="primary"
            />
            <StatCard
              label="Новых сегодня"
              value={formatNumber(stats.new_users_today)}
              icon="📈"
              color="success"
            />
            <StatCard
              label="За неделю"
              value={formatNumber(stats.new_users_week)}
              icon="📊"
              color="info"
            />
            <StatCard
              label="За месяц"
              value={formatNumber(stats.new_users_month)}
              icon="📅"
              color="info"
            />
          </div>

          {stats.users_by_role && (
            <div className="admin-stat-breakdown">
              <h3>По ролям:</h3>
              <div className="admin-stat-tags">
                {Object.entries(stats.users_by_role).map(([role, count]) => (
                  <span key={role} className="admin-stat-tag">
                    {role}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.users_by_platform && (
            <div className="admin-stat-breakdown">
              <h3>По платформам:</h3>
              <div className="admin-stat-tags">
                {Object.entries(stats.users_by_platform).map(([platform, count]) => (
                  <span key={platform} className="admin-stat-tag">
                    {platform}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Procurements Section */}
        <section className="admin-section">
          <h2 className="admin-section-title">Закупки</h2>
          <div className="admin-stat-grid">
            <StatCard
              label="Всего закупок"
              value={formatNumber(stats.total_procurements)}
              icon="🛒"
              color="primary"
            />
            <StatCard
              label="Активных"
              value={formatNumber(stats.active_procurements)}
              icon="✅"
              color="success"
            />
            <StatCard
              label="Завершенных"
              value={formatNumber(stats.completed_procurements)}
              icon="🏁"
              color="info"
            />
          </div>

          {stats.procurements_by_status && (
            <div className="admin-stat-breakdown">
              <h3>По статусам:</h3>
              <div className="admin-stat-tags">
                {Object.entries(stats.procurements_by_status).map(([status, count]) => (
                  <span key={status} className="admin-stat-tag">
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Payments Section */}
        <section className="admin-section">
          <h2 className="admin-section-title">Платежи</h2>
          <div className="admin-stat-grid">
            <StatCard
              label="Всего платежей"
              value={formatNumber(stats.total_payments)}
              icon="💳"
              color="primary"
            />
            <StatCard
              label="Общий оборот"
              value={formatCurrency(stats.total_revenue)}
              icon="💰"
              color="success"
            />
            <StatCard
              label="Сегодня"
              value={formatCurrency(stats.revenue_today)}
              icon="📈"
              color="info"
            />
            <StatCard
              label="За неделю"
              value={formatCurrency(stats.revenue_week)}
              icon="📊"
              color="info"
            />
          </div>

          {stats.payments_by_status && (
            <div className="admin-stat-breakdown">
              <h3>По статусам:</h3>
              <div className="admin-stat-tags">
                {Object.entries(stats.payments_by_status).map(([status, count]) => (
                  <span key={status} className="admin-stat-tag">
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Activity Section */}
        <section className="admin-section">
          <h2 className="admin-section-title">Активность</h2>
          <div className="admin-stat-grid">
            <StatCard
              label="Всего сообщений"
              value={formatNumber(stats.total_messages)}
              icon="💬"
              color="primary"
            />
            <StatCard
              label="Сообщений сегодня"
              value={formatNumber(stats.messages_today)}
              icon="📨"
              color="success"
            />
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
