import { useCallback, useEffect, useState } from 'react';
import { mediaApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import styles from './Resource.module.css';

const emptyUpload = { file: null, defaultAlt: '', caption: '', credit: '', rightsConfirmed: false };

export default function MediaPage() {
  const [filters, setFilters] = useState({ kind: '', visibility: '', page: 1, pageSize: 20 });
  const [result, setResult] = useState({ items: [], meta: {} });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [upload, setUpload] = useState(emptyUpload);
  const [selected, setSelected] = useState(null);
  const [usages, setUsages] = useState(null);
  const { user } = useAuth();

  const load = useCallback(() => {
    setState('loading'); setError('');
    mediaApi.list(filters).then(data => { setResult(data); setState('ready'); }).catch(err => { setError(err.message); setState('error'); });
  }, [filters]);
  useEffect(load, [load]);

  const submitUpload = async event => {
    event.preventDefault(); setError('');
    const uploadForm = event.currentTarget;
    if (!upload.file) { setError('Выберите файл.'); return; }
    const formData = new FormData();
    formData.append('file', upload.file);
    if (upload.defaultAlt) formData.append('defaultAlt', upload.defaultAlt);
    if (upload.caption) formData.append('caption', upload.caption);
    if (upload.credit) formData.append('credit', upload.credit);
    formData.append('rightsConfirmed', String(upload.rightsConfirmed));
    try { setState('uploading'); await mediaApi.upload(formData); setUpload(emptyUpload); uploadForm.reset(); load(); }
    catch (err) { setError(err.message); setState('ready'); }
  };
  const openDetails = async item => {
    setSelected({ ...item }); setUsages(null);
    try { setUsages(await mediaApi.usages(item.id)); } catch (err) { setError(err.message); }
  };
  const saveMetadata = async event => {
    event.preventDefault();
    try {
      const updated = await mediaApi.update(selected.id, { defaultAlt: selected.defaultAlt || null, caption: selected.caption || null, credit: selected.credit || null, rightsConfirmed: Boolean(selected.rightsConfirmed) });
      setSelected(updated); load();
    } catch (err) { setError(err.message); }
  };
  const remove = async () => {
    if (!window.confirm('Удалить этот файл? Действие возможно только если файл нигде не используется.')) return;
    try { await mediaApi.remove(selected.id); setSelected(null); load(); } catch (err) { setError(err.message); }
  };
  const usageTotal = usages ? Object.values(usages).reduce((sum, value) => sum + Number(value || 0), 0) : null;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}><div><p className={styles.kicker}>Контент</p><h1>Медиатека</h1><p>Безопасная загрузка и повторное использование файлов.</p></div></div>
      {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError('')}>Закрыть</button></div>}
      <form className={`${styles.panel} ${styles.uploadForm}`} onSubmit={submitUpload}><h2>Загрузить файл</h2><div className={styles.formGrid}><label className={styles.full}><span>Изображение или видео</span><input type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={event => setUpload(current => ({ ...current, file: event.target.files[0] || null }))} /></label><label><span>Альтернативный текст</span><input value={upload.defaultAlt} onChange={event => setUpload(current => ({ ...current, defaultAlt: event.target.value }))} /></label><label><span>Автор / источник</span><input value={upload.credit} onChange={event => setUpload(current => ({ ...current, credit: event.target.value }))} /></label><label className={styles.full}><span>Подпись</span><input value={upload.caption} onChange={event => setUpload(current => ({ ...current, caption: event.target.value }))} /></label><label className={`${styles.full} ${styles.check}`}><input type="checkbox" checked={upload.rightsConfirmed} onChange={event => setUpload(current => ({ ...current, rightsConfirmed: event.target.checked }))} /><span>Подтверждаю право на использование файла</span></label></div><button className={styles.primary} disabled={state === 'uploading'}>{state === 'uploading' ? 'Загрузка…' : 'Загрузить'}</button></form>
      <div className={styles.filters}><label><span>Тип</span><select value={filters.kind} onChange={event => setFilters(current => ({ ...current, kind: event.target.value, page: 1 }))}><option value="">Все</option><option value="IMAGE">Изображения</option><option value="VIDEO">Видео</option><option value="EXTERNAL_VIDEO">Внешнее видео</option></select></label><label><span>Доступ</span><select value={filters.visibility} onChange={event => setFilters(current => ({ ...current, visibility: event.target.value, page: 1 }))}><option value="">Любой</option><option value="PRIVATE">Приватный</option><option value="PUBLIC">Публичный</option></select></label></div>
      {state === 'loading' && <div className={styles.loading}>Загрузка медиатеки…</div>}
      {state === 'ready' && !result.items.length && <div className={styles.empty}><strong>Файлов пока нет</strong><span>Загрузите первый файл с помощью формы выше.</span></div>}
      {state === 'ready' && <div className={styles.mediaGrid}>{result.items.map(item => <button key={item.id} className={styles.mediaCard} onClick={() => openDetails(item)}><PrivateMediaPreview media={item} className={styles.mediaThumb} /><span><strong>{item.originalName || item.defaultAlt || item.kind}</strong><small>{item.visibility === 'PUBLIC' ? 'Публичный' : 'Приватный'} · {item.rightsConfirmed ? 'права подтверждены' : 'без подтверждения прав'}</small></span></button>)}</div>}
      {(result.meta?.totalPages || 0) > 1 && <nav className={styles.pagination}><button disabled={filters.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Назад</button><span>Страница {filters.page} из {result.meta.totalPages}</span><button disabled={filters.page >= result.meta.totalPages} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Далее</button></nav>}
      {selected && <div className={styles.drawerBackdrop} onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Свойства файла"><button className={styles.close} onClick={() => setSelected(null)} aria-label="Закрыть">×</button><PrivateMediaPreview media={selected} className={styles.drawerPreview} /><h2>{selected.originalName || 'Медиафайл'}</h2><p>{usageTotal === null ? 'Проверка использований…' : `Использований: ${usageTotal}`}</p><form onSubmit={saveMetadata}><label><span>Альтернативный текст</span><input value={selected.defaultAlt || ''} onChange={event => setSelected(current => ({ ...current, defaultAlt: event.target.value }))} /></label><label><span>Подпись</span><textarea rows="3" value={selected.caption || ''} onChange={event => setSelected(current => ({ ...current, caption: event.target.value }))} /></label><label><span>Автор / источник</span><input value={selected.credit || ''} onChange={event => setSelected(current => ({ ...current, credit: event.target.value }))} /></label><label className={styles.check}><input type="checkbox" checked={Boolean(selected.rightsConfirmed)} onChange={event => setSelected(current => ({ ...current, rightsConfirmed: event.target.checked }))} /><span>Права подтверждены</span></label><button className={styles.primary}>Сохранить метаданные</button></form>{user?.role === 'ADMIN' && <button className={styles.danger} disabled={usageTotal !== 0} onClick={remove}>Удалить файл</button>}</aside></div>}
    </div>
  );
}
