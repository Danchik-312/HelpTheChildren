import { useCallback, useEffect, useState } from 'react';
import { categoriesApi } from '../api/contentApi';
import styles from './Resource.module.css';
import pageStyles from './CategoriesPage.module.css';

const initialForm = { id: null, name: '', slug: '' };

export default function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const result = await categoriesApi.list({ q: query });
      setItems(result.items || []);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (form.id) await categoriesApi.update(form.id, { name: form.name, slug: form.slug });
      else await categoriesApi.create({ name: form.name, slug: form.slug });
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.code === 'CATEGORY_SLUG_EXISTS' ? 'Категория с таким адресом уже существует.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async item => {
    if (!window.confirm(`Удалить категорию «${item.name}»?`)) return;
    setError('');
    try {
      await categoriesApi.remove(item.id);
      await load();
    } catch (err) {
      setError(err.code === 'CATEGORY_IN_USE' ? 'Категория используется публикациями и не может быть удалена.' : err.message);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div><p className={styles.kicker}>Контент</p><h1>Категории публикаций</h1><p>Общие для новостей и статей.</p></div>
      </div>
      {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={load}>Обновить</button></div>}
      <div className={pageStyles.columns}>
        <form className={`${styles.panel} ${pageStyles.form}`} onSubmit={submit}>
          <h2>{form.id ? 'Изменить категорию' : 'Новая категория'}</h2>
          <label><span>Название</span><input required maxLength="120" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label><span>Адрес (slug)</span><input required maxLength="160" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={event => setForm(current => ({ ...current, slug: event.target.value }))} /><small>Латинские буквы, цифры и дефисы.</small></label>
          <div className={pageStyles.actions}>
            <button className={styles.primary} type="submit" disabled={saving}>{saving ? 'Сохранение…' : form.id ? 'Сохранить' : 'Создать'}</button>
            {form.id && <button className={styles.secondary} type="button" onClick={() => setForm(initialForm)}>Отмена</button>}
          </div>
        </form>
        <section aria-label="Список категорий">
          <form className={`${styles.filters} ${pageStyles.search}`} onSubmit={event => { event.preventDefault(); load(); }}>
            <label><span>Поиск</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или slug" /></label>
            <button type="submit">Найти</button>
          </form>
          {state === 'loading' && <div className={styles.loading}>Загрузка категорий…</div>}
          {state === 'error' && <div className={styles.empty}>Не удалось загрузить категории.</div>}
          {state === 'ready' && !items.length && <div className={styles.empty}><strong>Категорий пока нет</strong><span>Создайте первую категорию для новостей или статей.</span></div>}
          {state === 'ready' && items.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Название</th><th>Slug</th><th>Публикаций</th><th>Действия</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td><small>{item.slug}</small></td><td>{item.publicationCount ?? 0}</td><td><div className={styles.actions}><button type="button" onClick={() => setForm({ id: item.id, name: item.name, slug: item.slug })}>Изменить</button><button className={styles.dangerLink} type="button" onClick={() => remove(item)}>Удалить</button></div></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </div>
  );
}
