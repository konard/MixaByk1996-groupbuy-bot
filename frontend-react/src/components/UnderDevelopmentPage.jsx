import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Map section names to descriptive info about what will be available
const SECTION_INFO = {
  'Подписки': {
    icon: '🔔',
    description: 'Управляйте подписками на категории и организаторов. Получайте уведомления о новых закупках по вашим интересам.',
  },
  'Сообщения': {
    icon: '✉️',
    description: 'Личные сообщения между участниками платформы. Общайтесь напрямую с организаторами и покупателями.',
  },
  'В ожидании': {
    icon: '⏳',
    description: 'Список закупок, ожидающих вашего участия или подтверждения. Отслеживайте статусы заявок.',
  },
  'Приглашения и сообщения': {
    icon: '📨',
    description: 'Приглашения в закупки и личные сообщения от других участников платформы.',
  },
  'Бот Авито': {
    icon: 'А',
    iconStyle: { fontWeight: 700, fontSize: '2rem', color: '#00aaff' },
    description: 'Интеграция с Авито позволит публиковать закупки и принимать заявки напрямую через объявления.',
  },
  'Бот ВКонтакте': {
    icon: 'ВК',
    iconStyle: { fontWeight: 700, fontSize: '1.5rem', color: '#0077ff' },
    description: 'Бот для ВКонтакте позволит управлять закупками прямо из VK-сообщества или личных сообщений.',
  },
  'Бот Telegram': {
    icon: 'TG',
    iconStyle: { fontWeight: 700, fontSize: '1.5rem', color: '#229ed9' },
    description: 'Telegram-бот для быстрого управления закупками и получения уведомлений прямо в мессенджере.',
  },
};

function UnderDevelopmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'Раздел';

  const info = SECTION_INFO[section] || {};
  const icon = info.icon || '🔧';
  const iconStyle = info.iconStyle || { fontSize: '3rem' };
  const description =
    info.description ||
    `Раздел «${section}» скоро будет доступен. Мы работаем над его реализацией.`;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      textAlign: 'center',
      gap: '1rem',
    }}>
      <div style={{
        width: '4rem',
        height: '4rem',
        borderRadius: '50%',
        background: 'var(--bg-secondary, #f0f2f5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...iconStyle,
        fontSize: iconStyle.fontSize || '2rem',
      }}>
        {icon}
      </div>

      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: 600,
        color: 'var(--text-primary, #000)',
        margin: 0,
      }}>
        {section}
      </h2>

      <p style={{
        fontSize: '0.875rem',
        color: 'var(--text-secondary, #8e99a4)',
        margin: 0,
        maxWidth: '22rem',
        lineHeight: 1.5,
      }}>
        {description}
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'var(--bg-secondary, #f0f2f5)',
        borderRadius: '2rem',
        padding: '0.4rem 1rem',
        fontSize: '0.8rem',
        color: 'var(--text-secondary, #8e99a4)',
        marginTop: '0.25rem',
      }}>
        <span>🔧</span>
        <span>В разработке</span>
      </div>

      <button
        className="btn btn-primary btn-round"
        style={{ marginTop: '0.5rem' }}
        onClick={() => navigate(-1)}
      >
        Назад
      </button>
    </div>
  );
}

export default UnderDevelopmentPage;
