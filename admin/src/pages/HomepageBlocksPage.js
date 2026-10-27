import { useCallback, useEffect, useState } from 'react';
import { siteApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import { blockDefinitions } from './siteSettings';
import styles from './SiteSettings.module.css';

const normalizeBlock = (definition, item) => ({
  key: definition.key,
  enabled: item?.enabled ?? true,
  position: item?.position ?? 0,
  itemLimit: item?.itemLimit ?? '',
  heading: item?.heading || '',
  description: item?.description || '',
  config: item?.config || null,
  ...(item?.id && { id: item.id }),
});

export default function HomepageBlocksPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [blocks, setBlocks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setState('loading'); setError('');
    siteApi.get().then(data => {
      setBlocks(blockDefinitions.map(definition => normalizeBlock(definition, (data.blocks || []).find(item => item.key === definition.key))));
      setState('ready');
    }).catch(err => { setError(err.message); setState('error'); });
  }, []);
  useEffect(load, [load]);

  const save = async event => {
    event.preventDefault(); setState('saving'); setError(''); setNotice('');
    const { key, ...values } = editing;
    const payload = { ...values, position: Number(values.position), itemLimit: values.itemLimit === '' ? null : Number(values.itemLimit), heading: values.heading.trim() || null, description: values.description.trim() || null, config: values.config || null };
    delete payload.id; delete payload.createdAt; delete payload.updatedAt; delete payload.updatedById;
    try { await siteApi.updateBlock(key, payload); setEditing(null); setNotice('Настройки блока сохранены.'); load(); }
    catch (err) { setError(err.message); setState('ready'); }
  };

  if (state === 'loading') return <div className={styles.loading}>Загрузка блоков…</div>;
  if (state === 'error') return <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>;
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.kicker}>Управление сайтом</p><h1>Блоки главной</h1><p>Видимость, порядок и подписи секций публичной главной страницы.</p></div></header>
    {!isAdmin && <p className={styles.readOnly}>Доступ только для чтения. Изменять блоки может администратор.</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.blockList}>{blocks.map(block => {
      const definition = blockDefinitions.find(item => item.key === block.key);
      return <article className={styles.block} key={block.key}><div><span className={styles.badge}>{block.enabled ? 'Включён' : 'Отключён'}</span><h2>{block.heading || definition?.title || block.key}</h2><p>{block.description || 'Описание не задано'}</p><small>Позиция {block.position}{block.itemLimit !== '' ? ` · элементов: ${block.itemLimit}` : ''}</small></div>{isAdmin && <div className={styles.actions}><button className={styles.secondary} onClick={() => setEditing({ ...block })}>Настроить</button></div>}</article>;
    })}</div>
    {editing && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={e => e.target === e.currentTarget && setEditing(null)}><form className={`${styles.dialog} ${styles.form}`} role="dialog" aria-modal="true" aria-labelledby="block-dialog-title" onSubmit={save}><h2 id="block-dialog-title">{blockDefinitions.find(item => item.key === editing.key)?.title}</h2><div className={styles.grid}><label><span>Позиция</span><input type="number" min="0" max="100" value={editing.position} onChange={e => setEditing(current => ({ ...current, position: Number(e.target.value) }))} /></label><label><span>Количество элементов</span><input type="number" min="1" max="50" value={editing.itemLimit} onChange={e => setEditing(current => ({ ...current, itemLimit: e.target.value }))} placeholder="По умолчанию" /></label><label className={styles.full}><span>Заголовок</span><input maxLength="240" value={editing.heading} onChange={e => setEditing(current => ({ ...current, heading: e.target.value }))} /></label><label className={styles.full}><span>Описание</span><textarea rows="4" maxLength="1000" value={editing.description} onChange={e => setEditing(current => ({ ...current, description: e.target.value }))} /></label><label className={`${styles.full} ${styles.check}`}><input type="checkbox" checked={editing.enabled} onChange={e => setEditing(current => ({ ...current, enabled: e.target.checked }))} /><span>Показывать блок на главной</span></label></div><div className={styles.actions}><button className={styles.primary} disabled={state === 'saving'}>{state === 'saving' ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className={styles.secondary} onClick={() => setEditing(null)}>Отмена</button></div></form></div>}
  </div>;
}
