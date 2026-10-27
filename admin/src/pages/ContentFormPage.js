import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import MediaPicker from '../components/MediaPicker';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import RichTextEditor from '../components/RichTextEditor';
import { editableData, normalizeDocument, resourceDefinitions } from './contentResources';
import styles from './Resource.module.css';

const nullable = value => value?.trim() || null;
const toDateInput = value => value ? String(value).slice(0, 10) : '';
function ResourceFields({ resource, form, setField, disabled }) {
  const definition = resourceDefinitions[resource];
  return <div className={styles.formGrid}>
    {resource === 'projects' && <><label><span>Тип</span><select value={form.kind} onChange={e => setField('kind', e.target.value)}><option value="PROJECT">Проект</option><option value="PROGRAM">Программа</option><option value="INITIATIVE">Инициатива</option></select></label><label><span>Состояние проекта</span><select value={form.projectState} onChange={e => setField('projectState', e.target.value)}><option value="PLANNED">Планируется</option><option value="ACTIVE">Активен</option><option value="COMPLETED">Завершён</option></select></label></>}
    {resource === 'pages' && <label><span>Группа</span><select value={form.group} onChange={e => setField('group', e.target.value)}><option value="ABOUT">О нас</option><option value="GIVE_HELP">Хочу помочь</option><option value="GET_HELP">Нужна помощь</option><option value="GENERAL">Общее</option></select></label>}
    {resource === 'children' && <label><span>Публичное имя</span><input required maxLength="120" value={form.publicDisplayName} onChange={e => setField('publicDisplayName', e.target.value)} /></label>}
    <label><span>Slug</span><input required maxLength="160" value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="nazvanie" /></label>
    <label className={styles.full}><span>Заголовок</span><input required maxLength="240" value={form.title} onChange={e => setField('title', e.target.value)} /></label>
    <label className={styles.full}><span>{resource === 'pages' ? 'Описание' : 'Краткое описание'}</span><textarea required maxLength="1000" rows="4" value={form[definition.summaryField]} onChange={e => setField(definition.summaryField, e.target.value)} /></label>
    {resource === 'children' && <><label><span>Публичное обозначение возраста</span><input maxLength="80" value={form.publicAgeLabel || ''} onChange={e => setField('publicAgeLabel', nullable(e.target.value))} /></label><label><span>Порядок</span><input type="number" min="0" max="100000" value={form.sortOrder} onChange={e => setField('sortOrder', Number(e.target.value))} /></label><label className={styles.full}><span>Разрешённое описание здоровья</span><textarea maxLength="1000" value={form.approvedHealthSummary || ''} onChange={e => setField('approvedHealthSummary', nullable(e.target.value))} /></label><label className={styles.full}><span>Причина поддержки</span><textarea required maxLength="1000" value={form.supportReason} onChange={e => setField('supportReason', e.target.value)} /></label></>}
    {resource === 'projects' && <><label><span>Начало</span><input type="date" value={toDateInput(form.startsAt)} onChange={e => setField('startsAt', e.target.value || null)} /></label><label><span>Завершение</span><input type="date" value={toDateInput(form.endsAt)} onChange={e => setField('endsAt', e.target.value || null)} /></label></>}
    {['projects', 'pages'].includes(resource) && <label><span>Порядок</span><input type="number" min="0" max="100000" value={form.sortOrder} onChange={e => setField('sortOrder', Number(e.target.value))} /></label>}
    <div className={styles.full}><span className={styles.fieldLabel}>{resource === 'children' ? 'История ребёнка' : 'Содержание'}</span><RichTextEditor value={form[definition.bodyField]} onChange={value => setField(definition.bodyField, value)} disabled={disabled} /><small className={styles.fieldHint}>Хранится как структурированный JSON; произвольный HTML не принимается.</small></div>
    {resource === 'stories' && <label className={`${styles.full} ${styles.check}`}><input type="checkbox" disabled={disabled || Boolean(form.consentConfirmedAt)} checked={Boolean(form.consentConfirmed)} onChange={e => setField('consentConfirmed', e.target.checked)} /><span>{form.consentConfirmedAt ? 'Согласие на публикацию истории подтверждено' : 'Подтверждаю наличие согласия на публикацию истории'}</span></label>}
  </div>;
}

export default function ContentFormPage({ resource }) {
  const definition = resourceDefinitions[resource];
  const { id } = useParams();
  const navigate = useNavigate();
  const { canPublish, user } = useAuth();
  const [form, setForm] = useState(definition.initial);
  const [cover, setCover] = useState(null);
  const [picker, setPicker] = useState(false);
  const [state, setState] = useState(id ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const savedSignature = useRef(JSON.stringify(editableData(definition, definition.initial)));
  const signature = useMemo(() => JSON.stringify(editableData(definition, form)), [definition, form]);
  const isDirty = state !== 'loading' && signature !== savedSignature.current;
  const isAdmin = user?.role === 'ADMIN';

  const markSaved = useCallback(item => {
    const normalized = {
      ...definition.initial,
      ...item,
      [definition.bodyField]: normalizeDocument(item[definition.bodyField]),
      ...(resource === 'stories' && { consentConfirmed: Boolean(item.consentConfirmedAt || item.consentConfirmed) }),
    };
    savedSignature.current = JSON.stringify(editableData(definition, normalized)); setForm(normalized); return normalized;
  }, [definition, resource]);
  const load = useCallback(() => {
    if (!id) return;
    setState('loading'); setError(''); setConflict(false);
    definition.api.get(id).then(item => { const next = markSaved(item); setCover(next.coverMedia || null); setState('ready'); }).catch(err => { setError(err.message); setState('error'); });
  }, [definition, id, markSaved]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const setField = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const run = async action => {
    setError(''); setConflict(false); setState('saving');
    try { const item = await action(); if (item) { const next = markSaved(item); setCover(next.coverMedia || cover); } setState('ready'); return item; }
    catch (err) { setState('ready'); setError(err.message); setConflict(err.code === 'VERSION_CONFLICT'); return null; }
  };
  const save = async event => {
    event.preventDefault();
    const payload = { ...editableData(definition, form), ...(id && { version: form.version }) };
    const saved = await run(() => id
      ? definition.api.update(id, payload).then(item => resource === 'children' ? definition.api.get(item.id) : item)
      : definition.api.create(payload));
    if (saved && !id) navigate(`/${resource}/${saved.id}/edit`, { replace: true });
  };
  const togglePublication = () => run(() => (form.status === 'PUBLISHED' ? definition.api.unpublish(id, form.version) : definition.api.publish(id, form.version)).then(() => definition.api.get(id)));
  if (state === 'loading') return <div className={styles.loading}>Загрузка записи…</div>;
  if (state === 'error') return <div className={styles.error}>{error}<button onClick={load}>Повторить</button></div>;
  const mayPublish = canPublish(definition.area) && (resource !== 'children' || isAdmin);
  return <div className={styles.page}>
    <div className={styles.titleRow}><div><p className={styles.kicker}>{definition.title}</p><h1>{id ? 'Редактирование' : `Новая запись: ${definition.singular}`}</h1><p>{id ? `Версия ${form.version}` : 'Запись будет создана как черновик.'}</p></div><div className={styles.actions}><Link to={`/${resource}`}>К списку</Link>{id && <Link to={`/${resource}/${id}/preview`}>Предпросмотр</Link>}</div></div>
    {isDirty && <p className={styles.unsaved}>Есть несохранённые изменения</p>}
    {error && <div className={styles.error} role="alert">{conflict ? 'Запись изменена в другой сессии. Загрузите свежую версию, чтобы не затереть изменения.' : error}{conflict && <button onClick={load}>Загрузить свежую версию</button>}</div>}
    <form className={styles.editor} onSubmit={save}><section className={styles.panel}><h2>Основное</h2><ResourceFields resource={resource} form={form} setField={setField} disabled={state === 'saving'} /></section><aside className={styles.panel}><h2>Публикация</h2>{id && <p><span className={`${styles.badge} ${styles[(form.status || 'DRAFT').toLowerCase()]}`}>{form.status === 'PUBLISHED' ? 'Опубликовано' : 'Черновик'}</span></p>}<button className={styles.primary} disabled={state === 'saving' || !isDirty} type="submit">{state === 'saving' ? 'Сохранение…' : 'Сохранить черновик'}</button>{id && mayPublish && <button className={styles.secondary} disabled={isDirty || state === 'saving'} type="button" onClick={togglePublication}>{form.status === 'PUBLISHED' ? 'Снять с публикации' : 'Опубликовать'}</button>}{resource === 'children' && !isAdmin && <p className={styles.warning}>Публикацию карточек детей выполняет только администратор.</p>}<hr /><h2>Обложка</h2>{cover ? <PrivateMediaPreview media={cover} className={styles.coverPreview} /> : <div className={styles.coverEmpty}>Обложка не выбрана</div>}<button className={styles.secondary} type="button" onClick={() => setPicker(true)}>Выбрать из медиатеки</button>{cover && <button className={styles.textButton} type="button" onClick={() => { setCover(null); setField('coverMediaId', null); }}>Убрать обложку</button>}</aside></form>
    {picker && <MediaPicker value={form.coverMediaId} onClose={() => setPicker(false)} onChange={item => { setCover(item); setField('coverMediaId', item.id); }} />}
  </div>;
}
