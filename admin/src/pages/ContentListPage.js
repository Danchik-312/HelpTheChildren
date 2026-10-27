import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { resourceDefinitions, statusLabels } from './contentResources';
import styles from './Resource.module.css';

export default function ContentListPage({ resource }) {
  const definition = resourceDefinitions[resource];
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const selectedFilter = definition.filter ? params.get(definition.filter) || '' : '';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const q = params.get('q') || '';
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState({ items: [], meta: { page, totalPages: 0, total: 0 } });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const { canPublish, user } = useAuth();

  const load = useCallback(() => {
    setState('loading'); setError('');
    definition.api.list({ status, q, page, pageSize: 20, ...(definition.filter && { [definition.filter]: selectedFilter }) })
      .then(data => { setResult(data); setState('ready'); })
      .catch(err => { setError(err.message); setState('error'); });
  }, [definition, page, q, selectedFilter, status]);
  useEffect(load, [load]);

  const updateParams = values => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next);
  };
  const mayPublish = canPublish(definition.area) && (resource !== 'children' || user?.role === 'ADMIN');
  const togglePublication = async item => {
    try {
      await (item.status === 'PUBLISHED' ? definition.api.unpublish(item.id, item.version) : definition.api.publish(item.id, item.version));
      load();
    } catch (err) {
      load(); setError(err.code === 'VERSION_CONFLICT' ? 'Запись уже изменена. Список обновлён; повторите действие.' : err.message);
    }
  };
  const archive = async item => {
    if (!window.confirm(`Переместить «${item.title}» в архив?`)) return;
    try { await definition.api.archive(item.id); load(); } catch (err) { setError(err.message); }
  };

  return <div className={styles.page}>
    <div className={styles.titleRow}><div><p className={styles.kicker}>Контент</p><h1>{definition.title}</h1><p>Всего записей: {result.meta?.total ?? 0}</p></div><Link className={styles.primary} to={`/${resource}/new`}>Создать</Link></div>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); updateParams({ q: search, page: '' }); }}>
      <label><span>Поиск</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название или slug" /></label>
      {definition.filter && <label><span>{definition.filter === 'kind' ? 'Тип' : 'Группа'}</span><select value={selectedFilter} onChange={event => updateParams({ [definition.filter]: event.target.value, page: '' })}><option value="">Все</option>{Object.entries(definition.filterOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label><span>Статус</span><select value={status} onChange={event => updateParams({ status: event.target.value, page: '' })}><option value="">Все</option><option value="DRAFT">Черновики</option><option value="PUBLISHED">Опубликованные</option></select></label>
      <button type="submit">Найти</button>
    </form>
    {error && <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>}
    {state === 'loading' && <div className={styles.loading}>Загрузка записей…</div>}
    {state === 'ready' && !result.items.length && <div className={styles.empty}><strong>Записи не найдены</strong><span>Измените фильтры или создайте первую запись.</span></div>}
    {state === 'ready' && result.items.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Запись</th><th>Статус</th><th>Изменена</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td><strong>{item.title}</strong><small>/{item.slug}</small></td><td><span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusLabels[item.status]}</span></td><td>{new Date(item.updatedAt).toLocaleString('ru-RU')}</td><td><div className={styles.actions}><Link to={`/${resource}/${item.id}/edit`}>Изменить</Link><Link to={`/${resource}/${item.id}/preview`}>Просмотр</Link>{mayPublish && <button onClick={() => togglePublication(item)}>{item.status === 'PUBLISHED' ? 'Снять' : 'Опубликовать'}</button>}<button className={styles.dangerLink} onClick={() => archive(item)}>В архив</button></div></td></tr>)}</tbody></table></div>}
    {(result.meta?.totalPages || 0) > 1 && <nav className={styles.pagination} aria-label="Пагинация"><button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>Назад</button><span>Страница {page} из {result.meta.totalPages}</span><button disabled={page >= result.meta.totalPages} onClick={() => updateParams({ page: String(page + 1) })}>Далее</button></nav>}
  </div>;
}
