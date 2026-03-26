import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function UnderDevelopmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'Раздел';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      textAlign: 'center',
      gap: '1rem',
    }}>
      <div style={{
        fontSize: '3rem',
        lineHeight: 1,
      }}>
        🔧
      </div>
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary, #000)',
        margin: 0,
      }}>
        Страница находится в разработке
      </h2>
      <p style={{
        fontSize: '0.9rem',
        color: 'var(--text-secondary, #8e99a4)',
        margin: 0,
        maxWidth: '20rem',
      }}>
        Раздел «{section}» скоро будет доступен. Мы работаем над его реализацией.
      </p>
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
