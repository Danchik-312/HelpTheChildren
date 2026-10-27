import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { categoriesApi, publicationsApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import MediaPicker from '../components/MediaPicker';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import RichTextEditor from '../components/RichTextEditor';
import styles from './Resource.module.css';

export const emptyBody = { type: 'doc', content: [{ type: 'paragraph' }] };

function canonicalizeJson(value, key = '') {
  if (Array.isArray(value)) {
    const items = value.map(item => canonicalizeJson(item));
    return (key === 'content' || key === 'marks') && items.length === 0 ? undefined : items;
  }
  if (!value || typeof value !== 'object') return value;
  const normalized = {};
  Object.keys(value).sort().forEach(childKey => {
    const child = canonicalizeJson(value[childKey], childKey);
    if (child === undefined || child === null) return;
    if (childKey === 'attrs' && Object.keys(child).length === 0) return;
    normalized[childKey] = child;
  });
  return normalized;
}

export function normalizeBody(body) {
  if (body?.type === 'doc' && Array.isArray(body.content)) return canonicalizeJson(body);
  if (Array.isArray(body)) {
    return canonicalizeJson({
      type: 'doc',
      content: body.map(node => {
        if (node?.type === 'paragraph' && typeof node.text === 'string') {
          return { type: 'paragraph', content: node.text ? [{ type: 'text', text: node.text }] : undefined };
        }
        return node;
      }),
    });
  }
  return emptyBody;
}

function normalizePublication(item) {
  const categoryIds = Array.isArray(item.categoryIds) ? item.categoryIds : (item.categories || []).map(link => link.category?.id || link.id).filter(Boolean);
  return { ...item, categoryIds, body: normalizeBody(item.body) };
}

const editableData = form => ({
  kind: form.kind,
  title: form.title,
  slug: form.slug,
  excerpt: form.excerpt,
  body: normalizeBody(form.body),
  coverMediaId: form.coverMediaId || null,
  categoryIds: [...(form.categoryIds || [])].sort(),
});

export const publicationSignature = form => JSON.stringify(canonicalizeJson(editableData(form)));

export default function PublicationFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { canPublish } = useAuth();
  const [form, setForm] = useState({ kind: params.get('kind') === 'ARTICLE' ? 'ARTICLE' : 'NEWS', title: '', slug: '', excerpt: '', body: emptyBody, coverMediaId: null, categoryIds: [] });
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [cover, setCover] = useState(null);
  const [picker, setPicker] = useState(false);
  const [state, setState] = useState(id ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const savedSignature = useRef(publicationSignature(form));
  const currentSignature = useMemo(() => publicationSignature(form), [form]);
  const isDirty = state !== 'loading' && currentSignature !== savedSignature.current;

  const markSaved = useCallback(item => {
    const normalized = normalizePublication(item);
    savedSignature.current = publicationSignature(normalized);
    setForm(normalized);
    return normalized;
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setState('loading');
    setError('');
    setConflict(false);
    publicationsApi.get(id).then(item => {
      const normalized = markSaved(item);
      setCover(normalized.coverMedia || null);
      setState('ready');
    }).catch(err => { setError(err.message); setState('error'); });
  }, [id, markSaved]);

  useEffect(load, [load]);
  useEffect(() => {
    categoriesApi.list().then(data => { setCategories(data.items || []); setCategoriesError(''); })
      .catch(err => setCategoriesError(err.message));
  }, []);
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const guardLink = event => {
      const link = event.target.closest?.('a[href]');
      if (link && !window.confirm('Есть несохранённые изменения. Уйти со страницы?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const guardHistory = () => {
      if (!window.confirm('Есть несохранённые изменения. Уйти со страницы?')) window.history.forward();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('popstate', guardHistory);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('popstate', guardHistory);
      document.removeEventListener('click', guardLink, true);
    };
  }, [isDirty]);

  const setField = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const payload = () => ({ ...editableData(form), ...(id && { version: form.version }) });

  const save = async event => {
    event.preventDefault();
    setError('');
    setConflict(false);
    setState('saving');
    try {
      const saved = id ? await publicationsApi.update(id, payload()) : await publicationsApi.create(payload());
      const normalized = markSaved(saved);
      setCover(normalized.coverMedia || cover);
      setState('ready');
      if (!id) navigate(`/publications/${saved.id}/edit`, { replace: true });
    } catch (err) {
      setState('ready');
      setError(err.message);
      setConflict(err.code === 'VERSION_CONFLICT');
    }
  };

  const changePublication = async publish => {
    setError('');
    setConflict(false);
    try {
      const updated = await (publish ? publicationsApi.publish(id, form.version) : publicationsApi.unpublish(id, form.version));
      setForm(current => ({ ...current, ...updated }));
    } catch (err) {
      setError(err.message);
      setConflict(err.code === 'VERSION_CONFLICT');
    }
  };

  if (state === 'loading') return <div className={styles.loading}>Загрузка материала…</div>;
  if (state === 'error') return <div className={styles.error}>{error}<button onClick={load}>Повторить</button></div>;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div><p className={styles.kicker}>Материал</p><h1>{id ? 'Редактирование' : 'Новый материал'}</h1><p>{id ? `Версия ${form.version}` : 'Материал будет создан как черновик.'}</p></div>
        <div className={styles.actions}><Link to={`/publications?kind=${form.kind}`}>К списку</Link>{id && <Link to={`/publications/${id}/preview`}>Предпросмотр</Link>}</div>
      </div>
      {isDirty && <p className={styles.unsaved} role="status">Есть несохранённые изменения</p>}
      {error && <div className={styles.error} role="alert">{conflict ? 'Материал изменён в другой сессии. Перезагрузите свежую версию, чтобы не затереть изменения.' : error}{conflict && <button onClick={load}>Загрузить свежую версию</button>}</div>}
      <form className={styles.editor} onSubmit={save}>
        <section className={styles.panel}>
          <h2>Основное</h2>
          <div className={styles.formGrid}>
            <label><span>Тип</span><select value={form.kind} onChange={event => setField('kind', event.target.value)}><option value="NEWS">Новость</option><option value="ARTICLE">Статья</option></select></label>
            <label><span>Slug</span><input required maxLength="160" value={form.slug} onChange={event => setField('slug', event.target.value)} placeholder="nazvanie-materiala" /></label>
            <label className={styles.full}><span>Заголовок</span><input required maxLength="240" value={form.title} onChange={event => setField('title', event.target.value)} /></label>
            <label className={styles.full}><span>Краткое описание</span><textarea required maxLength="1000" rows="4" value={form.excerpt} onChange={event => setField('excerpt', event.target.value)} /></label>
            <fieldset className={styles.full}><legend>Категории</legend>{categoriesError ? <p role="alert">{categoriesError}</p> : categories.length ? categories.map(category => <label key={category.id}><input type="checkbox" checked={(form.categoryIds || []).includes(category.id)} onChange={event => setField('categoryIds', event.target.checked ? [...(form.categoryIds || []), category.id] : (form.categoryIds || []).filter(idValue => idValue !== category.id))} /> {category.name}</label>) : <small>Категории пока не созданы.</small>}</fieldset>
            <div className={styles.full}><span className={styles.fieldLabel}>Содержание</span><RichTextEditor value={form.body} onChange={body => setField('body', body)} disabled={state === 'saving'} /><small className={styles.fieldHint}>Содержимое сохраняется как структурированный JSON. HTML-код не принимается.</small></div>
          </div>
        </section>
        <aside className={styles.panel}>
          <h2>Публикация</h2>
          {id && <p><span className={`${styles.badge} ${styles[(form.status || 'DRAFT').toLowerCase()]}`}>{form.status === 'PUBLISHED' ? 'Опубликовано' : 'Черновик'}</span></p>}
          <button className={styles.primary} disabled={state === 'saving' || !isDirty} type="submit">{state === 'saving' ? 'Сохранение…' : 'Сохранить черновик'}</button>
          {id && canPublish('PUBLICATIONS') && <button className={styles.secondary} disabled={isDirty || state === 'saving'} title={isDirty ? 'Сначала сохраните черновик' : undefined} type="button" onClick={() => changePublication(form.status !== 'PUBLISHED')}>{form.status === 'PUBLISHED' ? 'Снять с публикации' : 'Опубликовать'}</button>}
          <hr />
          <h2>Обложка</h2>
          {cover ? <PrivateMediaPreview media={cover} className={styles.coverPreview} /> : <div className={styles.coverEmpty}>Обложка не выбрана</div>}
          <button className={styles.secondary} type="button" onClick={() => setPicker(true)}>Выбрать из медиатеки</button>
          {cover && <button className={styles.textButton} type="button" onClick={() => { setCover(null); setField('coverMediaId', null); }}>Убрать обложку</button>}
        </aside>
      </form>
      {picker && <MediaPicker value={form.coverMediaId} onClose={() => setPicker(false)} onChange={item => { setCover(item); setField('coverMediaId', item.id); }} />}
    </div>
  );
}
