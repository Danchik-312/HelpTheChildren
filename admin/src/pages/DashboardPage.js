import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import styles from './DashboardPage.module.css';

const countCards = [
  ['published', 'Опубликовано', 'Всего доступных материалов'],
  ['drafts', 'Черновики', 'Ожидают завершения'],
  ['children', 'Дети', 'Карточек в системе'],
  ['projects', 'Проекты', 'Проектов и программ'],
];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = value => value ? dateFormatter.format(new Date(value)) : 'Дата не указана';

export default function DashboardPage() {
  const { hasArea } = useAuth();
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const load = useCallback(async () => {
    setState(current => ({ ...current, status: 'loading', error: '' }));
    try {
      const data = await apiRequest('/admin/dashboard');
      setState({ status: 'success', data, error: '' });
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => { document.title = 'Обзор — Панель управления'; load(); }, [load]);

  if (state.status === 'loading') return <DashboardSkeleton />;
  if (state.status === 'error') return <div className={styles.message} role="alert"><h2>Не удалось загрузить Dashboard</h2><p>{state.error}</p><button onClick={load}>Повторить</button></div>;

  const { counts = {}, recentChanges = [], recentPublished = [] } = state.data || {};
  return (
    <div className={styles.dashboard}>
      <div className={styles.intro}>
        <div><p className={styles.kicker}>Сводка сайта</p><h2>Главное на сегодня</h2><p>Актуальные показатели загружены с сервера.</p></div>
        {hasArea('PUBLICATIONS') && <Link className={styles.primaryAction} to="/publications/new">Создать публикацию</Link>}
      </div>
      <section className={styles.cards} aria-label="Статистика">
        {countCards.map(([key, label, note]) => <article className={styles.card} key={key}><span>{label}</span><strong>{Number.isFinite(counts[key]) ? counts[key] : '—'}</strong><small>{note}</small></article>)}
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Последние изменения</h2><p>Недавние действия с контентом</p></div></div>
          {recentChanges.length ? <ul className={styles.list}>{recentChanges.map(item => <li key={item.id}><div><strong>{item.summary || item.action || 'Изменение материала'}</strong><span>{item.entityType}{item.actor?.displayName ? ` · ${item.actor.displayName}` : ''}</span></div><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>)}</ul> : <EmptyState text="Изменений пока нет." />}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Последние публикации</h2><p>Недавно опубликованные материалы</p></div>{hasArea('PUBLICATIONS') && <Link to="/publications">Все материалы</Link>}</div>
          {recentPublished.length ? <ul className={styles.list}>{recentPublished.map(item => <li key={item.id}><div><strong>{item.title}</strong><span>{item.kind === 'NEWS' ? 'Новость' : 'Статья'}</span></div><time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time></li>)}</ul> : <EmptyState text="Опубликованных материалов пока нет." />}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text }) { return <div className={styles.empty}><span aria-hidden="true">○</span><p>{text}</p></div>; }
function DashboardSkeleton() { return <div className={styles.dashboard} aria-busy="true" aria-label="Загрузка статистики"><div className={styles.skeletonHero} /><div className={styles.cards}>{countCards.map(([, label]) => <div className={styles.skeletonCard} key={label} />)}</div><div className={styles.columns}><div className={styles.skeletonPanel} /><div className={styles.skeletonPanel} /></div></div>; }
