/**
 * Admin Reports Page
 * Consolidated analytics and reports for all key metrics
 */
import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import AdminLayout from '../components/AdminLayout';
import BarChart from '../components/BarChart';
import DonutChart from '../components/DonutChart';

const formatCurrency = (num) => {
  if (num === undefined || num === null) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(num);
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('ru-RU').format(num);
};

function objectToChartData(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([name, value]) => ({ name, value: Number(value) }));
}

export default function ReportsPage() {
  const { dashboardStats, loadDashboardStats, isLoading } = useAdminStore();

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  const stats = dashboardStats || {};

  const usersByRoleData = objectToChartData(stats.users_by_role);
  const usersByPlatformData = objectToChartData(stats.users_by_platform);
  const procurementsByStatusData = objectToChartData(stats.procurements_by_status);
  const paymentsByStatusData = objectToChartData(stats.payments_by_status);

  const userGrowthData = [
    { name: 'Сегодня', value: stats.new_users_today || 0 },
    { name: 'Неделя', value: stats.new_users_week || 0 },
    { name: 'Месяц', value: stats.new_users_month || 0 },
    { name: 'Всего', value: stats.total_users || 0 },
  ];

  const revenueData = [
    { name: 'Сегодня', value: Math.round(stats.revenue_today || 0) },
    { name: 'Неделя', value: Math.round(stats.revenue_week || 0) },
  ];

  const activityData = [
    { name: 'Сообщ. сегодня', value: stats.messages_today || 0 },
    { name: 'Всего сообщ.', value: stats.total_messages || 0 },
    { name: 'Платежи', value: stats.total_payments || 0 },
  ];

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Отчёты и аналитика</h1>
        </div>

        {isLoading && !dashboardStats ? (
          <div className="admin-loading">Загрузка данных...</div>
        ) : (
          <>
            {/* Summary report table */}
            <div className="admin-reports-grid">
              <div className="admin-report-card">
                <h3>Сводка по пользователям</h3>
                <table className="admin-report-table">
                  <thead>
                    <tr>
                      <th>Метрика</th>
                      <th>Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Всего пользователей</td>
                      <td>{formatNumber(stats.total_users)}</td>
                    </tr>
                    <tr>
                      <td>Новых сегодня</td>
                      <td>{formatNumber(stats.new_users_today)}</td>
                    </tr>
                    <tr>
                      <td>За неделю</td>
                      <td>{formatNumber(stats.new_users_week)}</td>
                    </tr>
                    <tr>
                      <td>За месяц</td>
                      <td>{formatNumber(stats.new_users_month)}</td>
                    </tr>
                    {usersByRoleData.map((r) => (
                      <tr key={r.name}>
                        <td>Роль: {r.name}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-report-card">
                <h3>Сводка по закупкам</h3>
                <table className="admin-report-table">
                  <thead>
                    <tr>
                      <th>Метрика</th>
                      <th>Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Всего закупок</td>
                      <td>{formatNumber(stats.total_procurements)}</td>
                    </tr>
                    <tr>
                      <td>Активных</td>
                      <td>{formatNumber(stats.active_procurements)}</td>
                    </tr>
                    <tr>
                      <td>Завершённых</td>
                      <td>{formatNumber(stats.completed_procurements)}</td>
                    </tr>
                    {procurementsByStatusData.map((r) => (
                      <tr key={r.name}>
                        <td>Статус: {r.name}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-report-card">
                <h3>Финансовый отчёт</h3>
                <table className="admin-report-table">
                  <thead>
                    <tr>
                      <th>Период</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Общий оборот</td>
                      <td>{formatCurrency(stats.total_revenue)}</td>
                    </tr>
                    <tr>
                      <td>Сегодня</td>
                      <td>{formatCurrency(stats.revenue_today)}</td>
                    </tr>
                    <tr>
                      <td>За неделю</td>
                      <td>{formatCurrency(stats.revenue_week)}</td>
                    </tr>
                    <tr>
                      <td>Всего платежей</td>
                      <td>{formatNumber(stats.total_payments)}</td>
                    </tr>
                    {paymentsByStatusData.map((r) => (
                      <tr key={r.name}>
                        <td>Статус: {r.name}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-report-card">
                <h3>Активность платформы</h3>
                <table className="admin-report-table">
                  <thead>
                    <tr>
                      <th>Метрика</th>
                      <th>Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Всего сообщений</td>
                      <td>{formatNumber(stats.total_messages)}</td>
                    </tr>
                    <tr>
                      <td>Сообщений сегодня</td>
                      <td>{formatNumber(stats.messages_today)}</td>
                    </tr>
                    {usersByPlatformData.map((r) => (
                      <tr key={r.name}>
                        <td>Платформа: {r.name}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Section */}
            <section className="admin-section admin-report-section">
              <h2 className="admin-section-title">Графики</h2>

              <div className="admin-charts-row">
                <div className="admin-chart-card">
                  <h3 className="admin-chart-title">Рост пользователей</h3>
                  <BarChart data={userGrowthData} color="#2563eb" />
                </div>
                {usersByRoleData.length > 0 && (
                  <div className="admin-chart-card">
                    <h3 className="admin-chart-title">Пользователи по ролям</h3>
                    <DonutChart data={usersByRoleData} size={200} />
                  </div>
                )}
                {usersByPlatformData.length > 0 && (
                  <div className="admin-chart-card">
                    <h3 className="admin-chart-title">По платформам</h3>
                    <DonutChart data={usersByPlatformData} size={200} />
                  </div>
                )}
              </div>

              <div className="admin-charts-row">
                <div className="admin-chart-card">
                  <h3 className="admin-chart-title">Динамика выручки (руб.)</h3>
                  <BarChart data={revenueData} color="#d97706" />
                </div>
                {procurementsByStatusData.length > 0 && (
                  <div className="admin-chart-card">
                    <h3 className="admin-chart-title">Закупки по статусам</h3>
                    <DonutChart data={procurementsByStatusData} size={200} />
                  </div>
                )}
                <div className="admin-chart-card">
                  <h3 className="admin-chart-title">Активность</h3>
                  <BarChart data={activityData} color="#16a34a" />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
