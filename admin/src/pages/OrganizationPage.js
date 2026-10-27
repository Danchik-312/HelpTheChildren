import { useCallback, useEffect, useState } from 'react';
import { siteApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import { documentToText, textToDocument } from './siteSettings';
import styles from './SiteSettings.module.css';

const initial = { displayName: '', shortDescription: '', descriptionText: '' };

export default function OrganizationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [form, setForm] = useState(initial);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setState('loading'); setError('');
    siteApi.get().then(data => {
      const item = data.organization || {};
      setForm({ displayName: item.displayName || '', shortDescription: item.shortDescription || '', descriptionText: documentToText(item.description) });
      setState('ready');
    }).catch(err => { setError(err.message); setState('error'); });
  }, []);
  useEffect(load, [load]);

  const submit = async event => {
    event.preventDefault(); setState('saving'); setError(''); setNotice('');
    try {
      await siteApi.updateOrganization({ displayName: form.displayName.trim(), shortDescription: form.shortDescription.trim() || null, description: form.descriptionText.trim() ? textToDocument(form.descriptionText) : null });
      setNotice('Информация об организации сохранена.'); setState('ready');
    } catch (err) { setError(err.message); setState('ready'); }
  };

  if (state === 'loading') return <div className={styles.loading}>Загрузка информации…</div>;
  if (state === 'error') return <div className={styles.error} role="alert">{error}<button onClick={load}>Повторить</button></div>;
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.kicker}>Управление сайтом</p><h1>Информация об организации</h1><p>Название и описания, доступные публичному сайту через API.</p></div></header>
    {!isAdmin && <p className={styles.readOnly}>Доступ только для чтения. Изменять общие настройки может администратор.</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <form className={`${styles.panel} ${styles.form}`} onSubmit={submit}>
      <label><span>Название организации</span><input required maxLength="200" disabled={!isAdmin || state === 'saving'} value={form.displayName} onChange={e => setForm(current => ({ ...current, displayName: e.target.value }))} /></label>
      <label><span>Краткое описание</span><textarea rows="4" maxLength="1000" disabled={!isAdmin || state === 'saving'} value={form.shortDescription} onChange={e => setForm(current => ({ ...current, shortDescription: e.target.value }))} /></label>
      <label><span>Полное описание</span><textarea rows="10" disabled={!isAdmin || state === 'saving'} value={form.descriptionText} onChange={e => setForm(current => ({ ...current, descriptionText: e.target.value }))} /><small>Текст сохраняется как структурированный JSON из абзацев. HTML не принимается.</small></label>
      {isAdmin && <button className={styles.primary} disabled={state === 'saving'}>{state === 'saving' ? 'Сохранение…' : 'Сохранить'}</button>}
    </form>
  </div>;
}
