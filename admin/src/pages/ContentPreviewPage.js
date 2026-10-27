import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import StructuredContent from '../components/StructuredContent';
import { resourceDefinitions } from './contentResources';
import styles from './Resource.module.css';

export default function ContentPreviewPage({ resource }) {
  const definition = resourceDefinitions[resource];
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { definition.api.preview(id).then(setItem).catch(err => setError(err.message)); }, [definition, id]);
  if (error) return <div className={styles.error}>{error}</div>;
  if (!item) return <div className={styles.loading}>Подготовка предпросмотра…</div>;
  return <div className={styles.page}><div className={styles.titleRow}><div><p className={styles.kicker}>Предпросмотр · {item.status === 'PUBLISHED' ? 'опубликовано' : 'черновик'}</p><h1>{item.title}</h1></div><Link className={styles.secondary} to={`/${resource}/${id}/edit`}>Вернуться к редактированию</Link></div><article className={styles.previewArticle}>{item.coverMedia && <PrivateMediaPreview media={item.coverMedia} className={styles.heroPreview} />}<p className={styles.lead}>{item[definition.summaryField]}</p>{resource === 'children' && <><h2>{item.publicDisplayName}</h2>{item.publicAgeLabel && <p>{item.publicAgeLabel}</p>}{item.approvedHealthSummary && <p>{item.approvedHealthSummary}</p>}<p><strong>Причина поддержки:</strong> {item.supportReason}</p></>}<StructuredContent value={item[definition.bodyField]} /></article></div>;
}
