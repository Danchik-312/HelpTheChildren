import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicationsApi } from '../api/contentApi';
import PrivateMediaPreview from '../components/PrivateMediaPreview';
import StructuredContent from '../components/StructuredContent';
import styles from './Resource.module.css';

export default function PublicationPreviewPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { publicationsApi.preview(id).then(setItem).catch(err => setError(err.message)); }, [id]);
  if (error) return <div className={styles.error}>{error}</div>;
  if (!item) return <div className={styles.loading}>Подготовка предпросмотра…</div>;
  return <div className={styles.page}><div className={styles.titleRow}><div><p className={styles.kicker}>Предпросмотр · {item.status === 'PUBLISHED' ? 'опубликовано' : 'черновик'}</p><h1>{item.title}</h1></div><Link className={styles.secondary} to={`/publications/${id}/edit`}>Вернуться к редактированию</Link></div><article className={styles.previewArticle}>{item.coverMedia && <PrivateMediaPreview media={item.coverMedia} className={styles.heroPreview} />}<p className={styles.lead}>{item.excerpt}</p><StructuredContent value={item.body} /></article></div>;
}
