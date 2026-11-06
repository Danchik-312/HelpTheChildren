import { useCallback, useEffect, useState } from 'react';
import { siteApi } from '../api/contentApi';
import { useAuth } from '../auth/AuthContext';
import { documentToText, textToDocument } from './siteSettings';
import styles from './SiteSettings.module.css';

const defaultColors = { brandColor: '#DC6601', accentColor: '#BFFF00' };
const hexColor = /^#[0-9a-f]{6}$/i;
const supportsColors = item => [item?.brandColor, item?.accentColor].every(value => typeof value === 'string' && hexColor.test(value));
const initial = { displayName: '', shortDescription: '', descriptionText: '', ...defaultColors };

function ColorField({ label, value, fallback, disabled, onChange }) {
  return <div className={styles.colorField}>
    <label><span>{label}</span><input required pattern="#[0-9A-Fa-f]{6}" maxLength={7} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>
    <input type="color" aria-label={'Выбрать цвет: ' + label} value={hexColor.test(value) ? value : fallback} disabled={disabled} onChange={event => onChange(event.target.value.toUpperCase())} />
  </div>;
}

export default function OrganizationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [form, setForm] = useState(initial);
  const [state, setState] = useState('loading');
  const [colorsAvailable, setColorsAvailable] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setState('loading'); setError('');
    siteApi.get().then(data => {
      const item = data.organization || {};
      const available = supportsColors(item);
      setColorsAvailable(available);
      setForm({
        displayName: item.displayName || '',
        shortDescription: item.shortDescription || '',
        descriptionText: documentToText(item.description),
        brandColor: available ? item.brandColor.toUpperCase() : defaultColors.brandColor,
        accentColor: available ? item.accentColor.toUpperCase() : defaultColors.accentColor,
      });
      setState('ready');
    }).catch(err => { setError(err.message); setState('error'); });
  }, []);
  useEffect(load, [load]);

  const submit = async event => {
    event.preventDefault();
    if (!isAdmin || state === 'saving') return;
    if (colorsAvailable && !supportsColors(form)) {
      setError('Введите оба цвета в формате #RRGGBB.');
      return;
    }
    setState('saving'); setError(''); setNotice('');
    try {
      const saved = await siteApi.updateOrganization({
        displayName: form.displayName.trim(),
        shortDescription: form.shortDescription.trim() || null,
        description: form.descriptionText.trim() ? textToDocument(form.descriptionText) : null,
        ...(colorsAvailable && { brandColor: form.brandColor.toUpperCase(), accentColor: form.accentColor.toUpperCase() }),
      });
      if (supportsColors(saved)) {
        setColorsAvailable(true);
        setForm(current => ({ ...current, brandColor: saved.brandColor.toUpperCase(), accentColor: saved.accentColor.toUpperCase() }));
      }
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
      <fieldset className={styles.colorSettings}>
        <legend>Цвета публичного сайта</legend>
        <ColorField label="Шапка и подвал" value={form.brandColor} fallback={defaultColors.brandColor} disabled={!colorsAvailable || !isAdmin || state === 'saving'} onChange={brandColor => setForm(current => ({ ...current, brandColor }))} />
        <ColorField label="Hero и акценты" value={form.accentColor} fallback={defaultColors.accentColor} disabled={!colorsAvailable || !isAdmin || state === 'saving'} onChange={accentColor => setForm(current => ({ ...current, accentColor }))} />
        {isAdmin && !colorsAvailable && <small>Для редактирования цветов требуется обновлённый API и сохранённый профиль организации.</small>}
      </fieldset>
      {isAdmin && <button className={styles.primary} disabled={state === 'saving'}>{state === 'saving' ? 'Сохранение…' : 'Сохранить'}</button>}
    </form>
  </div>;
}
