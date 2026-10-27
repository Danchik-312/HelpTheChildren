import { useCallback, useEffect, useState } from 'react';
import { siteApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import { contactTypes, emptyContact, isSafeContactHref } from './siteSettings';
import styles from './SiteSettings.module.css';

const normalize = item => ({ ...emptyContact, ...item, href: item?.href || '' });

export default function ContactsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setState('loading'); setError('');
    siteApi.get().then(data => { setItems(data.contacts || []); setState('ready'); }).catch(err => { setError(err.message); setState('error'); });
  }, []);
  useEffect(load, [load]);

  const save = async event => {
    event.preventDefault(); setState('saving'); setError(''); setNotice('');
    if (!isSafeContactHref(editing.href.trim())) {
      const message = 'Ссылка должна начинаться с https://, http://, mailto:, tel: или /.';
      setError(message); setState('ready'); window.alert(message); return;
    }
    const payload = { type: editing.type, label: editing.label.trim(), value: editing.value.trim(), href: editing.href.trim() || null, isPublic: Boolean(editing.isPublic), sortOrder: Number(editing.sortOrder) };
    try {
      if (editing.id) await siteApi.updateContact(editing.id, payload); else await siteApi.createContact(payload);
      setEditing(null); setNotice(editing.id ? 'Контакт обновлён.' : 'Контакт добавлен.'); load();
    } catch (err) { setError(err.message); setState('ready'); }
  };
  const remove = async item => {
    if (!window.confirm(`Удалить контакт «${item.label}»?`)) return;
    setError('');
    try { await siteApi.deleteContact(item.id); setNotice('Контакт удалён.'); load(); } catch (err) { setError(err.message); }
  };

  if (state === 'loading') return <div className={styles.loading}>Загрузка контактов…</div>;
  if (state === 'error') return <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>;
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.kicker}>Управление сайтом</p><h1>Контакты</h1><p>Телефоны, адреса, почта, график работы и социальные ссылки.</p></div>{isAdmin && <button className={styles.primary} onClick={() => setEditing(normalize())}>Добавить контакт</button>}</header>
    {!isAdmin && <p className={styles.readOnly}>Доступ только для чтения. Изменять контакты может администратор.</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!items.length ? <div className={styles.empty}>Контакты ещё не добавлены.</div> : <div className={styles.contactList}>{items.map(item => <article className={styles.contact} key={item.id}><div><span className={styles.badge}>{contactTypes[item.type] || item.type}</span><h2>{item.label}</h2><p>{item.value}</p>{item.href && <p>{item.href}</p>}<small>{item.isPublic ? 'Показывается на сайте' : 'Скрыт'} · порядок {item.sortOrder}</small></div>{isAdmin && <div className={styles.actions}><button className={styles.secondary} onClick={() => setEditing(normalize(item))}>Изменить</button><button className={styles.danger} onClick={() => remove(item)}>Удалить</button></div>}</article>)}</div>}
    {editing && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={e => e.target === e.currentTarget && setEditing(null)}><form className={`${styles.dialog} ${styles.form}`} role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" onSubmit={save}><h2 id="contact-dialog-title">{editing.id ? 'Изменить контакт' : 'Новый контакт'}</h2><div className={styles.grid}><label><span>Тип</span><select value={editing.type} onChange={e => setEditing(current => ({ ...current, type: e.target.value }))}>{Object.entries(contactTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Порядок</span><input type="number" min="0" max="100000" value={editing.sortOrder} onChange={e => setEditing(current => ({ ...current, sortOrder: Number(e.target.value) }))} /></label><label className={styles.full}><span>Подпись</span><input required maxLength="120" value={editing.label} onChange={e => setEditing(current => ({ ...current, label: e.target.value }))} /></label><label className={styles.full}><span>Значение</span><input required maxLength="500" value={editing.value} onChange={e => setEditing(current => ({ ...current, value: e.target.value }))} /></label><label className={styles.full}><span>Ссылка</span><input maxLength="1000" value={editing.href} placeholder="https://, mailto: или tel:" onChange={e => setEditing(current => ({ ...current, href: e.target.value }))} /></label><label className={`${styles.full} ${styles.check}`}><input type="checkbox" checked={editing.isPublic} onChange={e => setEditing(current => ({ ...current, isPublic: e.target.checked }))} /><span>Показывать на публичном сайте</span></label></div><div className={styles.actions}><button className={styles.primary} disabled={state === 'saving'}>{state === 'saving' ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className={styles.secondary} onClick={() => setEditing(null)}>Отмена</button></div></form></div>}
  </div>;
}
