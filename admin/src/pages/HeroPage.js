import { useCallback, useEffect, useState } from 'react';
import { heroApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import MediaPicker from '../components/MediaPicker';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import styles from './HeroPage.module.css';

const emptySlide = { title: '', subtitle: '', mediaId: '', posterMediaId: '', altText: '', isDecorative: false, ctaLabel: '', ctaUrl: '', position: 0 };
const nullable = value => value?.trim() || null;
const normalize = item => ({ ...emptySlide, ...item, title: item?.title || '', posterMediaId: item?.posterMediaId || '', altText: item?.altText || '', ctaLabel: item?.ctaLabel || '', ctaUrl: item?.ctaUrl || '' });

export default function HeroPage() {
  const { canPublish } = useAuth();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [media, setMedia] = useState(null);
  const [poster, setPoster] = useState(null);
  const [picker, setPicker] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);

  const load = useCallback(() => {
    setState('loading'); setError(''); setConflict(false);
    heroApi.list().then(data => { setItems(data.items || []); setState('ready'); }).catch(err => { setError(err.message); setState('error'); });
  }, []);
  useEffect(load, [load]);

  const openEditor = item => {
    const next = normalize(item || { position: items.length });
    setEditing(next); setMedia(item?.media || null); setPoster(item?.posterMedia || null); setError(''); setConflict(false);
  };
  const fail = err => { setError(err.message); setConflict(err.code === 'VERSION_CONFLICT'); setState('ready'); };
  const save = async event => {
    event.preventDefault(); setState('saving'); setError(''); setConflict(false);
    const payload = { title: nullable(editing.title), subtitle: editing.subtitle.trim(), mediaId: editing.mediaId, posterMediaId: editing.posterMediaId || null, altText: editing.isDecorative ? null : nullable(editing.altText), isDecorative: Boolean(editing.isDecorative), ctaLabel: nullable(editing.ctaLabel), ctaUrl: nullable(editing.ctaUrl), position: Number(editing.position), ...(editing.id && { version: editing.version }) };
    try {
      const saved = editing.id ? await heroApi.update(editing.id, payload) : await heroApi.create(payload);
      setEditing(normalize(saved)); setMedia(saved.media || media); setPoster(saved.posterMedia || poster); setNotice(editing.id ? 'Слайд сохранён.' : 'Слайд создан как черновик.'); load(); setEditing(null);
    } catch (err) { fail(err); }
  };
  const togglePublication = async item => {
    setError(''); setConflict(false);
    try { await (item.status === 'PUBLISHED' ? heroApi.unpublish(item.id, item.version) : heroApi.publish(item.id, item.version)); setNotice(item.status === 'PUBLISHED' ? 'Слайд снят с публикации.' : 'Слайд опубликован.'); load(); }
    catch (err) { fail(err); }
  };
  const archive = async item => {
    if (!window.confirm(`Архивировать слайд «${item.title || item.subtitle}»?`)) return;
    try { await heroApi.archive(item.id); setNotice('Слайд архивирован.'); load(); } catch (err) { fail(err); }
  };
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ordered = [...items]; [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setItems(ordered); setError('');
    try { await heroApi.reorder(ordered.map((item, position) => ({ id: item.id, position, version: item.version }))); setNotice('Порядок слайдов сохранён.'); load(); }
    catch (err) { setItems(items); fail(err); }
  };

  if (state === 'loading') return <div className={styles.loading}>Загрузка слайдов…</div>;
  if (state === 'error') return <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>;
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.kicker}>Управление сайтом</p><h1>Hero и баннеры</h1><p>Медиа, тексты, внутренние ссылки и порядок слайдов.</p></div><button className={styles.primary} onClick={() => openEditor()}>Добавить слайд</button></header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <div className={styles.error} role="alert"><span>{conflict ? 'Слайд изменён в другой сессии. Обновите список и повторите действие.' : error}</span>{conflict && <button onClick={load}>Обновить</button>}</div>}
    {!items.length ? <div className={styles.empty}>Слайды ещё не созданы.</div> : <div className={styles.list}>{items.map((item, index) => <article className={styles.card} key={item.id}>
      <PrivateMediaPreview media={item.media} className={styles.thumb} alt={item.isDecorative ? '' : item.altText || ''} />
      <div><div className={styles.meta}><span className={`${styles.badge} ${item.status === 'PUBLISHED' ? styles.published : styles.draft}`}>{item.status === 'PUBLISHED' ? 'Опубликован' : 'Черновик'}</span><small>позиция {item.position} · версия {item.version}</small></div><h2>{item.title || 'Без заголовка'}</h2><p>{item.subtitle}</p><div className={styles.order}><button aria-label="Переместить выше" disabled={index === 0 || state === 'saving'} onClick={() => move(index, -1)}>↑</button><button aria-label="Переместить ниже" disabled={index === items.length - 1 || state === 'saving'} onClick={() => move(index, 1)}>↓</button></div></div>
      <div className={styles.cardActions}><button className={styles.secondary} onClick={() => openEditor(item)}>Изменить</button>{canPublish('HERO') && <button className={styles.secondary} onClick={() => togglePublication(item)}>{item.status === 'PUBLISHED' ? 'Отключить' : 'Опубликовать'}</button>}<button className={styles.danger} onClick={() => archive(item)}>Архивировать</button></div>
    </article>)}</div>}
    {editing && <div className={styles.backdrop} role="presentation" onMouseDown={e => e.target === e.currentTarget && setEditing(null)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="hero-editor-title"><header className={styles.drawerHeader}><div><h2 id="hero-editor-title">{editing.id ? 'Редактирование слайда' : 'Новый слайд'}</h2><p>{editing.id ? `Версия ${editing.version}` : 'Будет создан как черновик'}</p></div><button className={styles.close} aria-label="Закрыть" onClick={() => setEditing(null)}>×</button></header>
      {error && <div className={styles.error} role="alert"><span>{conflict ? 'Слайд изменён в другой сессии. Закройте форму и загрузите свежую версию.' : error}</span>{conflict && <button type="button" onClick={() => { setEditing(null); load(); }}>Закрыть и обновить</button>}</div>}
      <form className={styles.form} onSubmit={save}><section className={styles.panel}><div className={styles.grid}><label className={styles.full}><span>Заголовок</span><input maxLength="240" value={editing.title} onChange={e => setEditing(current => ({ ...current, title: e.target.value }))} /></label><label className={styles.full}><span>Описание</span><textarea required rows="4" maxLength="1000" value={editing.subtitle} onChange={e => setEditing(current => ({ ...current, subtitle: e.target.value }))} /></label><label><span>Текст кнопки</span><input maxLength="120" value={editing.ctaLabel} onChange={e => setEditing(current => ({ ...current, ctaLabel: e.target.value }))} /></label><label><span>Внутренняя ссылка</span><input maxLength="500" pattern="/[a-z0-9\-/?=&]*" placeholder="/projects" value={editing.ctaUrl} onChange={e => setEditing(current => ({ ...current, ctaUrl: e.target.value }))} /><small>Только относительный URL внутри сайта.</small></label><label><span>Позиция</span><input type="number" min="0" max="100000" value={editing.position} onChange={e => setEditing(current => ({ ...current, position: Number(e.target.value) }))} /></label><label className={styles.check}><input type="checkbox" checked={editing.isDecorative} onChange={e => setEditing(current => ({ ...current, isDecorative: e.target.checked }))} /><span>Медиа декоративное</span></label>{!editing.isDecorative && <label className={styles.full}><span>Альтернативный текст</span><input required maxLength="500" value={editing.altText} onChange={e => setEditing(current => ({ ...current, altText: e.target.value }))} /></label>}</div></section>
      <section className={styles.panel}><div className={styles.mediaRow}><div className={styles.mediaBox}><h3>Изображение или видео</h3>{media ? <PrivateMediaPreview media={media} className={styles.thumb} /> : <div className={styles.thumb}>Не выбрано</div>}<button type="button" className={styles.secondary} onClick={() => setPicker('media')}>Выбрать медиа</button></div><div className={styles.mediaBox}><h3>Постер для видео</h3>{poster ? <PrivateMediaPreview media={poster} className={styles.thumb} /> : <div className={styles.thumb}>Не выбран</div>}<button type="button" className={styles.secondary} onClick={() => setPicker('poster')}>Выбрать постер</button>{poster && <button type="button" className={styles.textButton} onClick={() => { setPoster(null); setEditing(current => ({ ...current, posterMediaId: '' })); }}>Убрать</button>}</div></div></section>
      <section><h3>Предварительный просмотр</h3><div className={styles.preview}>{media ? <PrivateMediaPreview media={media} className={styles.previewMedia} alt={editing.isDecorative ? '' : editing.altText} /> : <div className={styles.previewMedia}>Выберите медиафайл</div>}<div className={styles.previewOverlay}>{editing.title && <h3>{editing.title}</h3>}<p>{editing.subtitle || 'Описание слайда'}</p>{editing.ctaLabel && <span>{editing.ctaLabel}</span>}</div></div></section>
      <div className={styles.formActions}><button className={styles.primary} disabled={state === 'saving' || !editing.mediaId}>{state === 'saving' ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className={styles.secondary} onClick={() => setEditing(null)}>Отмена</button></div></form>
    </aside></div>}
    {picker === 'media' && <MediaPicker title="Выберите изображение или видео" kinds={['IMAGE', 'VIDEO']} value={editing?.mediaId} onClose={() => setPicker('')} onChange={item => { setMedia(item); setEditing(current => ({ ...current, mediaId: item.id, altText: current.altText || item.defaultAlt || '' })); }} />}
    {picker === 'poster' && <MediaPicker title="Выберите изображение-постер" kinds={['IMAGE']} value={editing?.posterMediaId} onClose={() => setPicker('')} onChange={item => { setPoster(item); setEditing(current => ({ ...current, posterMediaId: item.id })); }} />}
  </div>;
}
