import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { categoriesApi, publicationsApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import styles from './Resource.module.css';

const statusLabels = { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', ARCHIVED: 'В архиве' };
const kindLabels = { NEWS: 'Новости', ARTICLE: 'Статьи / публикации' };

export default function PublicationsPage() {
  const [params, setParams] = useSearchParams();
  const kind = ['NEWS', 'ARTICLE'].includes(params.get('kind')) ? params.get('kind') : 'NEWS';
  const status = params.get('status') || '';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const q = params.get('q') || '';
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState({ items: [], meta: { page, totalPages: 0, total: 0 } });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const { canPublish } = useAuth();
  useEffect(() => { categoriesApi.list().then(data => setCategories(data.items || [])).catch(() => setCategories([])); }, []);

  const load = useCallback(() => {
    setState('loading'); setError('');
    publicationsApi.list({ kind, status, q, categoryId: params.get('categoryId') || '', page, pageSize: 20 })
      .then(data => { setResult(data); setState('ready'); })
      .catch(err => { setError(err.message); setState('error'); });
  }, [kind, status, q, page, params]);
  useEffect(load, [load]);

  const updateParams = values => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next);
  };
  const changePublication = async (item, publish) => {
    try {
      await (publish ? publicationsApi.publish(item.id, item.version) : publicationsApi.unpublish(item.id, item.version));
      load();
    } catch (err) { load(); setError(err.code === 'VERSION_CONFLICT' ? 'Материал уже изменён. Список обновлён; повторите действие.' : err.message); }
  };
  const archive = async item => {
    if (!window.confirm(`Переместить «${item.title}» в архив?`)) return;
    try { await publicationsApi.archive(item.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}><div><p className={styles.kicker}>Контент</p><h1>{kindLabels[kind]}</h1><p>Всего материалов: {result.meta?.total ?? 0}</p></div><Link className={styles.primary} to={`/publications/new?kind=${kind}`}>Создать материал</Link></div>
      <form className={styles.filters} onSubmit={event => { event.preventDefault(); updateParams({ q: search, page: '' }); }}>
        <label><span>Поиск</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название или slug" /></label>
        <label><span>Тип</span><select value={kind} onChange={event => updateParams({ kind: event.target.value, page: '' })}><option value="NEWS">Новости</option><option value="ARTICLE">Статьи</option></select></label>
        <label><span>Статус</span><select value={status} onChange={event => updateParams({ status: event.target.value, page: '' })}><option value="">Все</option><option value="DRAFT">Черновики</option><option value="PUBLISHED">Опубликованные</option></select></label>
        <label><span>Категория</span><select value={params.get('categoryId') || ''} onChange={event => updateParams({ categoryId: event.target.value, page: '' })}><option value="">Все категории</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <button type="submit">Найти</button>
      </form>
      {error && <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>}
      {state === 'loading' && <div className={styles.loading}>Загрузка материалов…</div>}
      {state === 'ready' && !result.items.length && <div className={styles.empty}><strong>Материалы не найдены</strong><span>Измените фильтры или создайте первую запись.</span></div>}
      {state === 'ready' && result.items.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Материал</th><th>Статус</th><th>Изменён</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td><strong>{item.title}</strong><small>/{item.slug}</small></td><td><span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusLabels[item.status]}</span></td><td>{new Date(item.updatedAt).toLocaleString('ru-RU')}</td><td><div className={styles.actions}><Link to={`/publications/${item.id}/edit`}>Изменить</Link><Link to={`/publications/${item.id}/preview`}>Просмотр</Link>{canPublish('PUBLICATIONS') && (item.status === 'PUBLISHED' ? <button onClick={() => changePublication(item, false)}>Снять</button> : <button onClick={() => changePublication(item, true)}>Опубликовать</button>)}<button className={styles.dangerLink} onClick={() => archive(item)}>В архив</button></div></td></tr>)}</tbody></table></div>}
      {(result.meta?.totalPages || 0) > 1 && <nav className={styles.pagination} aria-label="Пагинация"><button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>Назад</button><span>Страница {page} из {result.meta.totalPages}</span><button disabled={page >= result.meta.totalPages} onClick={() => updateParams({ page: String(page + 1) })}>Далее</button></nav>}
    </div>
  );
}
