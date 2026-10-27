import { useEffect, useState } from 'react';
import { mediaApi } from '../api/contentApi';
import PrivateMediaPreview from './PrivateMediaPreview';
import styles from './MediaPicker.module.css';

export default function MediaPicker({ value, onChange, onClose, title = 'Выберите обложку', kinds = ['IMAGE'] }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const kindKey = kinds.join(',');

  useEffect(() => {
    let active = true;
    const allowedKinds = kindKey.split(',').filter(Boolean);
    setLoading(true);
    mediaApi.list({ pageSize: 100 })
      .then(result => active && setItems((result.items || []).filter(item => allowedKinds.includes(item.kind))))
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [kindKey]);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
        <header><div><h2 id="media-picker-title">{title}</h2><p>Показываются подходящие готовые файлы из медиатеки.</p></div><button type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        {loading && <p>Загрузка медиатеки…</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!loading && !error && !items.length && <p>В медиатеке пока нет подходящих файлов.</p>}
        <div className={styles.grid}>
          {items.map(item => (
            <button className={item.id === value ? styles.selected : ''} type="button" key={item.id} onClick={() => { onChange(item); onClose(); }}>
              <PrivateMediaPreview media={item} className={styles.preview} />
              <span>{item.originalName || item.defaultAlt || 'Медиафайл'}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
