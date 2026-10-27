import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/apiClient';
import styles from './AdminUsersPage.module.css';

const AREAS = ['PUBLICATIONS', 'STORIES', 'CHILDREN', 'PROJECTS', 'PAGES', 'HERO', 'MEDIA', 'SITE'];
const AREA_LABELS = { PUBLICATIONS: 'Публикации', STORIES: 'Истории', CHILDREN: 'Дети', PROJECTS: 'Проекты', PAGES: 'Страницы', HERO: 'Hero', MEDIA: 'Медиатека', SITE: 'Настройки сайта' };
const blankUser = { email: '', displayName: '', password: '', role: 'EDITOR', permissions: [] };

export default function AdminUsersPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(blankUser);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setState('loading'); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (query) params.set('q', query);
      const response = await apiRequest(`/admin/users?${params}`);
      setItems(response.items || []); setMeta(response.meta || { page, totalPages: 1, total: 0 }); setState('ready');
    } catch (err) { setError(err.message); setState('error'); }
  }, [page, query]);
  useEffect(() => { load(); }, [load]);

  const create = async event => {
    event.preventDefault(); setError('');
    try {
      const input = { ...draft, permissions: draft.role === 'EDITOR' ? draft.permissions : [] };
      await apiRequest('/admin/users', { method: 'POST', body: input });
      setDraft(blankUser); setCreating(false); setNotice('Пользователь создан.'); load();
    } catch (err) { setError(err.message); }
  };

  const saveUser = async user => {
    setSavingId(user.id); setError('');
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { displayName: user.displayName, role: user.role, permissions: user.role === 'EDITOR' ? user.permissions : [] } });
      setNotice('Изменения сохранены.'); load();
    } catch (err) { setError(err.message); }
    finally { setSavingId(null); }
  };

  const changeStatus = async user => {
    const action = user.status === 'ACTIVE' ? 'deactivate' : 'activate';
    if (!window.confirm(`${action === 'deactivate' ? 'Деактивировать' : 'Активировать'} пользователя ${user.email}?`)) return;
    setError('');
    try { await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/${action}`, { method: 'POST' }); setNotice('Статус пользователя изменён.'); load(); }
    catch (err) { setError(err.message); }
  };

  const updateItem = (id, updater) => setItems(list => list.map(item => item.id === id ? updater(item) : item));
  const togglePermission = (user, area, key) => updateItem(user.id, item => {
    const current = item.permissions || [];
    const existing = current.find(permission => permission.area === area);
    let permissions;
    if (key === 'enabled') permissions = existing
      ? (existing.canPublish ? current : current.map(permission => permission.area === area ? { ...permission, canPublish: false } : permission))
      : [...current, { area, canPublish: false }];
    else permissions = existing
      ? current.map(permission => permission.area === area ? { ...permission, canPublish: !permission.canPublish } : permission)
      : [...current, { area, canPublish: true }];
    if (key === 'enabled' && existing && !existing.canPublish) permissions = current.filter(permission => permission.area !== area);
    return { ...item, permissions };
  });

  return <div className={styles.page}>
    <div className={styles.titleRow}><div><p className={styles.kicker}>Управление сайтом</p><h1>Пользователи и роли</h1><p>Всего учётных записей: {meta.total ?? 0}</p></div><button className={styles.primary} onClick={() => { setCreating(true); setDraft(blankUser); }}>Добавить пользователя</button></div>
    {error && <div className={styles.error} role="alert">{error}<button onClick={load}>Обновить список</button></div>}
    {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice('')} aria-label="Закрыть">×</button></div>}
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}><label>Поиск<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Имя или email" /></label><button className={styles.primary} type="submit">Найти</button></form>
    {creating && <section className={styles.createPanel}><div className={styles.panelHeading}><h2>Новый пользователь</h2><button className={styles.textButton} onClick={() => setCreating(false)}>Отмена</button></div><form onSubmit={create} className={styles.createForm}>
      <label>Имя<input required minLength="2" maxLength="120" value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })} /></label>
      <label>Email<input required type="email" maxLength="254" autoComplete="off" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label>
      <label>Временный пароль<input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} /><small>Не менее 12 символов. Пароль не отображается после создания.</small></label>
      <label>Роль<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="EDITOR">Редактор</option><option value="ADMIN">Администратор</option></select></label>
      {draft.role === 'EDITOR' && <PermissionEditor permissions={draft.permissions} onChange={permissions => setDraft({ ...draft, permissions })} />}
      <button className={styles.primary} type="submit">Создать учётную запись</button>
    </form></section>}
    {state === 'loading' && <div className={styles.empty} role="status">Загрузка пользователей…</div>}
    {state === 'ready' && !items.length && <div className={styles.empty}>Пользователи не найдены.</div>}
    {state === 'ready' && items.length > 0 && <div className={styles.userList}>{items.map(user => <article className={styles.userCard} key={user.id}>
      <div className={styles.userHeading}><div><h2>{user.displayName}</h2><p>{user.email}</p></div><span className={`${styles.status} ${user.status === 'ACTIVE' ? styles.active : styles.disabled}`}>{user.status === 'ACTIVE' ? 'Активен' : 'Отключён'}</span></div>
      <div className={styles.accountMeta}><span>Последний вход: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ru-RU') : 'ещё не входил'}</span><span>Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}</span></div>
      <div className={styles.editGrid}><label>Отображаемое имя<input value={user.displayName} onChange={event => updateItem(user.id, item => ({ ...item, displayName: event.target.value }))} /></label><label>Роль<select value={user.role} onChange={event => updateItem(user.id, item => ({ ...item, role: event.target.value }))}><option value="EDITOR">Редактор</option><option value="ADMIN">Администратор</option></select></label></div>
      {user.role === 'EDITOR' && <PermissionEditor permissions={user.permissions || []} onChange={permissions => updateItem(user.id, item => ({ ...item, permissions }))} />}
      <div className={styles.actions}><button className={styles.primary} disabled={savingId === user.id} onClick={() => saveUser(user)}>{savingId === user.id ? 'Сохранение…' : 'Сохранить изменения'}</button><button className={styles.secondary} onClick={() => changeStatus(user)}>{user.status === 'ACTIVE' ? 'Деактивировать' : 'Активировать'}</button></div>
    </article>)}</div>}
    {(meta.totalPages || 1) > 1 && <nav className={styles.pagination} aria-label="Страницы пользователей"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page} из {meta.totalPages}</span><button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Далее</button></nav>}
  </div>;
}

function PermissionEditor({ permissions, onChange }) {
  const setPermission = (area, patch) => {
    const existing = permissions.find(item => item.area === area);
    if (!existing && patch.enabled === false) return;
    let next;
    if (!existing) next = [...permissions, { area, canPublish: Boolean(patch.canPublish) }];
    else if (patch.enabled === false) next = permissions.filter(item => item.area !== area);
    else next = permissions.map(item => item.area === area ? { area, canPublish: patch.canPublish ?? item.canPublish } : item);
    onChange(next);
  };
  return <fieldset className={styles.permissionFieldset}><legend>Доступ редактора по разделам</legend><div className={styles.permissionGrid}>{AREAS.map(area => { const permission = permissions.find(item => item.area === area); return <div className={styles.permissionRow} key={area}><label><input type="checkbox" checked={Boolean(permission)} onChange={event => setPermission(area, { enabled: event.target.checked })} />{AREA_LABELS[area]}</label><label className={styles.publishLabel}><input type="checkbox" checked={Boolean(permission?.canPublish)} disabled={!permission} onChange={() => setPermission(area, { canPublish: !permission?.canPublish })} />Публиковать</label></div>; })}</div><small>Права на сервере проверяются для каждого запроса.</small></fieldset>;
}

