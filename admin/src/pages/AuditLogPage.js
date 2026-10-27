import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/apiClient';
import styles from './AdminUsersPage.module.css';

const ACTIONS = { CREATE: 'Создание', UPDATE: 'Изменение', PUBLISH: 'Публикация', UNPUBLISH: 'Снятие с публикации', ARCHIVE: 'Архивация', RESTORE: 'Восстановление', ACTIVE: 'Активация', DISABLED: 'Деактивация', PRIVACY_APPROVED: 'Одобрение приватности', PRIVACY_REJECTED: 'Отклонение приватности', CONSENT_REVOKED: 'Отзыв согласия' };
const ENTITIES = { Publication: 'Публикация', Story: 'История', ChildProfile: 'Карточка ребёнка', Project: 'Проект', InfoPage: 'Страница', HeroSlide: 'Hero-слайд', MediaAsset: 'Медиафайл', User: 'Пользователь', Contact: 'Контакт', Organization: 'Организация', HomeBlock: 'Блок главной' };

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], meta: { page: 1, totalPages: 1, total: 0 } });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading'); setError('');
    try {
      const data = await apiRequest(`/admin/audit-log?page=${page}&pageSize=30`);
      setResult(data); setState('ready');
    } catch (err) { setError(err.message); setState('error'); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  return <div className={styles.page}>
    <div className={styles.titleRow}><div><p className={styles.kicker}>Управление сайтом</p><h1>Журнал аудита</h1><p>История действий администраторов. Записей: {result.meta?.total ?? 0}</p></div></div>
    {state === 'loading' && <div className={styles.empty} role="status">Загрузка журнала…</div>}
    {state === 'error' && <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>}
    {state === 'ready' && !result.items?.length && <div className={styles.empty}>Записей аудита пока нет.</div>}
    {state === 'ready' && Boolean(result.items?.length) && <div className={styles.auditList}>{result.items.map(item => <article className={styles.auditEntry} key={item.id}>
      <div className={styles.auditIcon} aria-hidden="true">{item.action === 'CREATE' ? '+' : item.action === 'PUBLISH' ? '↑' : '•'}</div>
      <div className={styles.auditBody}><strong>{item.summary || `${ACTIONS[item.action] || item.action} · ${ENTITIES[item.entityType] || item.entityType}`}</strong><p>{item.actor?.displayName || 'Система'} · {ENTITIES[item.entityType] || item.entityType} · {ACTIONS[item.action] || item.action}</p><small>Запись: {item.entityId}</small></div>
      <div className={styles.auditTime}><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time><small>Запрос: {item.requestId || '—'}</small></div>
    </article>)}</div>}
    {(result.meta?.totalPages || 1) > 1 && <nav className={styles.pagination} aria-label="Страницы журнала аудита"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page} из {result.meta.totalPages}</span><button disabled={page >= result.meta.totalPages} onClick={() => setPage(page + 1)}>Далее</button></nav>}
  </div>;
}
