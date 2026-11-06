import { useEffect, useState } from 'react';
import { mediaApi } from '../api/contentApi';
import PrivateMediaPreview from './PrivateMediaPreview';
import styles from './MediaPicker.module.css';

export default function MediaPicker({ value, onChange, onClose, title = 'Выберите обложку', kinds = ['IMAGE'], readyOnly = false, excludedIds = [] }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const kindKey = kinds.join(',');
  const visibleItems = items.filter(item => !excludedIds.includes(item.id));

  useEffect(() => {
    let active = true;
    const allowedKinds = kindKey.split(',').filter(Boolean);
    setLoading(true);
    setError('');
    mediaApi.list({ pageSize: 100, page, kind: allowedKinds.length === 1 ? allowedKinds[0] : undefined })
      .then(result => {
        if (!active) return;
        setItems((result.items || []).filter(item => allowedKinds.includes(item.kind) && (!readyOnly || item.status === 'READY')));
        setTotalPages(result.meta?.totalPages || 1);
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [kindKey, page, readyOnly]);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
        <header><div><h2 id="media-picker-title">{title}</h2><p>Показываются подходящие готовые файлы из медиатеки.</p></div><button type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        {loading && <p>Загрузка медиатеки…</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!loading && !error && !visibleItems.length && <p>На этой странице нет подходящих файлов.</p>}
        <div className={styles.grid}>
          {!loading && !error && visibleItems.map(item => (
            <button className={item.id === value ? styles.selected : ''} type="button" key={item.id} onClick={() => { onChange(item); onClose(); }}>
              <PrivateMediaPreview media={item} className={styles.preview} />
              <span>{item.originalName || item.defaultAlt || 'Медиафайл'}</span>
            </button>
          ))}
        </div>
        {totalPages > 1 && <nav className={styles.pagination} aria-label="Страницы медиатеки">
          <button type="button" disabled={loading || page === 1} onClick={() => setPage(current => current - 1)}>Назад</button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={loading || page === totalPages} onClick={() => setPage(current => current + 1)}>Далее</button>
        </nav>}
      </section>
    </div>
  );
}
